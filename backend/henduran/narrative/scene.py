"""Ciclo de Cena do MVP (ADR-076): propostas estruturadas, validação e operações do motor.

- A **proposta da Cena inicial** traz ``title``, ``motive`` e ``participants``; o
  lugar (lugar inicial da Jornada) e o período (``day_period`` atual) vêm do motor.
- A **proposta de Cena do Aduran** (itens 12 e 17) traz também o lugar: um lugar
  conhecido (``{"kind": "conhecido", "id"}``, do Mundo ou da Jornada) ou um lugar novo
  (``{"kind": "novo", "name", "type", "description"}``, com nome único entre Mundo e
  Jornada, sem diferenciar maiúsculas). É gravada como **pendente** até o jogador
  aceitar, pedir outra ou recusar.
- O **resumo de encerramento** traz só ``summary``.
- O motor valida cada proposta de forma estrita. Proposta inválida: até
  ``RETRIES`` novas tentativas, depois o erro ``proposta_invalida``, sem inventar
  nada.
- Abrir, encerrar e renomear Cena, aceitar ou recusar proposta e trocar de lugar só
  acontecem pelas operações daqui, numa transação, cada uma com o seu evento do Log.
  O texto narrado nunca grava estado (critério 6 do MVP): a marcação
  :data:`MARKER` só é reconhecida **no fim** de uma resposta do Aduran Fora de Cena
  e só faz o serviço *pedir* uma proposta, que passa pela mesma validação.
"""

from __future__ import annotations

import json
import re
from collections.abc import Awaitable, Callable, Iterable, Mapping
from dataclasses import dataclass
from typing import Any, TypeVar

from henduran.db.connection import Database, utc_now_iso
from henduran.narrative.context import MARKER
from henduran.narrative.periods import DAY_PERIODS
from henduran.providers.base import ChatMessage
from henduran.rules.creation import FieldError, check_text
from henduran.storage import events as event_store
from henduran.storage import places as place_store
from henduran.storage import proposals as proposal_store
from henduran.storage import scenes as store
from henduran.storage.errors import StorageError

TITLE_MAX = store.TITLE_MAX
MOTIVE_MAX = 300
PARTICIPANTS_MAX = 6
PARTICIPANT_MAX = 80
SUMMARY_MAX = 2000
PLACE_NAME_MAX = place_store.NAME_MAX
PLACE_TYPE_MAX = place_store.TYPE_MAX
PLACE_DESCRIPTION_MAX = place_store.DESCRIPTION_MAX
RETRIES = 2  # novas tentativas depois da primeira proposta inválida
PLACE_KNOWN = "conhecido"
PLACE_NEW = "novo"

_TITLE = {"type": "string", "minLength": 1, "maxLength": TITLE_MAX}
_MOTIVE = {"type": "string", "minLength": 1, "maxLength": MOTIVE_MAX}
_PARTICIPANTS = {
    "type": "array",
    "maxItems": PARTICIPANTS_MAX,
    "items": {"type": "string", "minLength": 1, "maxLength": PARTICIPANT_MAX},
}

SCENE_PROPOSAL_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {"title": _TITLE, "motive": _MOTIVE, "participants": _PARTICIPANTS},
    "required": ["title", "motive", "participants"],
    "additionalProperties": False,
}

ADURAN_PROPOSAL_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "title": _TITLE,
        "place": {
            "anyOf": [
                {
                    "type": "object",
                    "properties": {
                        "kind": {"type": "string", "enum": [PLACE_KNOWN]},
                        "id": {"type": "string", "minLength": 1, "maxLength": 40},
                    },
                    "required": ["kind", "id"],
                    "additionalProperties": False,
                },
                {
                    "type": "object",
                    "properties": {
                        "kind": {"type": "string", "enum": [PLACE_NEW]},
                        "name": {"type": "string", "minLength": 1, "maxLength": PLACE_NAME_MAX},
                        "type": {"type": "string", "minLength": 1, "maxLength": PLACE_TYPE_MAX},
                        "description": {"type": "string", "maxLength": PLACE_DESCRIPTION_MAX},
                    },
                    "required": ["kind", "name", "type", "description"],
                    "additionalProperties": False,
                },
            ]
        },
        "motive": _MOTIVE,
        "participants": _PARTICIPANTS,
    },
    "required": ["title", "place", "motive", "participants"],
    "additionalProperties": False,
}

