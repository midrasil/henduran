"""Rotas somente leitura de Jornadas e Mundos (ADR-075): GET /journeys e GET /worlds."""

from __future__ import annotations

import httpx
import pytest

from henduran.paths import DataPaths
from henduran.providers.fake import FakeNarratorProvider
from henduran.storage import JourneyStore, WorldStore

from .conftest import open_settings, run_server


@pytest.fixture
def stores(tmp_path):
    paths = DataPaths(tmp_path / "dados").ensure()
    settings = open_settings(paths)
    worlds = WorldStore(paths)
    return paths, worlds, JourneyStore(paths, worlds, settings)


def test_listas_vazias(stores):
    _, worlds, journeys = stores
    with run_server(FakeNarratorProvider(delay=0), journeys=journeys, worlds=worlds) as srv:
        r = httpx.get(f"{srv.base_url}/journeys", headers=srv.auth)
        assert r.status_code == 200
        assert r.json() == {"journeys": [], "last_journey_id": None}
        r = httpx.get(f"{srv.base_url}/worlds", headers=srv.auth)
        assert r.status_code == 200 and r.json() == {"worlds": []}


def test_listas_exigem_token(stores):
    _, worlds, journeys = stores
    with run_server(FakeNarratorProvider(delay=0), journeys=journeys, worlds=worlds) as srv:
        for route in ("/journeys", "/worlds"):
            assert httpx.get(f"{srv.base_url}{route}").status_code == 401
            assert httpx.get(f"{srv.base_url}{route}", headers={"Authorization": "Bearer errado"}).status_code == 401


def test_listas_com_jornada_danificada(stores):
    paths, worlds, journeys = stores
    wid = worlds.create_world("Mundo ç")
    good = journeys.create_journey("Boa", wid)
    bad = journeys.create_journey("Quebrada", wid)
    journeys.set_last_played(good)
    paths.journey_db_file(bad).write_bytes(b"lixo" * 2000)
    with run_server(FakeNarratorProvider(delay=0), journeys=journeys, worlds=worlds) as srv:
        body = httpx.get(f"{srv.base_url}/journeys", headers=srv.auth).json()
        assert body["last_journey_id"] == good
        items = {j["id"]: j for j in body["journeys"]}
        assert items[good]["status"] == "ok" and items[good]["name"] == "Boa"
        assert items[good]["world_name"] == "Mundo ç" and items[good]["world_version"] == 1
        assert items[bad]["status"] == "danificada" and items[bad]["error_code"] == "banco_danificado"
        assert set(items[good]) >= {
            "id", "name", "character_name", "location", "day_period", "world_id", "world_version",
            "created_at", "last_saved_at", "status", "error_code", "error_message",
        }
        worlds_body = httpx.get(f"{srv.base_url}/worlds", headers=srv.auth).json()
        [world] = worlds_body["worlds"]
        assert world["id"] == wid and world["status"] == "ok" and world["latest_version"] == 1


def test_sem_armazenamento_responde_503():
    with run_server(FakeNarratorProvider(delay=0)) as srv:
        for route in ("/journeys", "/worlds"):
            r = httpx.get(f"{srv.base_url}{route}", headers=srv.auth)
            assert r.status_code == 503 and r.json()["detail"]["code"] == "storage_unavailable"
