"""Ciclo de Cena do MVP (ADR-076): propostas estruturadas, validação e operações do motor.

- A **proposta de Cena** do Narrador traz só ``motive`` e ``participants``; o
  lugar (lugar inicial da Jornada) e o período (``day_period`` atual) vêm do motor.
- O **resumo de encerramento** traz só ``summary``.
- O motor valida cada proposta de forma estrita. Proposta inválida: até
  ``RETRIES`` novas tentativas, depois o erro ``proposta_invalida``, sem inventar
  nada.
- Abrir e encerrar Cena só acontecem pelas operações daqui, numa transação. O
  texto narrado nunca grava estado (critério 6 do MVP).
"""

from __future__ import annotations

import json
import re
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any, TypeVar

from henduran.db.connection import Database, utc_now_iso
from henduran.narrative.periods import DAY_PERIODS
from henduran.providers.base import ChatMessage
from henduran.storage import scenes as store
from henduran.storage.errors import StorageError

MOTIVE_MAX = 300
PARTICIPANTS_MAX = 6
PARTICIPANT_MAX = 80
SUMMARY_MAX = 2000
RETRIES = 2  # novas tentativas depois da primeira proposta inválida

SCENE_PROPOSAL_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "motive": {"type": "string", "minLength": 1, "maxLength": MOTIVE_MAX},
        "participants": {
            "type": "array",
            "maxItems": PARTICIPANTS_MAX,
            "items": {"type": "string", "minLength": 1, "maxLength": PARTICIPANT_MAX},
        },
    },
    "required": ["motive", "participants"],
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


def _clean_text(value: Any, field: str, maximum: int) -> str:
    if not isinstance(value, str):
        raise InvalidProposal(f"'{field}' deve ser texto.")
    text = value.strip()
    if not text:
        raise InvalidProposal(f"'{field}' não pode ser vazio.")
    if len(text) > maximum:
        raise InvalidProposal(f"'{field}' passa de {maximum} caracteres.")
    if "\x00" in text:
        raise InvalidProposal(f"'{field}' tem caracteres inválidos.")
    return text


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
    missing = [k for k in keys if k not in data]
    extra = [k for k in data if k not in keys]
    if missing:
        raise InvalidProposal(f"Faltam as chaves: {', '.join(missing)}.")
    if extra:
        raise InvalidProposal(f"Chaves desconhecidas: {', '.join(str(k)[:40] for k in extra)}.")
    return data


def parse_scene_proposal(raw: str) -> SceneProposal:
    """Valida a proposta de Cena (``{motive, participants}``). Levanta :class:`InvalidProposal`."""
    data = _load_object(raw, ("motive", "participants"))
    motive = _clean_text(data["motive"], "motive", MOTIVE_MAX)
    items = data["participants"]
    if not isinstance(items, list):
        raise InvalidProposal("'participants' deve ser uma lista.")
    if len(items) > PARTICIPANTS_MAX:
        raise InvalidProposal(f"'participants' tem mais de {PARTICIPANTS_MAX} itens.")
    participants = tuple(_clean_text(p, "participants", PARTICIPANT_MAX) for p in items)
    return SceneProposal(motive=motive, participants=participants)


def parse_scene_summary(raw: str) -> str:
    """Valida o resumo de encerramento (``{summary}``). Levanta :class:`InvalidProposal`."""
    data = _load_object(raw, ("summary",))
    return _clean_text(data["summary"], "summary", SUMMARY_MAX)


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


# ------------------------------------------------------------------ operações do motor
def scene_mode(scene: dict[str, Any] | None) -> str:
    """``em_cena`` se há Cena aberta, senão ``fora_de_cena``."""
    return store.MODE_SCENE if scene is not None and scene.get("status") == "aberta" else store.MODE_OUT


def public_scene(scene: dict[str, Any] | None, world: dict[str, Any] | None) -> dict[str, Any] | None:
    """A Cena como a API a entrega: os campos gravados e o nome do lugar (do Mundo)."""
    if scene is None:
        return None
    place = next((p for p in (world or {}).get("places", []) if p.get("id") == scene.get("place_id")), None)
    return {
        "id": scene.get("id"),
        "status": scene.get("status"),
        "opening_tone": scene.get("opening_tone"),
        "place_id": scene.get("place_id"),
        "place_name": None if place is None else place.get("name"),
        "day_period": scene.get("day_period"),
        "motive": scene.get("motive"),
        "participants": list(scene.get("participants") or []),
        "summary": scene.get("summary"),
        "opened_at": scene.get("opened_at"),
        "closed_at": scene.get("closed_at"),
    }


def open_scene_with_opening(
    db: Database,
    *,
    proposal: SceneProposal,
    place_id: str,
    day_period: str,
    opening_tone: str | None,
    narration: str,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Grava, numa só transação, a Cena aberta e a mensagem de abertura do Narrador.

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
        message = store.get_message(tx, message_id)
    assert scene is not None and message is not None
    return scene, message


def close_open_scene(db: Database, summary: str) -> dict[str, Any]:
    """Encerra a Cena aberta com o resumo validado (uma transação). ``sem_cena_aberta`` se não houver."""
    now = utc_now_iso()
    with db.transaction() as tx:
        scene_id = store.close_scene(tx, summary, now)
        scene = store.get_scene(tx, scene_id)
    assert scene is not None
    return scene


__all__ = [
    "RETRIES",
    "SCENE_PROPOSAL_SCHEMA",
    "SCENE_SUMMARY_SCHEMA",
    "InvalidProposal",
    "ProposalRejected",
    "SceneProposal",
    "close_open_scene",
    "open_scene_with_opening",
    "parse_scene_proposal",
    "parse_scene_summary",
    "public_scene",
    "request_valid",
    "scene_mode",
]
