import sqlite3

import httpx
import pytest

from henduran.api.app import create_app
from henduran.db.connection import Database
from henduran.paths import DataPaths
from henduran.providers.fake import FakeNarratorProvider
from henduran.storage import JourneyStore, WorldStore
from henduran.services.return_points import ReturnPoints

from .test_api_journeys import new_journey_body


@pytest.fixture
async def local(tmp_path):
    paths = DataPaths(tmp_path / "dados").ensure()
    worlds = WorldStore(paths)
    store = JourneyStore(paths, worlds)
    app = create_app(FakeNarratorProvider(delay=0), token="teste", journeys=store, worlds=worlds)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://localhost",
                                 headers={"Authorization": "Bearer teste"}) as client:
        try:
            yield client, store, app
        finally:
            app.state.session.close()


async def _create(client, body=None):
    reply = await client.post("/journeys", json=body or new_journey_body(name="Antes"))
    assert reply.status_code == 201, reply.text
    return reply.json()["journey"]


async def test_carregar_e_desfazer_com_retrato_e_mundo_fixo(local):
    client, store, _ = local
    first = await _create(client)
    body = new_journey_body(name="Outra")
    body["world"] = {"id": first["world_id"]}
    second = await _create(client, body)
    jid = first["id"]
    root = f"/journeys/{jid}/return-points"
    assert [p["name"] for p in (await client.get(root)).json()["points"]] == ["Início da Jornada"]
    assert (await client.post(f"/journeys/{jid}/open")).is_success
    portrait = b"\x89PNG\r\n\x1a\nPrimeiro"
    assert (await client.put("/journeys/current/portrait", content=portrait)).is_success
    response = await client.post(root, json={"name": "Ponto"})
    assert response.is_success, response.text
    pid = response.json()["point"]["id"]
    assert (await client.patch("/journeys/current", json={"name": "Depois"})).is_success
    assert (await client.delete("/journeys/current/portrait")).is_success
    assert (await client.post(f"{root}/{pid}/load")).status_code == 409
    assert (await client.post("/journeys/close")).is_success
    response = await client.post(f"{root}/{pid}/load?confirm=true")
    assert response.is_success, response.text
    assert response.json()["journey"]["name"] == "Antes"
    assert response.json()["world"]["version"] == first["world_version"]
    assert (await client.get("/journeys/current/portrait")).content == portrait
    assert (await client.get(f"/journeys/{jid}/portrait")).content == portrait
    assert (await client.post("/journeys/close")).is_success
    reopened = await client.post(f"/journeys/{jid}/open")
    assert reopened.json()["journey"]["name"] == "Antes"
    undo = (await client.get(root)).json()["points"][0]
    assert undo["name"] == "Antes de carregar"
    result = await client.post(f"{root}/{undo['id']}/load?confirm=true")
    assert result.json()["journey"]["name"] == "Depois"
    assert (await client.get("/journeys/current/portrait")).status_code == 404
    assert store.get_summary(second["id"]).name == "Outra"


async def test_retencao_e_falhas_preservam_progresso(local, monkeypatch):
    client, store, app = local
    jid = (await _create(client))["id"]
    assert (await client.post(f"/journeys/{jid}/open")).is_success
    root = f"/journeys/{jid}/return-points"
    points = ReturnPoints(store, jid)
    journey = app.state.session.require()
    for i in range(7):
        points.save(journey.db, f"Automático {i}", automatic=True)
    assert [p["name"] for p in points.list()] == [f"Automático {i}" for i in range(6, 1, -1)]
    automatic = points.list()[0]["id"]
    assert (await client.patch(f"{root}/{automatic}", json={"name": "Não"})).status_code == 409
    for i in range(20):
        manual = points.save(journey.db, f"Manual {i}")
    assert (await client.post(root, json={})).status_code == 409
    pid = manual["id"]
    assert (await client.put(f"{root}/{pid}?confirm=true")).is_success
    assert (await client.patch(f"{root}/{pid}", json={"name": "Renomeado"})).is_success
    assert (await client.patch("/journeys/current", json={"name": "Ainda aqui"})).is_success
    previous_points = points.list()
    with monkeypatch.context() as patch:
        def fail_publish(*_):
            raise OSError("não foi possível publicar o ponto de segurança")
        patch.setattr(ReturnPoints, "_publish", fail_publish)
        assert (await client.post(f"{root}/{pid}/load?confirm=true")).status_code == 500
    assert points.list() == previous_points
    assert (await client.get("/journeys/current")).json()["journey"]["name"] == "Ainda aqui"
    with monkeypatch.context() as patch:
        def fail(*_):
            raise sqlite3.OperationalError("falha injetada")
        patch.setattr(Database, "restore_from", fail)
        assert (await client.post(f"{root}/{pid}/load?confirm=true")).status_code == 500
    assert (await client.get("/journeys/current")).json()["journey"]["name"] == "Ainda aqui"
    target = next(p for p in points.list() if p["id"] == pid)
    (points.folder / f"{target['file']}.db").write_bytes(b"corrompido")
    assert (await client.post(f"{root}/{pid}/load?confirm=true")).status_code == 409
    assert (await client.get("/journeys/current")).json()["journey"]["name"] == "Ainda aqui"
    assert (await client.delete(f"{root}/{pid}?confirm=true")).is_success


async def test_ciclo_de_cena_salva_estado_efetivado_e_reabrir_nao_duplica(local):
    client, _, _ = local
    jid = (await _create(client))["id"]
    root = f"/journeys/{jid}/return-points"
    assert (await client.post(f"/journeys/{jid}/open")).is_success
    opening = await client.post("/journeys/current/opening")
    assert '"reason": "completed"' in opening.text, opening.text
    assert (await client.post("/journeys/current/scene/close")).is_success
    points = (await client.get(root)).json()["points"]
    assert [p["name"] for p in points] == ["Fim da Cena", "Início da Cena", "Início da Jornada"]
    assert points[1]["message_count"] == 1
    assert (await client.post("/journeys/close")).is_success
    assert (await client.post(f"/journeys/{jid}/open")).is_success
    assert (await client.get(root)).json()["points"] == points
    restored = await client.post(f"{root}/{points[1]['id']}/load?confirm=true")
    assert restored.is_success, restored.text
    assert restored.json()["mode"] == "em_cena"
    assert (await client.get("/journeys/current/messages")).is_success


async def test_recusa_carregamento_durante_gravacao_e_se_o_mundo_diverge(local):
    client, store, app = local
    jid = (await _create(client))["id"]
    assert (await client.post(f"/journeys/{jid}/open")).is_success
    root = f"/journeys/{jid}/return-points"
    points = ReturnPoints(store, jid)
    target = points.list()[0]
    route = f"{root}/{target['id']}/load?confirm=true"
    app.state.narrating[jid] = "em-andamento"
    assert (await client.post(route)).status_code == 409
    app.state.narrating.pop(jid)
    with sqlite3.connect(points.folder / f"{target['file']}.db") as conn:
        conn.execute("UPDATE journey_meta SET world_version=99")
    result = await client.post(route)
    assert result.json()["detail"]["code"] == "ponto_mundo_divergente"
    assert points.list() == [target]
