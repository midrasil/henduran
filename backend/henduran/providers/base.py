"""Interface própria de provedor de IA do Narrador (ADR-071).

O restante do serviço conhece apenas esta interface, nunca o modelo concreto.
A saída do provedor é dado não confiável: ele não conhece regras, não altera
estado e não valida nada.

Extensões compatíveis (2026-11-22, Tarefa A do modelo local):

- ``ProviderUnavailable``: exceção que ``stream_chat`` pode levantar antes do
  primeiro fragmento quando o provedor não tem como responder (sem modelo,
  motor não instalado ou não pronto). Traz um ``code`` estável para a interface.
- ``complete``: resposta completa, opcionalmente restrita a um esquema JSON.
  Não é abstrato; provedores que não o oferecem levantam ``NotImplementedError``.

Ainda não implementado (previsto no ADR-071): embeddings. A assinatura exata e
os tipos de eventos seguem em aberto no ADR.
"""

from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from typing import TypedDict


class ChatMessage(TypedDict):
    role: str
    content: str


class ProviderUnavailable(Exception):
    """O provedor não pode responder agora. ``code`` identifica o motivo."""

    def __init__(self, message: str, code: str) -> None:
        super().__init__(message)
        self.code = code


class NarratorProvider(ABC):
    """Contrato entre o orquestrador e qualquer modelo de linguagem."""

    name: str = "provider"

    @abstractmethod
    def stream_chat(
        self,
        messages: list[ChatMessage],
        *,
        cancel: asyncio.Event | None = None,
    ) -> AsyncIterator[str]:
        """Gera a resposta em fragmentos de texto.

        Deve parar assim que ``cancel`` for acionado, sem emitir mais fragmentos.
        Implementações usam ``async def`` com ``yield``. Pode levantar
        ``ProviderUnavailable`` antes do primeiro fragmento.
        """

    @abstractmethod
    async def health(self) -> dict:
        """Informa se o provedor está pronto para responder."""

    @abstractmethod
    async def list_models(self) -> list[str]:
        """Lista os modelos disponíveis neste provedor."""

    async def complete(
        self,
        messages: list[ChatMessage],
        *,
        json_schema: dict | None = None,
    ) -> str:
        """Resposta completa; com ``json_schema``, pede saída estruturada.

        O texto devolvido continua não confiável: quem chama valida o JSON.
        """
        raise NotImplementedError("este provedor não oferece resposta completa")
