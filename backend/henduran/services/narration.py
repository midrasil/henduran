"""Narrador na Jornada aberta (ADR-076): abertura, mensagens, propostas de Cena, encerramento e leitura.

As funções ``prepare_*`` e ``load_*``/``*_view`` são síncronas (as rotas as chamam via
``asyncio.to_thread``) e conferem as pré-condições antes de qualquer geração;
as funções ``run_*`` são geradores assíncronos de eventos ``(nome, dados)``,
que a API converte em SSE (exceto ``run_close`` e ``run_reroll``, que devolvem JSON).

Regras:

- **Abertura**: tom sorteado → proposta estruturada validada (título, motivo e
  participantes, com novas tentativas) → evento ``scene`` → narração em *streaming* →
  no fim, uma transação grava a Cena aberta, a mensagem do Narrador e o evento
  ``cena_aberta``. Cancelamento ou erro em qualquer ponto não grava nada.
- **Mensagem**: a do jogador é gravada antes da geração, no canal pedido (padrão:
  o canal atual); a resposta é gravada ``concluida`` ou, se cancelada, ``cancelada``
  com o texto parcial (sem nenhum fragmento, nada é gravado). Erro do provedor: só a
  do jogador fica. Com Cena aberta e canal ``fora_de_cena``, o Aduran responde com o
  resumo da Cena só como referência; essas mensagens nunca entram no contexto do
  Narrador da Cena.
- **Marcação de proposta** (``[[propor_cena]]``, ADR-076, item 17): reconhecida só no
  fim da resposta. Nunca é enviada à interface nem gravada (o fim da resposta fica
  retido até se saber se é a marcação). Fora de Cena, sem Cena aberta, faz o serviço
  pedir a proposta estruturada ao Aduran, validar e gravar como pendente; evento
  ``proposal`` (ou ``proposal_error``, sem desfazer a resposta) antes do ``done``. Em
  Cena, ou com Cena aberta, é só removida.
- **Aceitar a proposta**: evento ``scene`` → narração → uma transação grava lugar
  novo, Cena, mensagem, proposta ``aceita``, lugar atual e eventos. Cancelou ou deu
  erro: nada é gravado e a proposta continua pendente.
- **Regenerar**: a última resposta do Narrador no canal é refeita com o mesmo
  contexto e **substitui a anterior no mesmo id** só quando a nova tem ao menos um
  fragmento (concluída, ou cancelada com o texto parcial). Cancelada sem nenhum
  fragmento ou com erro: a anterior fica como estava. A abertura de uma Cena (a
  primeira mensagem dela) é refeita com o contexto de abertura, mantendo a Cena.
- **Continuar**: pede ao modelo que continue a última resposta do Narrador e anexa o
  texto novo à mesma mensagem (até 20000 caracteres): ``concluida`` ao terminar,
  ``cancelada`` se cancelar; sem nenhum fragmento, a mensagem fica como estava.
- **Encerramento**: resumo estruturado validado → a Cena é encerrada com o resumo e o
  evento ``cena_encerrada`` numa transação. Se o provedor falhar, a Cena continua aberta.
- O texto narrado nunca grava estado: só as operações validadas gravam.
"""

from __future__ import annotations

import asyncio
import functools
import logging
import random
from collections.abc import AsyncIterator, Awaitable
from dataclasses import dataclass, field
from typing import Any, TypeVar

from henduran.db.connection import DatabaseError, utc_now_iso
from henduran.narrative import context as ctx
from henduran.narrative import scene as engine
from henduran.narrative.calendar import date_view
from henduran.narrative.periods import DAY_PERIODS
from henduran.narrative.tones import TONES_BY_ID, Tone, draw_tone
from henduran.providers.base import ChatMessage, NarratorProvider, ProviderUnavailable
from henduran.storage import events as event_store
from henduran.storage import places as place_store
from henduran.storage import proposals as proposal_store
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


# ------------------------------------------------------------------ estado
@dataclass(frozen=True)
class JourneyState:
    """O que o Narrador precisa saber da Jornada aberta (lido de uma vez)."""

    world: dict[str, Any] | None
    character: dict[str, Any] | None
    meta: dict[str, Any]
    scene: dict[str, Any] | None
    previous: list[dict[str, Any]]
    places: list[dict[str, Any]] = field(default_factory=list)  # lugares da Jornada

    @property
    def date(self) -> dict[str, Any] | None:
        m = self.meta
        return date_view(self.world, m.get("calendar_year"), m.get("calendar_month"), m.get("calendar_day"))

    @property
    def current_place(self) -> dict[str, Any] | None:
        return engine.find_place(self.world, self.places, self.meta.get("current_place_id"))

    @property
    def place_names(self) -> dict[str, str]:
        return engine.place_names(self.world, self.places)


