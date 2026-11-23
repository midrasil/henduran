"""Provedor falso do Narrador, para testes e para o esqueleto do MVP.

Não usa modelo algum: devolve um texto fixo, palavra por palavra.
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator

from henduran.providers.base import ChatMessage, NarratorProvider

DEFAULT_REPLY = (
    "O Narrador ouve com atenção. Esta é uma resposta de teste do provedor falso: "
    "nenhum modelo de linguagem está ativo ainda, mas o caminho entre a interface "
    "e o serviço local já funciona, palavra por palavra."
)


class FakeNarratorProvider(NarratorProvider):
    """Emite ``reply`` palavra por palavra, com ``delay`` segundos entre palavras."""

    name = "fake"

    def __init__(self, reply: str = DEFAULT_REPLY, delay: float = 0.03) -> None:
        if delay < 0:
            raise ValueError("delay não pode ser negativo")
        self._reply = reply
        self._delay = delay

    async def stream_chat(
        self,
        messages: list[ChatMessage],
        *,
        cancel: asyncio.Event | None = None,
    ) -> AsyncIterator[str]:
        words = self._reply.split(" ")
        for index, word in enumerate(words):
            if cancel is not None and cancel.is_set():
                return
            if self._delay > 0:
                if cancel is None:
                    await asyncio.sleep(self._delay)
                else:
                    try:
                        await asyncio.wait_for(cancel.wait(), timeout=self._delay)
                        return  # cancelado durante a espera
                    except TimeoutError:
                        pass
            else:
                await asyncio.sleep(0)
            if cancel is not None and cancel.is_set():
                return
            yield word if index == len(words) - 1 else word + " "

    async def health(self) -> dict:
        return {"name": self.name, "ready": True}

    async def list_models(self) -> list[str]:
        return ["fake-narrator"]
