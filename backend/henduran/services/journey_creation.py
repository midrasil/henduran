"""Criação atômica de uma Jornada com Mundo e personagem (passo "Nova Jornada").

O Mundo é **novo** (``world_content``, gravado num ``world.db`` novo) ou **salvo**
(``world_id``: um Mundo que já existe, lido sem alteração; ADR-075 e ADR-077, item 5).

Etapas:

1. ``validar``: conteúdo do Mundo (esquema v1; num Mundo salvo, o da última versão,
   lido em modo somente leitura), lugar inicial, personagem (regras da fatia 1), nome
   e descrição da Jornada. Nada é gravado se houver erro: levanta
   :class:`JourneyCreationInvalid` com **todos** os erros por campo.
2. ``criar_mundo`` (só Mundo novo): cria o Mundo (versão 1) com o conteúdo validado e a
   semente, no ``world.db``. A semente é a do gerador quando o conteúdo é exatamente o
   que ela gera; senão (Mundo editado, criado do zero ou duplicado), o Mundo é
   **personalizado** e a semente fica nula.
3. ``criar_jornada``: cria a Jornada fixada no Mundo e, **na mesma transação do
   ``journey.db``**, grava o personagem, a Ambição e o Desejo ativos, a descrição e o resumo
   (``character_name``, ``location`` = nome do lugar inicial, ``start_place_id``
   = id do lugar inicial, ``current_place_id`` = o mesmo lugar, ``day_period``
   sorteado pelo motor entre os períodos do dia, com peso igual (ADR-076, item 9),
   a data no calendário do Mundo (``calendar_year`` = ano do calendário; mês e dia
   sorteados pelo motor, ADR-076, item 16), ``last_saved_at`` e ``rules_version``).
4. ``conferir``: relê o resumo da Jornada criada (somente leitura).

São dois bancos, e cada etapa grava em **um** só (ADR-075, item 4); o Mundo
só é lido pela Jornada. Se qualquer etapa falhar, a **compensação** remove o que
foi criado (pasta da Jornada e, se for novo, pasta do Mundo) e levanta
:class:`JourneyCreationFailed` (``criacao_falhou``) com a etapa. Um Mundo salvo
nunca é removido nem alterado aqui.
"""

from __future__ import annotations

import logging
import random
from dataclasses import dataclass
from typing import Any

from henduran.db.connection import Transaction, utc_now_iso
from henduran.narrative.calendar import draw_date
from henduran.narrative.periods import draw_day_period
from henduran.rules import fatia1 as R
from henduran.rules.creation import Character, FieldError, check_optional_text, check_text, validate_character
from henduran.services.return_points import auto_save
from henduran.storage import character as character_store
from henduran.storage.errors import StorageError
from henduran.storage.journeys import JourneyStore, JourneySummary
from henduran.storage.worlds import WorldStore
from henduran.worldgen.generator import generate_world
from henduran.worldgen.schema import SEED_MAX, WorldValidation, validate_world_content

log = logging.getLogger("henduran.services")

JOURNEY_NAME_MAX = 200
JOURNEY_DESCRIPTION_MAX = 2000
STEPS = ("validar", "criar_mundo", "criar_jornada", "conferir")


class JourneyCreationInvalid(Exception):
    """Pedido de criação inválido; ``errors`` traz todos os erros por campo."""

    code = "criacao_invalida"

    def __init__(self, errors: list[FieldError]) -> None:
        super().__init__("Os dados da Nova Jornada têm erros; nada foi criado.")
        self.errors = errors

    def error_dicts(self) -> list[dict[str, str]]:
        return [e.to_dict() for e in self.errors]


class JourneyCreationFailed(StorageError):
    """Falha numa etapa da criação; o que foi criado já foi removido (ou o log diz o que sobrou)."""

    def __init__(self, step: str, message: str, *, leftovers: list[str] | None = None) -> None:
        super().__init__("criacao_falhou", message)
        self.step = step
        self.leftovers = leftovers or []


@dataclass(frozen=True)
class CreationPlan:
    name: str
    world_content: dict[str, Any]
    start_place: dict[str, str]
    character: Character
    description: str | None = None
    # Mundo salvo: id e versão fixada (nada é gravado no world.db). Mundo novo: None e 1.
    world_id: str | None = None
    world_version: int = 1


def default_journey_name(character_name: str) -> str:
    name = f"A Jornada de {character_name}"
    if len(name) > JOURNEY_NAME_MAX:
        name = name[: JOURNEY_NAME_MAX - 1].rstrip() + "…"
    return name


def _prefixed(errors: list[FieldError], prefix: str) -> list[FieldError]:
    return [FieldError(f"{prefix}.{e.field}" if e.field else prefix, e.code, e.message) for e in errors]


