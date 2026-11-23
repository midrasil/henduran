"""Provedor falso do Narrador, para testes e para o esqueleto do MVP.

Não usa modelo algum: ``stream_chat`` devolve um texto fixo, palavra por palavra;
``complete`` devolve JSON válido para o esquema pedido (proposta de Cena ou resumo
de encerramento, ADR-076), ou as respostas configuradas, em sequência.
"""

from __future__ import annotations

import asyncio
import json
from collections import deque
from collections.abc import AsyncIterator, Iterable

from henduran.providers.base import ChatMessage, NarratorProvider

DEFAULT_REPLY = (
    "O Narrador ouve com atenção. Esta é uma resposta de teste do provedor falso: "
    "nenhum modelo de linguagem está ativo ainda, mas o caminho entre a interface "
    "e o serviço local já funciona, palavra por palavra."
)

DEFAULT_SCENE_PROPOSAL = {
    "motive": "Uma situação de teste do provedor falso começa no lugar inicial.",
    "participants": ["Uma figura de teste"],
}
DEFAULT_SCENE_SUMMARY = {"summary": "Resumo de teste do provedor falso: a Cena chegou ao fim."}


def default_completion(json_schema: dict | None) -> str:
    """JSON válido para os esquemas conhecidos (Cena ou resumo); sem esquema, um texto fixo."""
    properties = (json_schema or {}).get("properties", {})
    if "summary" in properties:
        return json.dumps(DEFAULT_SCENE_SUMMARY, ensure_ascii=False)
    if "motive" in properties:
        return json.dumps(DEFAULT_SCENE_PROPOSAL, ensure_ascii=False)
    return DEFAULT_REPLY


class FakeNarratorProvider(NarratorProvider):
    """Emite ``reply`` palavra por palavra, com ``delay`` segundos entre palavras.

    ``completions``: respostas de ``complete``, consumidas em ordem (inclusive
    inválidas, para testar as novas tentativas); esgotadas, volta ao JSON padrão.
    ``stream_calls`` e ``complete_calls`` guardam as mensagens recebidas.
    """

    name = "fake"

    def __init__(
        self,
        reply: str = DEFAULT_REPLY,
        delay: float = 0.03,
        *,
        completions: Iterable[str] = (),
    ) -> None:
        if delay < 0:
            raise ValueError("delay não pode ser negativo")
        self._reply = reply
        self._delay = delay
        self.completions: deque[str] = deque(completions)
        self.stream_calls: list[list[ChatMessage]] = []
        self.complete_calls: list[tuple[list[ChatMessage], dict | None]] = []

    async def stream_chat(
        self,
        messages: list[ChatMessage],
        *,
        cancel: asyncio.Event | None = None,
    ) -> AsyncIterator[str]:
        self.stream_calls.append([dict(m) for m in messages])  # type: ignore[misc]
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

    async def complete(self, messages: list[ChatMessage], *, json_schema: dict | None = None) -> str:
        self.complete_calls.append(([dict(m) for m in messages], json_schema))  # type: ignore[misc]
        await asyncio.sleep(0)
        if self.completions:
            return self.completions.popleft()
        return default_completion(json_schema)

    async def health(self) -> dict:
        return {"name": self.name, "ready": True}

    async def list_models(self) -> list[str]:
        return ["fake-narrator"]
