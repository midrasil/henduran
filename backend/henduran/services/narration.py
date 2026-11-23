"""Narrador na Jornada aberta (ADR-076): abertura da Cena inicial, mensagens e encerramento.

As funções ``prepare_*`` e ``load_*`` são síncronas (as rotas as chamam via
``asyncio.to_thread``) e conferem as pré-condições antes de qualquer geração;
as funções ``run_*`` são geradores assíncronos de eventos ``(nome, dados)``,
que a API converte em SSE.

Regras:

- **Abertura**: tom sorteado → proposta estruturada validada (com novas
  tentativas) → evento ``scene`` → narração em *streaming* → no fim, uma
  transação grava a Cena aberta e a mensagem do Narrador. Cancelamento ou erro
  em qualquer ponto não grava nada.
- **Mensagem**: a do jogador é gravada antes da geração, no canal atual; a
  resposta é gravada ``concluida`` ou, se cancelada, ``cancelada`` com o texto
  parcial (sem nenhum fragmento, nada é gravado). Erro do provedor: só a do
  jogador fica.
- **Encerramento**: resumo estruturado validado → a Cena é encerrada com o resumo
  numa transação. Se o provedor falhar, a Cena continua aberta.
- O texto narrado nunca grava estado: só as operações validadas gravam.
"""

from __future__ import annotations

import asyncio
import logging
import random
from collections.abc import AsyncIterator, Awaitable
from dataclasses import dataclass
from typing import Any, TypeVar

from henduran.db.connection import utc_now_iso
from henduran.narrative import context as ctx
from henduran.narrative import scene as engine
from henduran.narrative.periods import DAY_PERIODS
from henduran.narrative.tones import Tone, draw_tone
from henduran.providers.base import ChatMessage, NarratorProvider
from henduran.storage import scenes as store
from henduran.storage.errors import StorageError
from henduran.storage.journeys import OpenJourney

log = logging.getLogger("henduran.services")

PLAYER_MESSAGE_MAX = 4000

Event = tuple[str, dict[str, Any]]
T = TypeVar("T")


