"""Interface própria de provedor de IA do Narrador (ADR-071).

O restante do serviço conhece apenas esta interface, nunca o modelo concreto.
A saída do provedor é dado não confiável: ele não conhece regras, não altera
estado e não valida nada.

Ainda não implementado (previsto no ADR-071, fica para passos seguintes):
resposta completa, saída estruturada com esquema (propostas ao motor) e
embeddings. A assinatura exata e os tipos de eventos seguem em aberto no ADR.
"""

from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from typing import TypedDict


class ChatMessage(TypedDict):
    role: str
    content: str


class NarratorProvider(ABC):
    """Contrato entre o orquestrador e qualquer modelo de linguagem."""

    @abstractmethod
    def stream_chat(
        self,
        messages: list[ChatMessage],
        *,
        cancel: asyncio.Event | None = None,
    ) -> AsyncIterator[str]:
        """Gera a resposta em fragmentos de texto.

        Deve parar assim que ``cancel`` for acionado, sem emitir mais fragmentos.
        Implementações usam ``async def`` com ``yield``.
        """

    @abstractmethod
    async def health(self) -> dict:
        """Informa se o provedor está pronto para responder."""

    @abstractmethod
    async def list_models(self) -> list[str]:
        """Lista os modelos disponíveis neste provedor."""