SCENE_SUMMARY_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {"summary": {"type": "string", "minLength": 1, "maxLength": SUMMARY_MAX}},
    "required": ["summary"],
    "additionalProperties": False,
}


class InvalidProposal(ValueError):
    """Uma proposta do Narrador não passou na validação (o motivo vai para a nova tentativa)."""


class ProposalRejected(Exception):
    """O Narrador não entregou uma proposta válida depois de todas as tentativas."""

    code = "proposta_invalida"

    def __init__(self, reasons: list[str]) -> None:
        super().__init__(
            "O Narrador não conseguiu propor uma resposta válida. Nada foi gravado; tente de novo."
        )
        self.reasons = reasons


@dataclass(frozen=True)
class SceneProposal:
    motive: str
    participants: tuple[str, ...]
    title: str | None = None


@dataclass(frozen=True)
class NewPlace:
    name: str
    type: str
    description: str


@dataclass(frozen=True)
class AduranProposal:
    """Proposta de Cena do Aduran: lugar conhecido (``place_id``) ou novo (``new_place``)."""

    title: str
    motive: str
    participants: tuple[str, ...]
    place_id: str | None = None
    new_place: NewPlace | None = None


# ------------------------------------------------------------------ marcação do Aduran
def strip_marker(text: str) -> tuple[str, bool]:
    """Tira **uma** marcação :data:`MARKER` do fim do texto (tolerando espaços e quebras de linha).

    Devolve ``(texto sem a marcação e sem os espaços do fim, True)`` ou ``(texto, False)``.
    Uma marcação no meio do texto não conta: fica como texto.
    """
    stripped = text.rstrip()
    if stripped.endswith(MARKER):
        return stripped[: -len(MARKER)].rstrip(), True
    return text, False


_HOLD_WINDOW = 256  # só o fim do texto é examinado a cada fragmento


def held_from(text: str, emitted: int = 0) -> int:
    """Posição a partir da qual o fim do texto ainda pode ser a marcação (ou parte dela).

    O serviço só envia à interface ``text[:held_from(text)]``: o que pode ser a marcação
    (e os espaços antes dela) fica retido até a resposta continuar ou terminar.
    """
    base = max(emitted, len(text) - _HOLD_WINDOW, 0)
    tail = text[base:]
    stripped = tail.rstrip()
    if stripped.endswith(MARKER):
        start = len(stripped) - len(MARKER)
    else:
        start = len(stripped)
        for k in range(min(len(MARKER) - 1, len(stripped)), 0, -1):
            if stripped.endswith(MARKER[:k]):
                start = len(stripped) - k
                break
    while start > 0 and tail[start - 1].isspace():
        start -= 1
    return max(base + start, emitted)


# ------------------------------------------------------------------ validação
def _clean_text(value: Any, field: str, maximum: int, *, allow_empty: bool = False) -> str:
    if not isinstance(value, str):
        raise InvalidProposal(f"'{field}' deve ser texto.")
    text = value.strip()
    if not text and not allow_empty:
        raise InvalidProposal(f"'{field}' não pode ser vazio.")
    if len(text) > maximum:
        raise InvalidProposal(f"'{field}' passa de {maximum} caracteres.")
    if "\x00" in text:
        raise InvalidProposal(f"'{field}' tem caracteres inválidos.")
    return text


def _clean_line(value: Any, field: str, maximum: int) -> str:
    """Texto de uma linha: espaços e quebras de linha seguidos viram um espaço."""
    if not isinstance(value, str):
        raise InvalidProposal(f"'{field}' deve ser texto.")
    return _clean_text(" ".join(value.split()), field, maximum)