def load_state(journey: OpenJourney) -> JourneyState:
    return JourneyState(
        world=journey.world_content(),
        character=journey.character_sheet(),
        meta=journey.summary(),
        scene=store.open_scene(journey.db),
        previous=store.closed_scenes(journey.db, ctx.RECENT_SUMMARIES),
        places=place_store.journey_places(journey.db),
    )


def chat_view(journey: OpenJourney) -> dict[str, Any]:
    """``{mode, scene, proposal}``: a Cena aberta (``None`` Fora de Cena) e a proposta pendente (ou ``None``)."""
    world = journey.world_content()
    places = place_store.journey_places(journey.db)
    scene = store.open_scene(journey.db)
    return {
        "mode": engine.scene_mode(scene),
        "scene": engine.public_scene(scene, world, places),
        "proposal": engine.public_proposal(proposal_store.pending_proposal(journey.db), world, places),
    }


def history_view(journey: OpenJourney) -> dict[str, Any]:
    """``{mode, scene, proposal, messages}``: todas as mensagens, inclusive as canceladas, com o estado de cada uma."""
    return {**chat_view(journey), "messages": store.all_messages(journey.db)}


def journey_view(journey: OpenJourney) -> dict[str, Any]:
    """``{current_place, calendar}`` para o *snapshot* da Jornada aberta."""
    state = load_state(journey)
    return {"current_place": state.current_place, "calendar": state.date}


def _pending_public(journey: OpenJourney) -> dict[str, Any] | None:
    return engine.public_proposal(
        proposal_store.pending_proposal(journey.db), journey.world_content(), place_store.journey_places(journey.db)
    )


# ------------------------------------------------------------------ streaming com a marcação retida
class _MarkerFilter:
    """Acumula a resposta e libera só o que com certeza não é a marcação do fim (ver ``engine.held_from``).

    ``limit``: nada além desse tamanho é liberado nem guardado (continuar uma mensagem).
    """

    def __init__(self, limit: int = store.MESSAGE_MAX) -> None:
        self.text = ""
        self.emitted = 0
        self.limit = limit

    @property
    def full(self) -> bool:
        return len(self.text) >= self.limit

    def feed(self, chunk: str) -> str:
        self.text += chunk
        upto = min(engine.held_from(self.text, self.emitted), self.limit)
        out = self.text[self.emitted:upto] if upto > self.emitted else ""
        self.emitted = max(self.emitted, upto)
        return out

    def emitted_text(self) -> str:
        return self.text[: self.emitted]

    def finish(self) -> tuple[str, str, bool]:
        """``(resto a enviar, texto final sem a marcação, se havia marcação)``."""
        final, found = engine.strip_marker(self.text[: self.limit])
        if not found:
            final = self.text[: self.limit]
        rest = final[self.emitted:] if len(final) > self.emitted else ""
        self.emitted = max(self.emitted, len(final))
        return rest, final, found


async def _stream_tokens(
    provider: NarratorProvider, messages: list[ChatMessage], cancel: asyncio.Event, filt: _MarkerFilter
) -> AsyncIterator[Event]:
    async for chunk in provider.stream_chat(messages, cancel=cancel):
        if cancel.is_set():
            break
        out = filt.feed(chunk)
        if out:
            yield "token", {"text": out}
        if filt.full:
            break


