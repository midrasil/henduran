"""Provedor local do Narrador: ``LLMClient`` falando com o ``llama-server`` do ``EngineManager``.

O motor escolhe porta e chave novas a cada início; o provedor recria o cliente
quando esse endereço muda.
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator, Callable

from henduran.ai.engine import EngineManager
from henduran.ai.llm_client import LLMClient
from henduran.providers.base import ChatMessage, NarratorProvider, ProviderUnavailable

ClientFactory = Callable[[str, str], LLMClient]


def _default_client(base_url: str, api_key: str) -> LLMClient:
    return LLMClient(base_url, api_key=api_key, model="local", llama_cpp=True)


class LocalLlamaProvider(NarratorProvider):
    name = "local"

    def __init__(self, engine: EngineManager, client_factory: ClientFactory | None = None) -> None:
        self.engine = engine
        self._factory = client_factory or _default_client
        self._client: LLMClient | None = None
        self._endpoint: tuple[str, str] | None = None

    def unavailable(self) -> ProviderUnavailable | None:
        """Motivo para não responder agora, ou ``None`` se o motor está pronto."""
        if self.engine.endpoint() is not None:
            return None
        if self.engine.binary() is None:
            return ProviderUnavailable(
                "O motor de IA ainda não foi baixado. Abra a aba Modelos para baixá-lo.",
                "engine_not_installed",
            )
        if not self.engine.resolve_model(self.engine.settings.get("active_model")):
            return ProviderUnavailable(
                "Nenhum modelo de IA escolhido. Abra a aba Modelos e escolha um.",
                "no_model",
            )
        if self.engine.state == "starting":
            message = "O modelo ainda está carregando. Espere ficar pronto na aba Modelos."
        else:
            message = "O motor de IA não está pronto. Abra a aba Modelos e use um modelo."
        return ProviderUnavailable(message, "engine_not_ready")

    async def _current_client(self) -> LLMClient:
        problem = self.unavailable()
        if problem is not None:
            raise problem
        endpoint = self.engine.endpoint()
        assert endpoint is not None
        if self._client is None or endpoint != self._endpoint:
            if self._client is not None:
                await self._client.aclose()
            self._client = self._factory(*endpoint)
            self._endpoint = endpoint
        return self._client

    async def stream_chat(
        self,
        messages: list[ChatMessage],
        *,
        cancel: asyncio.Event | None = None,
    ) -> AsyncIterator[str]:
        client = await self._current_client()
        if cancel is not None and cancel.is_set():
            return
        async for piece in client.stream_chat([dict(m) for m in messages], cancel=cancel):
            if cancel is not None and cancel.is_set():
                return
            yield piece

    async def complete(self, messages: list[ChatMessage], *, json_schema: dict | None = None) -> str:
        client = await self._current_client()
        return await client.chat([dict(m) for m in messages], json_schema=json_schema)

    async def health(self) -> dict:
        problem = self.unavailable()
        out = {"name": self.name, "ready": problem is None, "state": self.engine.state}
        if problem is not None:
            out["code"] = problem.code
            out["message"] = str(problem)
        return out

    async def list_models(self) -> list[str]:
        return [m["id"] for m in self.engine.models()]

    async def aclose(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None
