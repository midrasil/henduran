from __future__ import annotations

import asyncio
import json
import threading
import time
from collections.abc import AsyncIterator, Iterator
from contextlib import contextmanager
from dataclasses import dataclass

import pytest
import uvicorn

from henduran.__main__ import bind_socket
from henduran.api.app import create_app
from henduran.providers.base import ChatMessage, NarratorProvider
from henduran.providers.fake import FakeNarratorProvider

TOKEN = "token-de-teste"
LONG_REPLY = " ".join(f"palavra{i}" for i in range(500))


class RecordingProvider(NarratorProvider):
    """Envolve outro provedor e registra como a geração terminou."""

    def __init__(self, inner: NarratorProvider) -> None:
        self.inner = inner
        self.yielded = 0
        self.finished = threading.Event()
        self.cancel_was_set: bool | None = None

    async def stream_chat(
        self, messages: list[ChatMessage], *, cancel: asyncio.Event | None = None
    ) -> AsyncIterator[str]:
        try:
            async for chunk in self.inner.stream_chat(messages, cancel=cancel):
                self.yielded += 1
                yield chunk
        finally:
            self.cancel_was_set = cancel.is_set() if cancel is not None else None
            self.finished.set()

    async def health(self) -> dict:
        return await self.inner.health()

    async def list_models(self) -> list[str]:
        return await self.inner.list_models()


@dataclass
class RunningServer:
    base_url: str
    app: object
    provider: NarratorProvider

    @property
    def auth(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {TOKEN}"}


@contextmanager
def run_server(provider: NarratorProvider, **app_kwargs) -> Iterator[RunningServer]:
    sock = bind_socket(0)
    app = create_app(provider, TOKEN, **app_kwargs)
    server = uvicorn.Server(uvicorn.Config(app, log_level="warning", lifespan="off"))
    thread = threading.Thread(
        target=lambda: asyncio.run(server.serve(sockets=[sock])), daemon=True
    )
    thread.start()
    deadline = time.monotonic() + 10
    while not server.started:
        if time.monotonic() > deadline:
            raise RuntimeError("servidor de teste não iniciou")
        time.sleep(0.01)
    port = sock.getsockname()[1]
    try:
        yield RunningServer(f"http://127.0.0.1:{port}", app, provider)
    finally:
        server.should_exit = True
        thread.join(timeout=10)
        sock.close()


@pytest.fixture
def fast_server() -> Iterator[RunningServer]:
    with run_server(FakeNarratorProvider(delay=0)) as srv:
        yield srv


@pytest.fixture
def slow_server() -> Iterator[RunningServer]:
    provider = RecordingProvider(FakeNarratorProvider(reply=LONG_REPLY, delay=0.02))
    with run_server(provider) as srv:
        yield srv


def parse_sse(raw: str) -> list[tuple[str, dict]]:
    events = []
    for block in raw.replace("\r\n", "\n").split("\n\n"):
        if not block.strip():
            continue
        name, data = "message", ""
        for line in block.split("\n"):
            if line.startswith("event:"):
                name = line[6:].strip()
            elif line.startswith("data:"):
                data += line[5:].strip()
        events.append((name, json.loads(data) if data else {}))
    return events