def _saved_world(worlds: WorldStore | None, world_id: Any, errors: list[FieldError]) -> tuple[str, int, Any] | None:
    """``(id, última versão, conteúdo)`` de um Mundo salvo, lido sem alteração; ou ``None`` com o erro."""

    def fail(code: str, message: str) -> None:
        errors.append(FieldError("world.id", code, message))

    if not isinstance(world_id, str) or not world_id:
        fail("tipo_invalido", "world.id deve ser o id de um Mundo salvo.")
        return None
    if worlds is None:
        fail("mundo_desconhecido", "O Mundo escolhido não existe.")
        return None
    try:
        summary = worlds.inspect_world(world_id)
    except StorageError:
        fail("mundo_desconhecido", "O Mundo escolhido não existe mais.")
        return None
    if summary.status == "mais_novo":
        fail("mundo_mais_novo", summary.error_message or "O Mundo é de uma versão mais nova do Henduran.")
        return None
    if summary.status != "ok" or not summary.versions:
        fail("mundo_danificado", "O Mundo escolhido não pode ser lido.")
        return None
    version = summary.versions[-1]
    try:
        content = worlds.read_content(summary.id, version)
    except (StorageError, ValueError) as exc:
        log.warning("conteúdo do mundo %s ilegível: %s", summary.id, exc)
        fail("mundo_danificado", "O Mundo escolhido não pode ser lido.")
        return None
    return summary.id, version, content


def plan_creation(
    *,
    world_content: Any = None,
    start_place_id: Any,
    character: Any,
    name: Any = None,
    description: Any = None,
    world_id: Any = None,
    worlds: WorldStore | None = None,
) -> CreationPlan:
    """Valida tudo (sem gravar). Levanta :class:`JourneyCreationInvalid` com todos os erros.

    Exatamente um entre ``world_content`` (Mundo novo) e ``world_id`` (Mundo salvo, lido em ``worlds``).
    """
    errors: list[FieldError] = []
    journey_name: str | None = None
    if name is not None:
        journey_name = check_text(errors, "name", name, JOURNEY_NAME_MAX, "O nome da Jornada", single_line=True)
    journey_description = check_optional_text(
        errors, "description", description, JOURNEY_DESCRIPTION_MAX, "A descrição da Jornada"
    )
    saved: tuple[str, int, Any] | None = None
    world = WorldValidation()
    if world_id is not None and world_content is not None:
        errors.append(
            FieldError("world", "mundo_ambiguo", "Envie o conteúdo de um Mundo novo ou o id de um Mundo salvo, não os dois.")
        )
    elif world_id is not None:
        saved = _saved_world(worlds, world_id, errors)
        if saved is not None:
            world = validate_world_content(saved[2])
            if world.errors:
                # O conteúdo salvo não segue o esquema atual: não dá para começar uma Jornada nele.
                errors.append(FieldError("world.id", "mundo_invalido", "O Mundo salvo não segue o esquema atual."))
                world = WorldValidation()
    else:
        world = validate_world_content(world_content)
        errors.extend(_prefixed(world.errors, "world.content"))
    start_place: dict[str, str] | None = None
    if start_place_id is None:
        errors.append(FieldError("start_place_id", "obrigatorio", "Escolha o lugar inicial."))
    elif not isinstance(start_place_id, str):
        errors.append(FieldError("start_place_id", "tipo_invalido", "O lugar inicial deve ser o id de um lugar."))
    elif world.content is not None:
        start_place = next((p for p in world.content["places"] if p["id"] == start_place_id), None)
        if start_place is None:
            errors.append(FieldError("start_place_id", "lugar_desconhecido", "O lugar inicial não está entre os lugares do Mundo."))
    checked = validate_character(character)
    errors.extend(_prefixed(checked.errors, "character"))
    if errors:
        raise JourneyCreationInvalid(errors)
    assert world.content is not None and start_place is not None and checked.character is not None
    return CreationPlan(
        name=journey_name or default_journey_name(checked.character.name),
        world_content=world.content,
        start_place=start_place,
        character=checked.character,
        description=journey_description,
        world_id=saved[0] if saved else None,
        world_version=saved[1] if saved else 1,
    )


def world_seed_for(content: dict[str, Any], requested: Any) -> int | None:
    """Semente do Mundo novo: a pedida, só se ela gera exatamente ``content``; senão, ``None``.

    Um Mundo editado à mão, criado do zero ou duplicado é um **Mundo personalizado**: não
    recebe semente, porque nenhuma semente o reproduz (decisão do responsável em 2026-11-24,
    refinando o ADR-077, item 5).
    """
    if isinstance(requested, int) and not isinstance(requested, bool) and 0 <= requested <= SEED_MAX:
        generated = validate_world_content(generate_world(requested)["content"]).content
        if generated == content:
            return requested
    return None


