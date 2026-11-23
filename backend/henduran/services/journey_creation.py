"""Criação atômica de uma Jornada com Mundo e personagem (passo "Nova Jornada").

Etapas:

1. ``validar``: conteúdo do Mundo (esquema v1), lugar inicial, personagem
   (regras da fatia 1) e nome da Jornada. Nada é gravado se houver erro: levanta
   :class:`JourneyCreationInvalid` com **todos** os erros por campo.
2. ``criar_mundo``: cria o Mundo (versão 1) com o conteúdo validado, no ``world.db``.
3. ``criar_jornada``: cria a Jornada fixada no Mundo e, **na mesma transação do
   ``journey.db``**, grava o personagem, a Ambição e o Desejo ativos e o resumo
   (``character_name``, ``location`` = nome do lugar inicial, ``day_period =
   "amanhecer"``, ``last_saved_at`` e ``rules_version``).
4. ``conferir``: relê o resumo da Jornada criada (somente leitura).

São dois bancos, e cada etapa grava em **um** só (ADR-075, item 4); o Mundo
criado só é lido pela Jornada. Se qualquer etapa falhar, a **compensação**
remove o que foi criado (pasta da Jornada e pasta do Mundo) e levanta
:class:`JourneyCreationFailed` (``criacao_falhou``) com a etapa.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from henduran.db.connection import Transaction, utc_now_iso
from henduran.rules import fatia1 as R
from henduran.rules.creation import Character, FieldError, check_text, validate_character
from henduran.storage import character as character_store
from henduran.storage.errors import StorageError
from henduran.storage.journeys import JourneyStore, JourneySummary
from henduran.worldgen.schema import validate_world_content

log = logging.getLogger("henduran.services")

START_DAY_PERIOD = "amanhecer"  # o Dia do Mundo começa no Amanhecer (ADR-073)
JOURNEY_NAME_MAX = 200
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


def default_journey_name(character_name: str) -> str:
    name = f"A Jornada de {character_name}"
    if len(name) > JOURNEY_NAME_MAX:
        name = name[: JOURNEY_NAME_MAX - 1].rstrip() + "…"
    return name


def _prefixed(errors: list[FieldError], prefix: str) -> list[FieldError]:
    return [FieldError(f"{prefix}.{e.field}" if e.field else prefix, e.code, e.message) for e in errors]


def plan_creation(
    *, world_content: Any, start_place_id: Any, character: Any, name: Any = None
) -> CreationPlan:
    """Valida tudo (sem gravar). Levanta :class:`JourneyCreationInvalid` com todos os erros."""
    errors: list[FieldError] = []
    journey_name: str | None = None
    if name is not None:
        journey_name = check_text(errors, "name", name, JOURNEY_NAME_MAX, "O nome da Jornada", single_line=True)
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
    )


def create_journey_with_character(
    journeys: JourneyStore,
    *,
    world_content: Any,
    start_place_id: Any,
    character: Any,
    name: Any = None,
) -> JourneySummary:
    """Cria Mundo, Jornada e personagem; tudo ou nada (com compensação). Devolve o resumo da Jornada."""
    plan = plan_creation(world_content=world_content, start_place_id=start_place_id, character=character, name=name)
    worlds = journeys.worlds
    world_id: str | None = None
    journey_id: str | None = None
    step = "criar_mundo"
    try:
        world_id = worlds.create_world(plan.world_content["name"], plan.world_content)

        step = "criar_jornada"

        def initialize(tx: Transaction, new_id: str) -> None:
            now = utc_now_iso()
            character_store.write_character(tx, plan.character, now)
            tx.execute(
                "UPDATE journey_meta SET character_name = ?, location = ?, day_period = ?, last_saved_at = ?, "
                "rules_version = ? WHERE id = ?",
                (plan.character.name, plan.start_place["name"], START_DAY_PERIOD, now, R.RULES_VERSION, new_id),
            )

        journey_id = journeys.create_journey(plan.name, world_id, 1, initialize=initialize)

        step = "conferir"
        summary = journeys.get_summary(journey_id)
        if summary.status != "ok":
            raise StorageError(summary.error_code or "criacao_falhou", summary.error_message or "A Jornada criada não pôde ser lida.")
    except BaseException as exc:
        leftovers = _compensate(journeys, journey_id, world_id)
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
    log.info("nova Jornada %s criada com o Mundo %s", journey_id, world_id)
    return summary


def _compensate(journeys: JourneyStore, journey_id: str | None, world_id: str | None) -> list[str]:
    """Remove a Jornada e o Mundo criados; devolve o que não pôde ser removido."""
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
    "START_DAY_PERIOD",
    "STEPS",
    "CreationPlan",
    "JourneyCreationFailed",
    "JourneyCreationInvalid",
    "create_journey_with_character",
    "default_journey_name",
    "plan_creation",
]