_FENCE_RE = re.compile(r"^```(?:json)?\s*\n(.*)\n```$", re.DOTALL)


def _load_object(raw: str, keys: tuple[str, ...]) -> dict[str, Any]:
    """Decodifica o objeto JSON da resposta. Só a cerca de código Markdown em volta é tolerada."""
    text = (raw or "").strip() if isinstance(raw, str) else raw
    if isinstance(text, str):
        fenced = _FENCE_RE.match(text)
        if fenced:
            text = fenced.group(1)
    try:
        data = json.loads(text)
    except (TypeError, ValueError, RecursionError) as exc:
        raise InvalidProposal("A resposta não é JSON válido.") from exc
    if not isinstance(data, dict):
        raise InvalidProposal("A resposta deve ser um objeto JSON.")
    _check_keys(data, keys, "")
    return data


def _check_keys(data: dict[str, Any], keys: tuple[str, ...], where: str) -> None:
    missing = [k for k in keys if k not in data]
    extra = [k for k in data if k not in keys]
    if missing:
        raise InvalidProposal(f"Faltam as chaves{where}: {', '.join(missing)}.")
    if extra:
        raise InvalidProposal(f"Chaves desconhecidas{where}: {', '.join(str(k)[:40] for k in extra)}.")


def _participants(items: Any) -> tuple[str, ...]:
    if not isinstance(items, list):
        raise InvalidProposal("'participants' deve ser uma lista.")
    if len(items) > PARTICIPANTS_MAX:
        raise InvalidProposal(f"'participants' tem mais de {PARTICIPANTS_MAX} itens.")
    return tuple(_clean_text(p, "participants", PARTICIPANT_MAX) for p in items)


def parse_scene_proposal(raw: str) -> SceneProposal:
    """Valida a proposta da Cena inicial (``{title, motive, participants}``). Levanta :class:`InvalidProposal`."""
    data = _load_object(raw, ("title", "motive", "participants"))
    return SceneProposal(
        motive=_clean_text(data["motive"], "motive", MOTIVE_MAX),
        participants=_participants(data["participants"]),
        title=_clean_line(data["title"], "title", TITLE_MAX),
    )


def parse_aduran_proposal(raw: str, *, known: Mapping[str, str]) -> AduranProposal:
    """Valida a proposta de Cena do Aduran. ``known``: id → nome dos lugares do Mundo e da Jornada."""
    data = _load_object(raw, ("title", "place", "motive", "participants"))
    title = _clean_line(data["title"], "title", TITLE_MAX)
    motive = _clean_text(data["motive"], "motive", MOTIVE_MAX)
    participants = _participants(data["participants"])
    place = data["place"]
    if not isinstance(place, dict):
        raise InvalidProposal("'place' deve ser um objeto.")
    kind = place.get("kind")
    if kind == PLACE_KNOWN:
        _check_keys(place, ("kind", "id"), " em 'place'")
        place_id = place["id"]
        if not isinstance(place_id, str) or place_id not in known:
            raise InvalidProposal("'place.id' não é de um lugar conhecido; use um id da lista ou proponha um lugar novo.")
        return AduranProposal(title=title, motive=motive, participants=participants, place_id=place_id)
    if kind == PLACE_NEW:
        _check_keys(place, ("kind", "name", "type", "description"), " em 'place'")
        name = _clean_line(place["name"], "place.name", PLACE_NAME_MAX)
        if name.casefold() in {n.casefold() for n in known.values()}:
            raise InvalidProposal(f"Já existe um lugar chamado '{name}'; use o id dele ou outro nome.")
        new_place = NewPlace(
            name=name,
            type=_clean_line(place["type"], "place.type", PLACE_TYPE_MAX),
            description=_clean_text(place["description"], "place.description", PLACE_DESCRIPTION_MAX, allow_empty=True),
        )
        return AduranProposal(title=title, motive=motive, participants=participants, new_place=new_place)
    raise InvalidProposal("'place.kind' deve ser 'conhecido' ou 'novo'.")