# ------------------------------------------------------------------ proposta de Cena do Aduran
async def _propose(
    provider: NarratorProvider,
    journey: OpenJourney,
    cancel: asyncio.Event,
    *,
    replacing: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Pede a proposta de Cena ao Aduran, valida, grava como pendente e devolve a forma pública."""
    state = await asyncio.to_thread(load_state, journey)
    history = await asyncio.to_thread(store.recent_messages, journey.db, store.CHANNEL_OUT, None, ctx.RECENT_MESSAGES)
    messages = ctx.aduran_proposal_context(
        world=state.world,
        character=state.character,
        day_period=state.meta.get("day_period"),
        history=history,
        previous=state.previous,
        places=state.places,
        current_place=state.current_place,
        date=state.date,
        replacing=replacing,
    )
    parse = functools.partial(engine.parse_aduran_proposal, known=state.place_names)

    async def complete(msgs: list[ChatMessage]) -> str:
        return await provider.complete(msgs, json_schema=engine.ADURAN_PROPOSAL_SCHEMA)

    proposal = await until_cancelled(engine.request_valid(complete, messages, parse), cancel)
    saved = await asyncio.to_thread(engine.save_pending_proposal, journey.db, proposal)
    return engine.public_proposal(saved, state.world, state.places) or {}


async def _proposal_events(provider: NarratorProvider, journey: OpenJourney, cancel: asyncio.Event) -> AsyncIterator[Event]:
    """``proposal`` com a proposta gravada, ou ``proposal_error`` (a resposta do Aduran continua gravada)."""
    try:
        public = await _propose(provider, journey, cancel)
    except _Cancelled:
        yield "proposal_error", {"code": "proposta_cancelada", "message": "A proposta de Cena foi cancelada."}
    except ProviderUnavailable as exc:
        yield "proposal_error", {"code": exc.code, "message": str(exc)}
    except engine.ProposalRejected as exc:
        log.warning("proposta de Cena do Aduran recusada: %s", exc.reasons)
        yield "proposal_error", {"code": exc.code, "message": "O Aduran não conseguiu propor uma Cena válida."}
    except (StorageError, DatabaseError) as exc:
        log.error("erro ao gravar a proposta de Cena (%s): %s", exc.code, exc)
        yield "proposal_error", {"code": exc.code, "message": str(exc)}
    except Exception:  # noqa: BLE001 — a falha da proposta não invalida a resposta do Aduran
        log.exception("falha ao pedir a proposta de Cena")
        yield "proposal_error", {"code": "generation_failed", "message": "Falha ao pedir a proposta de Cena."}
    else:
        yield "proposal", {"proposal": public}


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
        date=state.date,
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
        "title": proposal.title,
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
        world=state.world, character=state.character, scene=proposed, tone=tone, date=state.date
    )
    filt = _MarkerFilter()
    async for event in _stream_tokens(provider, narration_messages, cancel, filt):
        yield event
    if cancel.is_set():
        yield "done", {"reason": "cancelled"}
        return
    rest, narration, _ = filt.finish()  # marcação em Cena: só removida
    if rest:
        yield "token", {"text": rest}
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
        place_name=(plan.place or {}).get("name"),
    )
    yield "done", {
        "reason": "completed",
        "mode": store.MODE_SCENE,
        "scene": engine.public_scene(scene, state.world, state.places),
        "message": message,
    }


# ------------------------------------------------------------------ canal
def _resolve_channel(db: Any, requested: Any) -> tuple[str, int | None, dict[str, Any] | None]:
    """``(canal, Cena de origem, Cena aberta)``. Sem pedido, o canal atual."""
    scene = store.open_scene(db)
    if requested is None:
        channel = store.CHANNEL_SCENE if scene is not None else store.CHANNEL_OUT
    elif requested not in store.CHANNELS:
        raise StorageError("canal_invalido", "O canal deve ser 'fora_de_cena' ou 'cena'.")
    elif requested == store.CHANNEL_SCENE and scene is None:
        raise StorageError("sem_cena_aberta", "Não há Cena aberta para conversar com o Narrador da Cena.")
    else:
        channel = requested
    scene_id = int(scene["id"]) if channel == store.CHANNEL_SCENE and scene is not None else None
    return channel, scene_id, scene


def check_channel(channel: Any) -> None:
    if channel is not None and channel not in store.CHANNELS:
        raise StorageError("canal_invalido", "O canal deve ser 'fora_de_cena' ou 'cena'.")


# ------------------------------------------------------------------ mensagens
@dataclass(frozen=True)
class ReplyPlan:
    channel: str
    scene_id: int | None  # Cena de origem (só no canal ``cena``)
    player_message: dict[str, Any] | None
    open_scene_id: int | None = None  # Cena aberta no momento (referência do Aduran)

    @property
    def allow_proposal(self) -> bool:
        """O Aduran só propõe Cena Fora de Cena, sem Cena aberta."""
        return self.channel == store.CHANNEL_OUT and self.open_scene_id is None


def check_player_text(content: Any) -> str:
    """Texto do jogador: 1 a ``PLAYER_MESSAGE_MAX`` caracteres (sem os espaços das pontas)."""
    if not isinstance(content, str) or "\x00" in content:
        raise StorageError("mensagem_invalida", "A mensagem deve ser texto.")
    text = content.strip()
    if not text or len(text) > PLAYER_MESSAGE_MAX:
        raise StorageError("mensagem_invalida", f"A mensagem deve ter de 1 a {PLAYER_MESSAGE_MAX} caracteres.")
    return text


def prepare_reply(journey: OpenJourney, content: str, channel: str | None = None) -> ReplyPlan:
    """Grava a mensagem do jogador no canal pedido (padrão: Cena aberta → ``cena``; senão ``fora_de_cena``)."""
    text = check_player_text(content)
    now = utc_now_iso()
    with journey.db.transaction() as tx:
        if not store.has_history(tx):
            raise StorageError("abertura_pendente", "A Jornada ainda não tem abertura. Gere a abertura primeiro.")
        channel, scene_id, scene = _resolve_channel(tx, channel)
        message_id = store.insert_message(
            tx, channel=channel, scene_id=scene_id, role=store.ROLE_PLAYER, content=text,
            status=store.STATUS_DONE, now=now,
        )
        message = store.get_message(tx, message_id)
    assert message is not None
    return ReplyPlan(
        channel=channel,
        scene_id=scene_id,
        player_message=message,
        open_scene_id=None if scene is None else int(scene["id"]),
    )


def reply_context(journey: OpenJourney, plan: ReplyPlan, *, before_id: int | None = None) -> list[ChatMessage]:
    """Contexto da resposta no canal do plano. ``before_id``: só o histórico anterior a essa mensagem."""
    state = load_state(journey)
    common = {
        "world": state.world,
        "character": state.character,
        "day_period": state.meta.get("day_period"),
        "previous": state.previous,
        "places": state.places,
        "date": state.date,
    }
    if plan.channel == store.CHANNEL_SCENE:
        history = store.recent_messages(journey.db, plan.channel, plan.scene_id, ctx.RECENT_MESSAGES, before_id=before_id)
        return ctx.chat_context(scene=state.scene, history=history, **common)
    history = store.recent_messages(journey.db, store.CHANNEL_OUT, None, ctx.RECENT_MESSAGES, before_id=before_id)
    reference = state.scene  # Cena aberta: o Aduran a recebe só como referência
    reference_messages = (
        store.recent_messages(journey.db, store.CHANNEL_SCENE, int(reference["id"]), ctx.SCENE_REFERENCE_MESSAGES)
        if reference is not None
        else []
    )
    return ctx.chat_context(
        scene=None,
        history=history,
        current_place=state.current_place,
        scene_reference=reference,
        scene_reference_messages=reference_messages,
        **common,
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
    filt = _MarkerFilter()
    try:
        async for event in _stream_tokens(provider, messages, cancel, filt):
            yield event
    except asyncio.CancelledError:
        # Conexão fechada pelo cliente: guarda o texto parcial como cancelado (escrita curta e local).
        cancel.set()
        try:
            save_reply(journey, plan, filt.emitted_text(), store.STATUS_CANCELLED)
        except Exception:  # noqa: BLE001 — a desconexão não pode virar outro erro
            log.exception("não foi possível gravar a resposta interrompida")
        raise
    if cancel.is_set():
        saved = await asyncio.to_thread(save_reply, journey, plan, filt.emitted_text(), store.STATUS_CANCELLED)
        yield "done", {"reason": "cancelled", "message": saved}
        return
    rest, text, found = filt.finish()
    if rest:
        yield "token", {"text": rest}
    propose = found and plan.allow_proposal
    if not text.strip() and not propose:
        raise NarrationFailed("generation_failed", "O Narrador não respondeu. Tente de novo.")
    saved = await asyncio.to_thread(save_reply, journey, plan, text, store.STATUS_DONE)
    if propose:
        async for event in _proposal_events(provider, journey, cancel):
            yield event
    yield "done", {"reason": "completed", "message": saved, "proposal": await asyncio.to_thread(_pending_public, journey)}


# ------------------------------------------------------------------ regenerar e continuar
@dataclass(frozen=True)
class RedoPlan:
    """Refazer (``regenerate``) ou continuar (``continue``) a última resposta do Narrador num canal."""

    reply: ReplyPlan
    target: dict[str, Any]
    opening: bool  # a primeira mensagem de uma Cena (a abertura)


def prepare_redo(journey: OpenJourney, channel: str | None, *, continuing: bool) -> RedoPlan:
    """Confere: há abertura, a última mensagem do canal é do Narrador e (ao continuar) cabe mais texto."""
    db = journey.db
    if not store.has_history(db):
        raise StorageError("abertura_pendente", "A Jornada ainda não tem abertura. Gere a abertura primeiro.")
    channel, scene_id, scene = _resolve_channel(db, channel)
    target = store.last_message(db, channel, scene_id)
    if target is None or target["role"] != store.ROLE_NARRATOR:
        raise StorageError("sem_resposta_do_narrador", "A última mensagem deste canal não é uma resposta do Narrador.")
    if continuing and len(target["content"]) >= store.MESSAGE_MAX:
        raise StorageError("mensagem_no_limite", f"A mensagem já tem {store.MESSAGE_MAX} caracteres.")
    opening = scene_id is not None and store.first_scene_message_id(db, scene_id) == target["id"]
    reply = ReplyPlan(
        channel=channel,
        scene_id=scene_id,
        player_message=None,
        open_scene_id=None if scene is None else int(scene["id"]),
    )
    return RedoPlan(reply=reply, target=target, opening=opening)


def redo_context(journey: OpenJourney, plan: RedoPlan) -> list[ChatMessage]:
    """O mesmo contexto que gerou a mensagem ``plan.target`` (sem ela)."""
    if not plan.opening:
        return reply_context(journey, plan.reply, before_id=int(plan.target["id"]))
    state = load_state(journey)
    scene = state.scene
    assert scene is not None
    tone = TONES_BY_ID.get(scene.get("opening_tone") or "")
    previous = [s for s in state.previous if int(s["id"]) < int(scene["id"])]
    return ctx.opening_narration_context(
        world=state.world,
        character=state.character,
        scene=scene,
        tone=tone,
        places=state.places,
        previous=previous,
        date=state.date,
        initial=scene.get("opening_tone") is not None,
    )


def _replace_target(journey: OpenJourney, plan: RedoPlan, content: str, status: str) -> dict[str, Any]:
    with journey.db.transaction() as tx:
        current = store.get_message(tx, int(plan.target["id"]))
        if current is None:
            raise StorageError("mensagem_nao_encontrada", "A mensagem não existe mais.")
        store.replace_message(tx, int(plan.target["id"]), content=content, status=status, now=utc_now_iso())
        message = store.get_message(tx, int(plan.target["id"]))
    assert message is not None
    return message


async def run_regenerate(
    provider: NarratorProvider, journey: OpenJourney, plan: RedoPlan, cancel: asyncio.Event
) -> AsyncIterator[Event]:
    """Gera outra resposta no lugar da última do Narrador; só a troca quando a nova tem texto."""
    messages = await asyncio.to_thread(redo_context, journey, plan)
    filt = _MarkerFilter()

    def keep_partial() -> dict[str, Any]:
        partial = filt.emitted_text().strip()[: store.MESSAGE_MAX]
        if not partial:
            return plan.target  # nada novo: a anterior fica
        return _replace_target(journey, plan, partial, store.STATUS_CANCELLED)

    try:
        async for event in _stream_tokens(provider, messages, cancel, filt):
            yield event
    except asyncio.CancelledError:
        cancel.set()
        try:
            keep_partial()
        except Exception:  # noqa: BLE001
            log.exception("não foi possível gravar a resposta regenerada interrompida")
        raise
    if cancel.is_set():
        message = await asyncio.to_thread(keep_partial)
        yield "done", {"reason": "cancelled", "message": message, "replaced": message is not plan.target}
        return
    rest, text, found = filt.finish()
    if rest:
        yield "token", {"text": rest}
    content = text.strip()[: store.MESSAGE_MAX]
    if not content:
        raise NarrationFailed("generation_failed", "O Narrador não respondeu; a resposta anterior foi mantida.")
    message = await asyncio.to_thread(_replace_target, journey, plan, content, store.STATUS_DONE)
    if found and plan.reply.allow_proposal:
        async for event in _proposal_events(provider, journey, cancel):
            yield event
    yield "done", {
        "reason": "completed",
        "message": message,
        "replaced": True,
        "proposal": await asyncio.to_thread(_pending_public, journey),
    }


def _separator(previous: str, addition: str) -> str:
    """Um espaço entre o texto anterior e a continuação, se nenhum dos dois o tiver e a continuação começar por letra."""
    if previous and addition and not previous[-1].isspace() and addition[0].isalnum():
        return " "
    return ""


async def run_continue(
    provider: NarratorProvider, journey: OpenJourney, plan: RedoPlan, cancel: asyncio.Event
) -> AsyncIterator[Event]:
    """Continua a última resposta do Narrador, anexando o texto novo à mesma mensagem."""
    base = await asyncio.to_thread(redo_context, journey, plan)
    previous = plan.target["content"]
    messages = ctx.continue_messages(base, previous)
    filt = _MarkerFilter(limit=store.MESSAGE_MAX - len(previous))
    sep: list[str] = []  # o separador, decidido no primeiro fragmento

    def joined(addition: str) -> str:
        return (previous + "".join(sep) + addition)[: store.MESSAGE_MAX]

    def keep(status: str, addition: str) -> dict[str, Any]:
        if not addition.strip():
            return plan.target
        return _replace_target(journey, plan, joined(addition.rstrip()), status)

    def tokens(out: str) -> str:
        if not sep:
            sep.append(_separator(previous, out))
            out = sep[0] + out
        return out

    try:
        async for name, data in _stream_tokens(provider, messages, cancel, filt):
            yield name, {"text": tokens(data["text"])}
    except asyncio.CancelledError:
        cancel.set()
        try:
            keep(store.STATUS_CANCELLED, filt.emitted_text())
        except Exception:  # noqa: BLE001
            log.exception("não foi possível gravar a continuação interrompida")
        raise
    if cancel.is_set():
        message = await asyncio.to_thread(keep, store.STATUS_CANCELLED, filt.emitted_text())
        yield "done", {"reason": "cancelled", "message": message}
        return
    rest, addition, found = filt.finish()
    if rest:
        yield "token", {"text": tokens(rest)}
    if not addition.strip():
        raise NarrationFailed("generation_failed", "O Narrador não continuou a resposta; ela foi mantida.")
    message = await asyncio.to_thread(keep, store.STATUS_DONE, addition)
    if found and plan.reply.allow_proposal:
        async for event in _proposal_events(provider, journey, cancel):
            yield event
    yield "done", {
        "reason": "completed",
        "message": message,
        "proposal": await asyncio.to_thread(_pending_public, journey),
    }


# ------------------------------------------------------------------ aceitar, trocar e recusar a proposta
_NEW_PLACE_REF = "(lugar novo)"  # id provisório do lugar novo no contexto da narração


@dataclass(frozen=True)
class AcceptPlan:
    state: JourneyState
    proposal: dict[str, Any]
    scene: dict[str, Any]  # a Cena proposta, como contexto da narração
    places: list[dict[str, Any]]  # lugares da Jornada + o novo provisório, se houver
    day_period: str


def prepare_accept(journey: OpenJourney) -> AcceptPlan:
    """Confere: há abertura, nenhuma Cena aberta, uma proposta pendente e o período conhecido."""
    if not store.has_history(journey.db):
        raise StorageError("abertura_pendente", "A Jornada ainda não tem abertura. Gere a abertura primeiro.")
    state = load_state(journey)
    if state.scene is not None:
        raise StorageError("cena_ja_aberta", "Já existe uma Cena aberta nesta Jornada.")
    pending = proposal_store.pending_proposal(journey.db)
    if pending is None:
        raise StorageError("sem_proposta_pendente", "Não há proposta de Cena pendente.")
    day_period = state.meta.get("day_period")
    if day_period not in DAY_PERIODS:
        raise StorageError("periodo_invalido", "O período do dia da Jornada não é conhecido.")
    places = list(state.places)
    place_id = pending["place_id"]
    if place_id is None:
        place_id = _NEW_PLACE_REF
        places.append({
            "id": _NEW_PLACE_REF,
            "name": pending["new_place_name"],
            "type": pending["new_place_type"],
            "description": pending["new_place_description"],
        })
    elif place_id not in state.place_names:
        raise StorageError("lugar_desconhecido", "O lugar da proposta não existe mais. Peça outra proposta.")
    scene = {
        "id": None,
        "status": "proposta",
        "title": pending["title"],
        "opening_tone": None,
        "place_id": place_id,
        "day_period": day_period,
        "motive": pending["motive"],
        "participants": list(pending["participants"]),
        "summary": None,
        "opened_at": None,
        "closed_at": None,
    }
    return AcceptPlan(state=state, proposal=pending, scene=scene, places=places, day_period=day_period)


async def run_accept(
    provider: NarratorProvider, journey: OpenJourney, plan: AcceptPlan, cancel: asyncio.Event
) -> AsyncIterator[Event]:
    """Abre a Cena da proposta pendente. Só grava no fim; cancelada ou com erro, a proposta continua pendente."""
    state = plan.state
    proposed = engine.public_scene(plan.scene, state.world, plan.places) or {}
    if plan.scene["place_id"] == _NEW_PLACE_REF:
        proposed["place_id"] = None
    yield "scene", {"scene": proposed, "proposal": engine.public_proposal(plan.proposal, state.world, state.places)}
    messages = ctx.opening_narration_context(
        world=state.world,
        character=state.character,
        scene=plan.scene,
        tone=None,
        places=plan.places,
        previous=state.previous,
        date=state.date,
        initial=False,
    )
    filt = _MarkerFilter()
    async for event in _stream_tokens(provider, messages, cancel, filt):
        yield event
    if cancel.is_set():
        yield "done", {"reason": "cancelled"}
        return
    rest, narration, _ = filt.finish()  # marcação em Cena: só removida
    if rest:
        yield "token", {"text": rest}
    if not narration.strip():
        raise NarrationFailed("generation_failed", "O Narrador não escreveu a abertura. Nada foi gravado; tente de novo.")
    world_ids = [p["id"] for p in (state.world or {}).get("places", []) if isinstance(p, dict) and "id" in p]
    scene, message = await asyncio.to_thread(
        engine.open_scene_from_proposal,
        journey.db,
        proposal_id=int(plan.proposal["id"]),
        day_period=plan.day_period,
        narration=narration,
        world_place_ids=world_ids,
        names=state.place_names,
    )
    after = await asyncio.to_thread(load_state, journey)
    yield "done", {
        "reason": "completed",
        "mode": store.MODE_SCENE,
        "scene": engine.public_scene(scene, after.world, after.places),
        "message": message,
        "current_place": after.current_place,
        "proposal": None,
    }


def prepare_reroll(journey: OpenJourney) -> dict[str, Any]:
    """A proposta pendente a trocar (``sem_proposta_pendente``; ``cena_ja_aberta`` com Cena aberta)."""
    if store.open_scene(journey.db) is not None:
        raise StorageError("cena_ja_aberta", "Já existe uma Cena aberta nesta Jornada.")
    pending = proposal_store.pending_proposal(journey.db)
    if pending is None:
        raise StorageError("sem_proposta_pendente", "Não há proposta de Cena pendente.")
    return pending


async def run_reroll(provider: NarratorProvider, journey: OpenJourney, pending: dict[str, Any]) -> dict[str, Any]:
    """Pede outra proposta com o mesmo contexto; a nova fica pendente e a anterior vira ``substituida``.

    Se o provedor falhar ou as propostas forem recusadas, a anterior continua pendente.
    """
    public = await _propose(provider, journey, asyncio.Event(), replacing=pending)
    return {"proposal": public}


def decline_proposal(journey: OpenJourney) -> dict[str, Any]:
    """Recusa a proposta pendente → ``{"proposal": None, "declined": proposta recusada}``."""
    declined = engine.decline_pending_proposal(journey.db)
    return {
        "proposal": None,
        "declined": engine.public_proposal(declined, journey.world_content(), place_store.journey_places(journey.db)),
    }


# ------------------------------------------------------------------ encerramento e título
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
        world=plan.state.world,
        character=plan.state.character,
        scene=plan.scene,
        history=plan.history,
        places=plan.state.places,
    )

    async def complete(msgs: list[ChatMessage]) -> str:
        return await provider.complete(msgs, json_schema=engine.SCENE_SUMMARY_SCHEMA)

    summary = await engine.request_valid(complete, messages, engine.parse_scene_summary)
    scene = await asyncio.to_thread(engine.close_open_scene, journey.db, summary)
    return {"mode": store.MODE_OUT, "scene": engine.public_scene(scene, plan.state.world, plan.state.places)}


def rename_scene(journey: OpenJourney, scene_id: int, title: Any) -> dict[str, Any]:
    """Renomeia a Cena (aberta ou encerrada) → ``{"scene"}``."""
    scene = engine.rename_scene(journey.db, scene_id, title)
    return {"scene": engine.public_scene(scene, journey.world_content(), place_store.journey_places(journey.db))}


# ------------------------------------------------------------------ leitura: arcos, Cena, Log e lugares
def _scene_card(scene: dict[str, Any], names: dict[str, str]) -> dict[str, Any]:
    return {
        "id": scene["id"],
        "title": engine.scene_title(scene),
        "day_period": scene["day_period"],
        "place_name": names.get(scene["place_id"]),
        "status": scene["status"],
    }


def arcs_view(journey: OpenJourney) -> dict[str, Any]:
    """``{arcs: [{objective_id, text, status, scenes: [...]}]}`` em ordem cronológica (pela primeira Cena).

    Cada Cena entra no arco da Ambição ativa quando abriu; Cenas anteriores à 0004 (sem
    ``objective_id``) entram no da Ambição ativa atual. A Ambição ativa sem Cenas aparece
    no fim, com a lista vazia.
    """
    db = journey.db
    names = engine.place_names(journey.world_content(), place_store.journey_places(db))
    objectives = {
        int(r["id"]): {"objective_id": int(r["id"]), "text": r["text"], "status": r["status"]}
        for r in db.query_all("SELECT id, text, status FROM objectives WHERE kind = 'ambicao' ORDER BY id")
    }
    active = engine.active_ambition_id(db)
    groups: dict[int | None, list[dict[str, Any]]] = {}
    for scene in store.all_scenes(db):
        key = scene.get("objective_id") or active
        groups.setdefault(key, []).append(_scene_card(scene, names))
    arcs = []
    for key, cards in groups.items():  # ordem de inserção = ordem da primeira Cena
        base = objectives.get(key) if key is not None else None
        arcs.append({**(base or {"objective_id": key, "text": None, "status": None}), "scenes": cards})
    if active is not None and active not in groups:
        arcs.append({**objectives[active], "scenes": []})
    return {"arcs": arcs}


def scene_view(journey: OpenJourney, scene_id: int) -> dict[str, Any]:
    """``{scene, messages}`` de uma Cena (aberta ou encerrada). ``cena_nao_encontrada`` se não existir."""
    scene = store.get_scene(journey.db, scene_id)
    if scene is None:
        raise StorageError("cena_nao_encontrada", "Cena não encontrada.")
    return {
        "scene": engine.public_scene(scene, journey.world_content(), place_store.journey_places(journey.db)),
        "messages": store.scene_messages(journey.db, scene_id),
    }


def _public_event(event: dict[str, Any], world: dict[str, Any] | None) -> dict[str, Any]:
    return {
        "id": event["id"],
        "kind": event["kind"],
        "scene_id": event["scene_id"],
        "data": event["data"],
        "day_period": event["day_period"],
        "calendar": date_view(world, event["calendar_year"], event["calendar_month"], event["calendar_day"]),
        "created_at": event["created_at"],
    }


def events_view(journey: OpenJourney, scene_id: int | None = None) -> dict[str, Any]:
    """``{events: [...]}``: o Log inteiro ou só o de uma Cena (``cena_nao_encontrada`` se ela não existir)."""
    if scene_id is not None and store.get_scene(journey.db, scene_id) is None:
        raise StorageError("cena_nao_encontrada", "Cena não encontrada.")
    world = journey.world_content()
    return {"events": [_public_event(e, world) for e in event_store.list_events(journey.db, scene_id)]}


def places_view(journey: OpenJourney) -> dict[str, Any]:
    """Lugares do Mundo e da Jornada (o atual marcado) e o caminho percorrido.

    ``path``: o lugar inicial e, depois, cada troca de lugar (eventos ``lugar``), na ordem.
    """
    state = load_state(journey)
    current = state.meta.get("current_place_id")
    out = []
    for p in (state.world or {}).get("places", []):
        out.append({
            "id": p.get("id"), "name": p.get("name"), "type": p.get("type"), "description": p.get("description"),
            "source": "mundo", "scene_id": None, "created_at": None, "current": p.get("id") == current,
        })
    for p in state.places:
        out.append({
            "id": p["id"], "name": p["name"], "type": p["type"], "description": p["description"],
            "source": "jornada", "scene_id": p["scene_id"], "created_at": p["created_at"], "current": p["id"] == current,
        })
    names = state.place_names
    path = []
    start = state.meta.get("start_place_id")
    if start:
        path.append({"place_id": start, "name": names.get(start), "scene_id": None, "event_id": None, "at": None})
    for event in event_store.list_events(journey.db):
        if event["kind"] == event_store.PLACE_CHANGED:
            pid = event["data"].get("place_id")
            path.append({
                "place_id": pid,
                "name": names.get(pid) or event["data"].get("place_name"),
                "scene_id": event["scene_id"],
                "event_id": event["id"],
                "at": event["created_at"],
            })
    return {"current_place_id": current, "places": out, "path": path}


__all__ = [
    "PLAYER_MESSAGE_MAX",
    "AcceptPlan",
    "ClosePlan",
    "JourneyState",
    "NarrationFailed",
    "OpeningPlan",
    "RedoPlan",
    "ReplyPlan",
    "arcs_view",
    "chat_view",
    "check_channel",
    "check_player_text",
    "decline_proposal",
    "events_view",
    "history_view",
    "journey_view",
    "load_state",
    "places_view",
    "prepare_accept",
    "prepare_close",
    "prepare_opening",
    "prepare_redo",
    "prepare_reply",
    "prepare_reroll",
    "rename_scene",
    "run_accept",
    "run_close",
    "run_continue",
    "run_opening",
    "run_regenerate",
    "run_reply",
    "run_reroll",
    "scene_view",
]
