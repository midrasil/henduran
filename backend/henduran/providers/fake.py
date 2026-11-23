"""Provedor falso do Narrador, para testes e para o esqueleto do MVP.

Não usa modelo algum: ``stream_chat`` devolve um texto fixo, palavra por palavra;
``complete`` devolve JSON válido para o esquema pedido (proposta da Cena inicial,
proposta de Cena do Aduran ou resumo de encerramento, ADR-076), ou as respostas
configuradas, em sequência.

Para simular o Aduran pedindo uma Cena, a resposta pode terminar com a marcação
``[[propor_cena]]`` (``propose=True`` a acrescenta numa linha própria). No serviço,
``HENDURAN_FAKE_PROPOSE=1`` liga a marcação (ver ``henduran/__main__.py``).
"""

from __future__ import annotations

import asyncio
import json
import re
from collections import deque
from collections.abc import AsyncIterator, Iterable

from henduran.providers.base import ChatMessage, NarratorProvider

MARKER = "[[propor_cena]]"

DEFAULT_REPLY = (
    "O Narrador ouve com atenção. Esta é uma resposta de teste do provedor falso: "
    "nenhum modelo de linguagem está ativo ainda, mas o caminho entre a interface "
    "e o serviço local já funciona, palavra por palavra."
)

DEFAULT_SCENE_PROPOSAL = {
    "title": "Cena de teste",
    "motive": "Uma situação de teste do provedor falso começa no lugar inicial.",
    "participants": ["Uma figura de teste"],
}
DEFAULT_SCENE_SUMMARY = {"summary": "Resumo de teste do provedor falso: a Cena chegou ao fim."}
DEFAULT_PLACE_NAME = "Lugar de teste"


def default_aduran_proposal(messages: list[ChatMessage], number: int = 1) -> dict:
    """Proposta do Aduran com um lugar **novo** cujo nome ainda não aparece nas mensagens (nome único)."""
    seen = "\n".join(m.get("content", "") for m in messages)
    n = max(1, number)
    while re.search(rf"\b{re.escape(DEFAULT_PLACE_NAME)} {n}\b", seen):
        n += 1
    return {
        "title": f"Proposta de teste {n}",
        "place": {
            "kind": "novo",
            "name": f"{DEFAULT_PLACE_NAME} {n}",
            "type": "estrada",
            "description": "Um lugar inventado pelo provedor falso.",
        },
        "motive": "O personagem segue o plano que contou ao Aduran.",
        "participants": [],
    }


def default_completion(json_schema: dict | None, messages: list[ChatMessage] | None = None, number: int = 1) -> str:
    """JSON válido para os esquemas conhecidos (Cena inicial, proposta do Aduran ou resumo); sem esquema, um texto fixo."""
    properties = (json_schema or {}).get("properties", {})
    if "summary" in properties:
        return json.dumps(DEFAULT_SCENE_SUMMARY, ensure_ascii=False)
    if "place" in properties:
        return json.dumps(default_aduran_proposal(messages or [], number), ensure_ascii=False)
    if "motive" in properties:
        return json.dumps(DEFAULT_SCENE_PROPOSAL, ensure_ascii=False)
    return DEFAULT_REPLY


class FakeNarratorProvider(NarratorProvider):
    """Emite ``reply`` palavra por palavra, com ``delay`` segundos entre palavras.

    ``propose``: acrescenta a marcação ``[[propor_cena]]`` numa linha própria no fim de ``reply``.
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
        propose: bool = False,
    ) -> None:
        if delay < 0:
            raise ValueError("delay não pode ser negativo")
        self._reply = reply + ("\n" + MARKER if propose else "")
        self._delay = delay
        self.completions: deque[str] = deque(completions)
        self.stream_calls: list[list[ChatMessage]] = []
        self.complete_calls: list[tuple[list[ChatMessage], dict | None]] = []
        self._proposals = 0

    @property
    def reply(self) -> str:
        return self._reply

    @reply.setter
    def reply(self, value: str) -> None:
        self._reply = value

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
        if "place" in (json_schema or {}).get("properties", {}):
            self._proposals += 1
        return default_completion(json_schema, messages, self._proposals)

    async def health(self) -> dict:
        return {"name": self.name, "ready": True}

    async def list_models(self) -> list[str]:
        return ["fake-narrator"]