def parse_scene_summary(raw: str) -> str:
    """Valida o resumo de encerramento (``{summary}``). Levanta :class:`InvalidProposal`."""
    data = _load_object(raw, ("summary",))
    return _clean_text(data["summary"], "summary", SUMMARY_MAX)


def check_title(value: Any) -> str:
    """Título dado pelo jogador (renomear): 1 a 80 caracteres, uma linha. ``titulo_invalido`` se não."""
    errors: list[FieldError] = []
    title = check_text(errors, "title", value, TITLE_MAX, "O título da Cena", single_line=True)
    if title is None:
        raise StorageError("titulo_invalido", errors[0].message if errors else "Título inválido.")
    return title


T = TypeVar("T")
Complete = Callable[[list[ChatMessage]], Awaitable[str]]


async def request_valid(
    complete: Complete,
    messages: list[ChatMessage],
    parse: Callable[[str], T],
    *,
    retries: int = RETRIES,
) -> T:
    """Pede uma proposta e a valida; recusa e pede de novo até ``retries`` vezes.

    Cada nova tentativa leva a resposta recusada e o motivo, para o modelo corrigir.
    Erros do provedor (``ProviderUnavailable`` e outros) não contam como tentativa:
    sobem para quem chamou. Depois da última recusa, levanta :class:`ProposalRejected`.
    """
    attempt_messages = list(messages)
    reasons: list[str] = []
    for _ in range(retries + 1):
        raw = await complete(attempt_messages)
        try:
            return parse(raw)
        except InvalidProposal as exc:
            reasons.append(str(exc))
            attempt_messages = [
                *messages,
                {"role": "assistant", "content": (raw or "")[:4000] or "(vazio)"},
                {
                    "role": "user",
                    "content": f"A resposta anterior foi recusada: {exc} Responda de novo, somente com o objeto JSON pedido.",
                },
            ]
    raise ProposalRejected(reasons)


# ------------------------------------------------------------------ visões públicas
def scene_title(scene: Mapping[str, Any]) -> str:
    """O título da Cena; nas Cenas sem título (anteriores à migração 0004), "Cena N"."""
    return scene.get("title") or f"Cena {scene.get('number') or scene.get('id')}"


def place_names(world: dict[str, Any] | None, places: Iterable[Mapping[str, Any]] = ()) -> dict[str, str]:
    """id → nome dos lugares do Mundo e da Jornada."""
    out = {p["id"]: p.get("name", "") for p in (world or {}).get("places", []) if isinstance(p, dict) and "id" in p}
    out.update({p["id"]: p.get("name", "") for p in places})
    return out


def find_place(
    world: dict[str, Any] | None, places: Iterable[Mapping[str, Any]], place_id: str | None
) -> dict[str, Any] | None:
    """O lugar ``place_id`` com a origem (``source``: ``mundo`` ou ``jornada``), ou ``None``."""
    if not place_id:
        return None
    for p in (world or {}).get("places", []):
        if p.get("id") == place_id:
            return {"id": p["id"], "name": p.get("name"), "type": p.get("type"), "description": p.get("description"),
                    "source": "mundo"}
    for p in places:
        if p.get("id") == place_id:
            return {"id": p["id"], "name": p.get("name"), "type": p.get("type"), "description": p.get("description"),
                    "source": "jornada"}
    return None


def scene_mode(scene: dict[str, Any] | None) -> str:
    """``em_cena`` se há Cena aberta, senão ``fora_de_cena``."""
    return store.MODE_SCENE if scene is not None and scene.get("status") == "aberta" else store.MODE_OUT