class NarrationFailed(Exception):
    """A geração não produziu um resultado utilizável (ex.: texto vazio)."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


class _Cancelled(Exception):
    pass


async def until_cancelled(awaitable: Awaitable[T], cancel: asyncio.Event) -> T:
    """Espera ``awaitable``; se ``cancel`` for acionado antes, interrompe e levanta ``_Cancelled``."""
    task = asyncio.ensure_future(awaitable)
    waiter = asyncio.ensure_future(cancel.wait())
    try:
        await asyncio.wait({task, waiter}, return_when=asyncio.FIRST_COMPLETED)
    finally:
        waiter.cancel()
        if not task.done():
            task.cancel()
    if cancel.is_set() or task.cancelled():
        raise _Cancelled
    return task.result()


@dataclass(frozen=True)
class JourneyState:
    """O que o Narrador precisa saber da Jornada aberta (lido de uma vez)."""

    world: dict[str, Any] | None
    character: dict[str, Any] | None
    meta: dict[str, Any]
    scene: dict[str, Any] | None
    previous: list[dict[str, Any]]


def load_state(journey: OpenJourney) -> JourneyState:
    return JourneyState(
        world=journey.world_content(),
        character=journey.character_sheet(),
        meta=journey.summary(),
        scene=store.open_scene(journey.db),
        previous=store.closed_scenes(journey.db, ctx.RECENT_SUMMARIES),
    )


def chat_view(journey: OpenJourney) -> dict[str, Any]:
    """``{mode, scene}`` da Jornada aberta: ``scene`` é a Cena aberta (``None`` Fora de Cena)."""
    scene = store.open_scene(journey.db)
    return {"mode": engine.scene_mode(scene), "scene": engine.public_scene(scene, journey.world_content())}


def history_view(journey: OpenJourney) -> dict[str, Any]:
    """``{mode, scene, messages}``: todas as mensagens, inclusive as canceladas, com o estado de cada uma."""
    return {**chat_view(journey), "messages": store.all_messages(journey.db)}


# ------------------------------------------------------------------ abertura
@dataclass(frozen=True)
class OpeningPlan:
    state: JourneyState
    place_id: str
    place: dict[str, Any] | None
    day_period: str


def prepare_opening(journey: OpenJourney) -> OpeningPlan:
    """Confere se a abertura pode ser gerada: sem histórico, com personagem, lugar e período conhecidos."""
    if store.has_history(journey.db):
        raise StorageError("abertura_existente", "Esta Jornada já tem abertura.")
    state = load_state(journey)
    if state.character is None:
        raise StorageError("personagem_ausente", "A Jornada ainda não tem personagem.")
    place_id = state.meta.get("start_place_id")
    place = ctx.place_by_id(state.world, place_id)
    if place is None and not place_id:
        # Jornada criada antes de gravar o id do lugar inicial: procura pelo nome do local.
        location = state.meta.get("location")
        place = next((p for p in (state.world or {}).get("places", []) if p.get("name") == location), None)
        place_id = None if place is None else place["id"]
    if place is None or not place_id:
        raise StorageError("lugar_inicial_ausente", "O lugar inicial da Jornada não está entre os lugares do Mundo.")
    day_period = state.meta.get("day_period")
    if day_period not in DAY_PERIODS:
        raise StorageError("periodo_invalido", "O período do dia da Jornada não é conhecido.")
    return OpeningPlan(state=state, place_id=place_id, place=place, day_period=day_period)


async def run_opening(
    provider: NarratorProvider,
    journey: OpenJourney,
    plan: OpeningPlan,
    cancel: asyncio.Event,
    *,
    rng: random.Random | None = None,
) -> AsyncIterator[Event]:
    """Gera a Cena inicial. Só grava no fim, numa transação; cancelada ou com erro, nada fica gravado."""
    tone: Tone = draw_tone(rng)
    state = plan.state
    proposal_messages = ctx.opening_proposal_context(
        world=state.world,
        character=state.character,
        day_period=plan.day_period,
        place=plan.place,
        place_id=plan.place_id,
        tone=tone,
    )

    async def complete(messages: list[ChatMessage]) -> str:
        return await provider.complete(messages, json_schema=engine.SCENE_PROPOSAL_SCHEMA)

    try:
        proposal = await until_cancelled(
            engine.request_valid(complete, proposal_messages, engine.parse_scene_proposal), cancel
        )
    except _Cancelled:
        yield "done", {"reason": "cancelled"}
        return
    proposed = {
        "id": None,
        "status": "proposta",
        "opening_tone": tone.id,
        "place_id": plan.place_id,
        "day_period": plan.day_period,
        "motive": proposal.motive,
        "participants": list(proposal.participants),
        "summary": None,
        "opened_at": None,
        "closed_at": None,
    }
    yield "scene", {"scene": engine.public_scene(proposed, state.world)}

    narration_messages = ctx.opening_narration_context(
        world=state.world, character=state.character, scene=proposed, tone=tone
    )
    parts: list[str] = []
    async for chunk in provider.stream_chat(narration_messages, cancel=cancel):
        if cancel.is_set():
            break
        parts.append(chunk)
        yield "token", {"text": chunk}
    if cancel.is_set():
        yield "done", {"reason": "cancelled"}
        return
    narration = "".join(parts)
    if not narration.strip():
        raise NarrationFailed("generation_failed", "O Narrador não escreveu a abertura. Nada foi gravado; tente de novo.")
    scene, message = await asyncio.to_thread(
        engine.open_scene_with_opening,
        journey.db,
        proposal=proposal,
        place_id=plan.place_id,
        day_period=plan.day_period,
        opening_tone=tone.id,
        narration=narration,
    )
    yield "done", {
        "reason": "completed",
        "mode": store.MODE_SCENE,
        "scene": engine.public_scene(scene, state.world),
        "message": message,
    }


# ------------------------------------------------------------------ mensagens
@dataclass(frozen=True)
class ReplyPlan:
    channel: str
    scene_id: int | None
    player_message: dict[str, Any]


def check_player_text(content: Any) -> str:
    """Texto do jogador: 1 a ``PLAYER_MESSAGE_MAX`` caracteres (sem os espaços das pontas)."""
    if not isinstance(content, str) or "\x00" in content:
        raise StorageError("mensagem_invalida", "A mensagem deve ser texto.")
    text = content.strip()
    if not text or len(text) > PLAYER_MESSAGE_MAX:
        raise StorageError("mensagem_invalida", f"A mensagem deve ter de 1 a {PLAYER_MESSAGE_MAX} caracteres.")
    return text


def prepare_reply(journey: OpenJourney, content: str) -> ReplyPlan:
    """Grava a mensagem do jogador no canal atual (Cena aberta → ``cena``; senão ``fora_de_cena``)."""
    text = check_player_text(content)
    now = utc_now_iso()
    with journey.db.transaction() as tx:
        if not store.has_history(tx):
            raise StorageError("abertura_pendente", "A Jornada ainda não tem abertura. Gere a abertura primeiro.")
        scene = store.open_scene(tx)
        channel = store.CHANNEL_SCENE if scene is not None else store.CHANNEL_OUT
        scene_id = None if scene is None else int(scene["id"])
        message_id = store.insert_message(
            tx, channel=channel, scene_id=scene_id, role=store.ROLE_PLAYER, content=text,
            status=store.STATUS_DONE, now=now,
        )
        message = store.get_message(tx, message_id)
    assert message is not None
    return ReplyPlan(channel=channel, scene_id=scene_id, player_message=message)


def reply_context(journey: OpenJourney, plan: ReplyPlan) -> list[ChatMessage]:
    state = load_state(journey)
    scene = state.scene if plan.channel == store.CHANNEL_SCENE else None
    history = store.recent_messages(journey.db, plan.channel, plan.scene_id, ctx.RECENT_MESSAGES)
    return ctx.chat_context(
        world=state.world,
        character=state.character,
        day_period=state.meta.get("day_period"),
        scene=scene,
        history=history,
        previous=state.previous,
    )


def save_reply(journey: OpenJourney, plan: ReplyPlan, text: str, status: str) -> dict[str, Any] | None:
    """Grava a resposta do Narrador (``None`` se não houver texto)."""
    content = text.strip()[: store.MESSAGE_MAX]
    if not content:
        return None
    with journey.db.transaction() as tx:
        message_id = store.insert_message(
            tx, channel=plan.channel, scene_id=plan.scene_id, role=store.ROLE_NARRATOR,
            content=content, status=status, now=utc_now_iso(),
        )
        return store.get_message(tx, message_id)


async def run_reply(
    provider: NarratorProvider, journey: OpenJourney, plan: ReplyPlan, cancel: asyncio.Event
) -> AsyncIterator[Event]:
    """Gera e grava a resposta do Narrador no canal da mensagem do jogador."""
    messages = await asyncio.to_thread(reply_context, journey, plan)
    parts: list[str] = []
    try:
        async for chunk in provider.stream_chat(messages, cancel=cancel):
            if cancel.is_set():
                break
            parts.append(chunk)
            yield "token", {"text": chunk}
    except asyncio.CancelledError:
        # Conexão fechada pelo cliente: guarda o texto parcial como cancelado (escrita curta e local).
        cancel.set()
        try:
            save_reply(journey, plan, "".join(parts), store.STATUS_CANCELLED)
        except Exception:  # noqa: BLE001 — a desconexão não pode virar outro erro
            log.exception("não foi possível gravar a resposta interrompida")
        raise
    text = "".join(parts)
    if cancel.is_set():
        saved = await asyncio.to_thread(save_reply, journey, plan, text, store.STATUS_CANCELLED)
        yield "done", {"reason": "cancelled", "message": saved}
        return
    if not text.strip():
        raise NarrationFailed("generation_failed", "O Narrador não respondeu. Tente de novo.")
    saved = await asyncio.to_thread(save_reply, journey, plan, text, store.STATUS_DONE)
    yield "done", {"reason": "completed", "message": saved}


# ------------------------------------------------------------------ encerramento
@dataclass(frozen=True)
class ClosePlan:
    state: JourneyState
    scene: dict[str, Any]
    history: list[dict[str, Any]]


def prepare_close(journey: OpenJourney) -> ClosePlan:
    state = load_state(journey)
    if state.scene is None:
        raise StorageError("sem_cena_aberta", "Não há Cena aberta para encerrar.")
    history = store.recent_messages(journey.db, store.CHANNEL_SCENE, int(state.scene["id"]), ctx.RECENT_MESSAGES)
    return ClosePlan(state=state, scene=state.scene, history=history)


async def run_close(provider: NarratorProvider, journey: OpenJourney, plan: ClosePlan) -> dict[str, Any]:
    """Pede o resumo, valida e encerra a Cena. Devolve ``{mode, scene}`` (a Cena encerrada)."""
    messages = ctx.summary_context(
        world=plan.state.world, character=plan.state.character, scene=plan.scene, history=plan.history
    )

    async def complete(msgs: list[ChatMessage]) -> str:
        return await provider.complete(msgs, json_schema=engine.SCENE_SUMMARY_SCHEMA)

    summary = await engine.request_valid(complete, messages, engine.parse_scene_summary)
    scene = await asyncio.to_thread(engine.close_open_scene, journey.db, summary)
    return {"mode": store.MODE_OUT, "scene": engine.public_scene(scene, plan.state.world)}


__all__ = [
    "PLAYER_MESSAGE_MAX",
    "ClosePlan",
    "JourneyState",
    "NarrationFailed",
    "OpeningPlan",
    "ReplyPlan",
    "chat_view",
    "check_player_text",
    "history_view",
    "load_state",
    "prepare_close",
    "prepare_opening",
    "prepare_reply",
    "run_close",
    "run_opening",
    "run_reply",
]