def create_journey_with_character(
    journeys: JourneyStore,
    *,
    world_content: Any = None,
    start_place_id: Any,
    character: Any,
    name: Any = None,
    description: Any = None,
    world_id: Any = None,
    world_seed: Any = None,
    rng: random.Random | None = None,
) -> JourneySummary:
    """Cria (se for novo) o Mundo, a Jornada e o personagem; tudo ou nada (com compensação).

    ``world_content`` cria um Mundo novo (com ``world_seed``, a semente do gerador, se houver);
    ``world_id`` usa um Mundo salvo, sem alterá-lo. ``rng`` sorteia o período inicial e depois
    a data (injetável nos testes). Devolve o resumo da Jornada.
    """
    worlds = journeys.worlds
    plan = plan_creation(
        world_content=world_content,
        start_place_id=start_place_id,
        character=character,
        name=name,
        description=description,
        world_id=world_id,
        worlds=worlds,
    )
    day_period = draw_day_period(rng)
    year, month, day = draw_date(plan.world_content["calendar"], rng)
    new_world_id: str | None = None
    journey_id: str | None = None
    step = "criar_mundo"
    try:
        if plan.world_id is None:
            seed = world_seed_for(plan.world_content, world_seed)
            new_world_id = worlds.create_world(plan.world_content["name"], plan.world_content, seed=seed)
            target_world = new_world_id
        else:
            target_world = plan.world_id

        step = "criar_jornada"

        def initialize(tx: Transaction, new_id: str) -> None:
            now = utc_now_iso()
            character_store.write_character(tx, plan.character, now)
            tx.execute(
                "UPDATE journey_meta SET character_name = ?, location = ?, start_place_id = ?, current_place_id = ?, "
                "day_period = ?, calendar_year = ?, calendar_month = ?, calendar_day = ?, last_saved_at = ?, "
                "rules_version = ?, description = ? WHERE id = ?",
                (
                    plan.character.name, plan.start_place["name"], plan.start_place["id"], plan.start_place["id"],
                    day_period, year, month, day, now, R.RULES_VERSION, plan.description, new_id,
                ),
            )

        journey_id = journeys.create_journey(
            plan.name, target_world, plan.world_version, initialize=initialize,
            after_initialize=lambda db, jid: auto_save(journeys, jid, db, "Início da Jornada"),
        )

        step = "conferir"
        summary = journeys.get_summary(journey_id)
        if summary.status != "ok":
            raise StorageError(summary.error_code or "criacao_falhou", summary.error_message or "A Jornada criada não pôde ser lida.")
    except BaseException as exc:
        leftovers = _compensate(journeys, journey_id, new_world_id)
        log.error("criação de Jornada falhou na etapa %s: %s", step, exc)
        if not isinstance(exc, Exception):
            raise
        detail = f"{exc}" if str(exc) else type(exc).__name__
        message = f"Não foi possível criar a Jornada (etapa {step}): {detail}. Nada foi mantido."
        if leftovers:
            message = (
                f"Não foi possível criar a Jornada (etapa {step}): {detail}. "
                f"Não foi possível remover: {', '.join(leftovers)}."
            )
        raise JourneyCreationFailed(step, message, leftovers=leftovers) from exc
    log.info("nova Jornada %s criada com o Mundo %s", journey_id, new_world_id or plan.world_id)
    return summary


def _compensate(journeys: JourneyStore, journey_id: str | None, world_id: str | None) -> list[str]:
    """Remove a Jornada e o Mundo **criados por esta operação**; devolve o que não pôde ser removido."""
    leftovers: list[str] = []
    if journey_id is not None:
        try:
            journeys.discard_new_journey(journey_id)
        except Exception as exc:  # noqa: BLE001 — continua compensando
            log.error("compensação: a Jornada %s não pôde ser removida: %s", journey_id, exc)
            leftovers.append(f"Jornada {journey_id}")
    if world_id is not None:
        try:
            journeys.worlds.discard_new_world(world_id)
        except Exception as exc:  # noqa: BLE001
            log.error("compensação: o Mundo %s não pôde ser removido: %s", world_id, exc)
            leftovers.append(f"Mundo {world_id}")
    return leftovers


__all__ = [
    "JOURNEY_DESCRIPTION_MAX",
    "STEPS",
    "CreationPlan",
    "JourneyCreationFailed",
    "JourneyCreationInvalid",
    "create_journey_with_character",
    "default_journey_name",
    "plan_creation",
    "world_seed_for",
]