def public_scene(
    scene: dict[str, Any] | None, world: dict[str, Any] | None, places: Iterable[Mapping[str, Any]] = ()
) -> dict[str, Any] | None:
    """A Cena como a API a entrega: os campos gravados, o título e o nome do lugar (Mundo ou Jornada)."""
    if scene is None:
        return None
    place = find_place(world, places, scene.get("place_id"))
    return {
        "id": scene.get("id"),
        "status": scene.get("status"),
        "title": scene_title(scene) if scene.get("id") is not None or scene.get("title") else None,
        "opening_tone": scene.get("opening_tone"),
        "place_id": scene.get("place_id"),
        "place_name": None if place is None else place.get("name"),
        "day_period": scene.get("day_period"),
        "motive": scene.get("motive"),
        "participants": list(scene.get("participants") or []),
        "objective_id": scene.get("objective_id"),
        "summary": scene.get("summary"),
        "opened_at": scene.get("opened_at"),
        "closed_at": scene.get("closed_at"),
    }


def public_proposal(
    proposal: dict[str, Any] | None, world: dict[str, Any] | None, places: Iterable[Mapping[str, Any]] = ()
) -> dict[str, Any] | None:
    """A proposta pendente para o cartão: título, lugar (``kind`` ``conhecido`` ou ``novo``), motivo e participantes."""
    if proposal is None:
        return None
    if proposal.get("place_id"):
        found = find_place(world, places, proposal["place_id"]) or {}
        place = {
            "kind": PLACE_KNOWN,
            "id": proposal["place_id"],
            "name": found.get("name"),
            "type": found.get("type"),
            "description": found.get("description"),
        }
    else:
        place = {
            "kind": PLACE_NEW,
            "id": None,
            "name": proposal.get("new_place_name"),
            "type": proposal.get("new_place_type"),
            "description": proposal.get("new_place_description"),
        }
    return {
        "id": proposal.get("id"),
        "status": proposal.get("status"),
        "title": proposal.get("title"),
        "place": place,
        "motive": proposal.get("motive"),
        "participants": list(proposal.get("participants") or []),
        "created_at": proposal.get("created_at"),
    }


# ------------------------------------------------------------------ operações do motor
def active_ambition_id(db: Any) -> int | None:
    row = db.query_one("SELECT id FROM objectives WHERE kind = 'ambicao' AND status = 'ativo'")
    return None if row is None else int(row[0])


