"""O serviço fecha a Jornada aberta ao encerrar (``serve`` em ``henduran.__main__``)."""

from __future__ import annotations

import asyncio

from henduran import __main__ as main_mod
from henduran.__main__ import bind_socket, serve
from henduran.paths import DataPaths
from henduran.providers.fake import FakeNarratorProvider
from henduran.services.journey_creation import create_journey_with_character
from henduran.storage import JourneyStore, WorldStore
from henduran.storage import journeys as journeys_mod
from henduran.worldgen import generate_world

from .conftest import open_settings
from .drafts import valid_draft


class _Engine:
    stopped = False

    async def stop(self) -> dict:
        self.stopped = True
        return {}


def test_serve_fecha_a_jornada_aberta_ao_encerrar(tmp_path, monkeypatch, capsys):
    paths = DataPaths(tmp_path / "dados").ensure()
    worlds = WorldStore(paths)
    journeys = JourneyStore(paths, worlds, open_settings(paths))
    content = generate_world(1)["content"]
    summary = create_journey_with_character(
        journeys, world_content=content, start_place_id="lugar-1", character=valid_draft()
    )
    seen: dict = {}

    class FakeServer:
        def __init__(self, config) -> None:
            self.config = config
            self.started = False

        async def serve(self, sockets) -> None:
            self.started = True
            session = self.config.app.state.session
            session.open(summary.id)  # uma Jornada aberta pela API no momento do encerramento
            seen["open_during"] = journeys.open_journey_id
            await asyncio.sleep(0.05)

    monkeypatch.setattr(main_mod.uvicorn, "Server", FakeServer)
    engine = _Engine()
    sock = bind_socket(0)
    try:
        asyncio.run(serve(sock, "t", FakeNarratorProvider(delay=0), engine, None, None, journeys, worlds))
    finally:
        sock.close()
        journeys_mod._process_open["id"] = None
    assert seen["open_during"] == summary.id
    assert journeys.open_journey_id is None  # fechada pelo serve ao sair
    assert engine.stopped
    with journeys.open_journey(summary.id):  # o bloqueio foi liberado
        pass
    assert '"event": "ready"' in capsys.readouterr().out
