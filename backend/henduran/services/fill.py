"""Execução do Narrador que preenche dados (ADR-077, item 3): provedor, novas tentativas, tempo limite e cancelamento.

O plano vem de :func:`henduran.narrative.fill.prepare`. A resposta do provedor é validada pelo
motor (``plan.parse``); resposta inválida faz o serviço pedir de novo, com o motivo, até
:data:`henduran.narrative.scene.RETRIES` vezes, e depois levanta ``ProposalRejected``. Erros do
provedor (``ProviderUnavailable`` e outros) sobem sem contar como tentativa. **Nada é gravado.**
"""

from __future__ import annotations

import asyncio
from typing import Any

from henduran.narrative import scene as engine
from henduran.narrative.fill import FillPlan
from henduran.providers.base import ChatMessage, NarratorProvider

FILL_TIMEOUT_S = 120.0  # tempo limite do pedido inteiro (todas as tentativas)


class FillTimeout(Exception):
    """O Narrador não respondeu dentro do tempo limite."""

    code = "tempo_esgotado"

    def __init__(self) -> None:
        super().__init__("O Narrador demorou demais para responder. Nada mudou; tente de novo.")


async def run_fill(
    provider: NarratorProvider, plan: FillPlan, cancel: asyncio.Event, *, timeout: float = FILL_TIMEOUT_S
) -> dict[str, Any] | None:
    """O resultado validado, ou ``None`` se ``cancel`` foi acionado antes do fim."""

    async def complete(messages: list[ChatMessage]) -> str:
        return await provider.complete(messages, json_schema=plan.schema)

    work = asyncio.ensure_future(asyncio.wait_for(engine.request_valid(complete, plan.messages, plan.parse), timeout))
    waiter = asyncio.ensure_future(cancel.wait())
    try:
        await asyncio.wait({work, waiter}, return_when=asyncio.FIRST_COMPLETED)
    finally:
        waiter.cancel()
        if not work.done():
            work.cancel()
    if cancel.is_set() and (work.cancelled() or not work.done() or work.exception() is not None):
        return None
    try:
        return work.result()
    except TimeoutError as exc:
        raise FillTimeout() from exc


__all__ = ["FILL_TIMEOUT_S", "FillTimeout", "run_fill"]