def open_scene_with_opening(
    db: Database,
    *,
    proposal: SceneProposal,
    place_id: str,
    day_period: str,
    opening_tone: str | None,
    narration: str,
    place_name: str | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Grava, numa só transação, a Cena inicial aberta, a mensagem de abertura e o evento ``cena_aberta``.

    Recusa ``abertura_existente`` se a Jornada já tiver histórico (a Cena inicial
    só existe uma vez) e ``cena_ja_aberta`` se houver Cena aberta.
    """
    if day_period not in DAY_PERIODS:
        raise StorageError("periodo_invalido", "O período do dia da Jornada não é conhecido.")
    text = narration.strip()[: store.MESSAGE_MAX]
    if not text:
        raise ValueError("abertura vazia")
    now = utc_now_iso()
    with db.transaction() as tx:
        if store.has_history(tx):
            raise StorageError("abertura_existente", "Esta Jornada já tem abertura.")
        scene_id = store.insert_scene(
            tx,
            place_id=place_id,
            day_period=day_period,
            motive=proposal.motive,
            participants=list(proposal.participants),
            opening_tone=opening_tone,
            now=now,
            title=proposal.title,
            objective_id=active_ambition_id(tx),
        )
        message_id = store.insert_message(
            tx,
            channel=store.CHANNEL_SCENE,
            scene_id=scene_id,
            role=store.ROLE_NARRATOR,
            content=text,
            status=store.STATUS_DONE,
            now=now,
        )
        scene = store.get_scene(tx, scene_id)
        assert scene is not None
        event_store.insert_event(
            tx,
            event_store.SCENE_OPENED,
            scene_id=scene_id,
            data={"title": scene_title(scene), "place_id": place_id, "place_name": place_name},
            now=now,
        )
        message = store.get_message(tx, message_id)
    assert message is not None
    return scene, message


def open_scene_from_proposal(
    db: Database,
    *,
    proposal_id: int,
    day_period: str,
    narration: str,
    world_place_ids: Iterable[str],
    names: Mapping[str, str],
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Aceita a proposta pendente ``proposal_id`` numa só transação.

    Grava o lugar novo (se houver), a Cena aberta (título, lugar, período, motivo,
    participantes e a Ambição ativa), a mensagem de abertura, a proposta ``aceita``,
    o lugar atual (``current_place_id`` e ``location``) e os eventos ``lugar`` (se o
    lugar mudou) e ``cena_aberta``. ``names``: id → nome dos lugares (Mundo e Jornada).
    """
    if day_period not in DAY_PERIODS:
        raise StorageError("periodo_invalido", "O período do dia da Jornada não é conhecido.")
    text = narration.strip()[: store.MESSAGE_MAX]
    if not text:
        raise ValueError("abertura vazia")
    now = utc_now_iso()
    names = dict(names)
    with db.transaction() as tx:
        pending = proposal_store.pending_proposal(tx)
        if pending is None or int(pending["id"]) != proposal_id:
            raise StorageError("sem_proposta_pendente", "A proposta de Cena não está mais pendente.")
        if store.open_scene(tx) is not None:
            raise StorageError("cena_ja_aberta", "Já existe uma Cena aberta nesta Jornada.")
        place_id = pending["place_id"]
        new_place = place_id is None
        if new_place:
            name = pending["new_place_name"]
            if name.casefold() in {n.casefold() for n in names.values()}:
                raise StorageError("lugar_duplicado", f"Já existe um lugar chamado '{name}'. Peça outra proposta.")
            place_id = place_store.next_place_id(tx, world_place_ids)
            place_store.insert_place(
                tx,
                place_id=place_id,
                name=name,
                type_=pending["new_place_type"],
                description=pending["new_place_description"] or "",
                scene_id=None,
                now=now,
            )
            names[place_id] = name
        elif place_id not in names:
            raise StorageError("lugar_desconhecido", "O lugar da proposta não existe mais.")
        scene_id = store.insert_scene(
            tx,
            place_id=place_id,
            day_period=day_period,
            motive=pending["motive"],
            participants=list(pending["participants"]),
            opening_tone=None,
            now=now,
            title=pending["title"],
            objective_id=active_ambition_id(tx),
        )
        if new_place:
            place_store.set_place_scene(tx, place_id, scene_id)
        message_id = store.insert_message(
            tx,
            channel=store.CHANNEL_SCENE,
            scene_id=scene_id,
            role=store.ROLE_NARRATOR,
            content=text,
            status=store.STATUS_DONE,
            now=now,
        )
        proposal_store.decide(tx, proposal_id, proposal_store.ACCEPTED, now, scene_id)
        meta = tx.query_one("SELECT current_place_id FROM journey_meta")
        previous = None if meta is None else meta["current_place_id"]
        if previous != place_id:
            tx.execute("UPDATE journey_meta SET current_place_id = ?, location = ?", (place_id, names[place_id]))
            event_store.insert_event(
                tx,
                event_store.PLACE_CHANGED,
                scene_id=scene_id,
                data={
                    "place_id": place_id,
                    "place_name": names[place_id],
                    "new_place": new_place,
                    "previous_place_id": previous,
                    "previous_place_name": names.get(previous) if previous else None,
                },
                now=now,
            )
        event_store.insert_event(
            tx,
            event_store.SCENE_OPENED,
            scene_id=scene_id,
            data={"title": pending["title"], "place_id": place_id, "place_name": names[place_id]},
            now=now,
        )
        tx.execute("UPDATE journey_meta SET last_saved_at = ?", (now,))
        scene = store.get_scene(tx, scene_id)
        message = store.get_message(tx, message_id)
    assert scene is not None and message is not None
    return scene, message


def close_open_scene(db: Database, summary: str) -> dict[str, Any]:
    """Encerra a Cena aberta com o resumo validado e grava ``cena_encerrada`` (uma transação).

    ``sem_cena_aberta`` se não houver Cena aberta.
    """
    now = utc_now_iso()
    with db.transaction() as tx:
        scene_id = store.close_scene(tx, summary, now)
        scene = store.get_scene(tx, scene_id)
        assert scene is not None
        event_store.insert_event(
            tx,
            event_store.SCENE_CLOSED,
            scene_id=scene_id,
            data={"title": scene_title(scene), "summary": summary},
            now=now,
        )
    return scene


def rename_scene(db: Database, scene_id: int, title: Any) -> dict[str, Any]:
    """Troca o título de uma Cena (aberta ou encerrada) e grava ``cena_renomeada``.

    ``titulo_invalido`` (1 a 80, uma linha) ou ``cena_nao_encontrada``. O mesmo título não grava nada.
    """
    clean = check_title(title)
    now = utc_now_iso()
    with db.transaction() as tx:
        scene = store.get_scene(tx, scene_id)
        if scene is None:
            raise StorageError("cena_nao_encontrada", "Cena não encontrada.")
        previous = scene_title(scene)
        if scene.get("title") != clean:
            store.set_scene_title(tx, scene_id, clean)
            event_store.insert_event(
                tx,
                event_store.SCENE_RENAMED,
                scene_id=scene_id,
                data={"title": clean, "previous_title": previous},
                now=now,
            )
        scene = store.get_scene(tx, scene_id)
    assert scene is not None
    return scene


def save_pending_proposal(db: Database, proposal: AduranProposal) -> dict[str, Any]:
    """Grava a proposta validada como pendente (a pendente anterior vira ``substituida``)."""
    now = utc_now_iso()
    new_place = (
        None if proposal.new_place is None
        else (proposal.new_place.name, proposal.new_place.type, proposal.new_place.description)
    )
    with db.transaction() as tx:
        if store.open_scene(tx) is not None:
            raise StorageError("cena_ja_aberta", "O Aduran só propõe Cenas Fora de Cena.")
        proposal_id = proposal_store.insert_pending(
            tx,
            title=proposal.title,
            place_id=proposal.place_id,
            new_place=new_place,
            motive=proposal.motive,
            participants=list(proposal.participants),
            now=now,
        )
        saved = proposal_store.get_proposal(tx, proposal_id)
    assert saved is not None
    return saved


def decline_pending_proposal(db: Database) -> dict[str, Any]:
    """Marca a proposta pendente como ``recusada``. ``sem_proposta_pendente`` se não houver."""
    now = utc_now_iso()
    with db.transaction() as tx:
        pending = proposal_store.pending_proposal(tx)
        if pending is None:
            raise StorageError("sem_proposta_pendente", "Não há proposta de Cena pendente.")
        proposal_store.decide(tx, int(pending["id"]), proposal_store.DECLINED, now)
        saved = proposal_store.get_proposal(tx, int(pending["id"]))
    assert saved is not None
    return saved


__all__ = [
    "ADURAN_PROPOSAL_SCHEMA",
    "MARKER",
    "RETRIES",
    "SCENE_PROPOSAL_SCHEMA",
    "SCENE_SUMMARY_SCHEMA",
    "TITLE_MAX",
    "AduranProposal",
    "InvalidProposal",
    "NewPlace",
    "ProposalRejected",
    "SceneProposal",
    "active_ambition_id",
    "check_title",
    "close_open_scene",
    "decline_pending_proposal",
    "find_place",
    "held_from",
    "open_scene_from_proposal",
    "open_scene_with_opening",
    "parse_aduran_proposal",
    "parse_scene_proposal",
    "parse_scene_summary",
    "place_names",
    "public_proposal",
    "public_scene",
    "rename_scene",
    "request_valid",
    "save_pending_proposal",
    "scene_mode",
    "scene_title",
    "strip_marker",
]
