"""Rotas do passo "Nova Jornada": regras, Mundo, validação, criação e ciclo de vida da Jornada."""

from __future__ import annotations

from collections.abc import Iterator

import httpx
import pytest

from henduran.db import Database
from henduran.db.migrations import backup_database
from henduran.narrative.periods import DAY_PERIODS
from henduran.paths import DataPaths, new_id
from henduran.providers.fake import FakeNarratorProvider
from henduran.rules import fatia1 as R
from henduran.rules.creation import creation_catalog
from henduran.storage import JourneyStore, WorldStore
from henduran.storage import journeys as journeys_mod
from henduran.worldgen import generate_world

from .conftest import open_settings, run_server
from .drafts import valid_draft


@pytest.fixture(autouse=True)
def _no_journey_left_open() -> Iterator[None]:
    yield
    journeys_mod._process_open["id"] = None


@pytest.fixture
def srv(tmp_path):
    paths = DataPaths(tmp_path / "dados").ensure()
    settings = open_settings(paths)
    worlds = WorldStore(paths)
    journeys = JourneyStore(paths, worlds, settings)
    with run_server(FakeNarratorProvider(delay=0), journeys=journeys, worlds=worlds) as server:
        server.paths = paths
        server.journeys = journeys
        try:
            yield server
        finally:
            server.app.state.session.close()


def call(srv, method: str, route: str, **kwargs) -> httpx.Response:
    return httpx.request(method, f"{srv.base_url}{route}", headers=srv.auth, timeout=30, **kwargs)


def new_journey_body(seed: int = 476, **overrides) -> dict:
    content = generate_world(seed)["content"]
    body = {"world": {"content": content}, "start_place_id": content["places"][0]["id"], "character": valid_draft()}
    body.update(overrides)
    return body


def create(srv, **overrides) -> dict:
    r = call(srv, "POST", "/journeys", json=new_journey_body(**overrides))
    assert r.status_code == 201, r.text
    return r.json()["journey"]


def folders(paths: DataPaths) -> list:
    return [p for root in (paths.journeys_dir, paths.worlds_dir) if root.is_dir() for p in root.iterdir()]


NEW_ROUTES = [
    ("GET", "/rules/creation"),
    ("GET", "/worlds/schema"),
    ("POST", "/worlds/generate"),
    ("POST", "/worlds/validate"),
    ("POST", "/characters/validate"),
    ("POST", "/journeys"),
    ("GET", "/journeys/current"),
    ("POST", "/journeys/close"),
    ("POST", f"/journeys/{new_id()}/open"),
    ("DELETE", f"/journeys/{new_id()}?confirm=true"),
    ("GET", f"/journeys/{new_id()}/backups"),
    ("POST", f"/journeys/{new_id()}/restore"),
]


def test_todas_as_rotas_exigem_token(srv):
    for method, route in NEW_ROUTES:
        assert httpx.request(method, f"{srv.base_url}{route}").status_code == 401, route
        bad = {"Authorization": "Bearer errado"}
        assert httpx.request(method, f"{srv.base_url}{route}", headers=bad).status_code == 401, route


# ------------------------------------------------------------------ regras e Mundo
def test_regras_de_criacao(srv):
    r = call(srv, "GET", "/rules/creation")
    assert r.status_code == 200
    body = r.json()
    assert body == creation_catalog()
    assert body["rules_version"] == "fatia-1"
    assert len(body["attributes"]) == 6 and len(body["skills"]) == 22
    assert {a["id"]: a["category"] for a in body["attributes"]}["determinacao"] == "espiritual"
    assert {s["id"]: s["attribute"] for s in body["skills"]} == {s.id: s.attribute for s in R.SKILLS}
    assert body["attribute_distribution"] == [4, 3, 3, 2, 2, 1]
    assert [p["total_skills"] for p in body["skill_profiles"]] == [13, 12, 7]
    assert body["creation_max"] == 4
    assert body["text_limits"]["history"] == 4000 and body["text_limits"]["name"] == 200
    assert [d["formula"] for d in body["derived"]] == ["3 + Vigor", "3 + Determinação"]


def test_gerar_mundo(srv):
    r = call(srv, "POST", "/worlds/generate", json={"seed": 476})
    assert r.status_code == 200
    assert r.json() == generate_world(476)
    r = call(srv, "POST", "/worlds/generate")  # sem corpo: sorteia
    assert r.status_code == 200 and isinstance(r.json()["seed"], int)
    assert call(srv, "POST", "/worlds/generate", json={}).status_code == 200
    for seed in (-1, 2**53, "1", True, 1.5):
        r = call(srv, "POST", "/worlds/generate", json={"seed": seed})
        assert r.status_code == 422, seed
        assert r.json()["detail"]["code"] == "semente_invalida"
        assert r.json()["detail"]["errors"][0]["field"] == "seed"
    r = call(srv, "POST", "/worlds/generate", json={"semente": 1})
    assert r.status_code == 422 and r.json()["detail"]["errors"][0]["code"] == "campo_desconhecido"
    r = call(srv, "POST", "/worlds/generate", content=b"{nao e json")
    assert r.status_code == 400 and r.json()["detail"]["code"] == "json_invalido"
    r = call(srv, "POST", "/worlds/generate", json=[1])
    assert r.status_code == 422 and r.json()["detail"]["code"] == "corpo_invalido"
    r = call(srv, "POST", "/worlds/generate", content=b'{"seed": NaN}')
    assert r.status_code == 400
    assert folders(srv.paths) == []  # gerar não grava nada


def test_validar_mundo(srv):
    content = generate_world(3)["content"]
    r = call(srv, "POST", "/worlds/validate", json={"content": content})
    assert r.status_code == 200 and r.json() == {"valid": True, "errors": [], "content": content}
    content["calendar"]["months"][0]["days"] = 50
    content["places"][0]["id"] = "Lugar Ruim"
    body = call(srv, "POST", "/worlds/validate", json={"content": content}).json()
    assert body["valid"] is False and body["content"] is None
    assert {(e["field"], e["code"]) for e in body["errors"]} == {
        ("calendar.months[0].days", "fora_do_intervalo"),
        ("places[0].id", "id_invalido"),
    }
    assert all(e["message"] for e in body["errors"])
    body = call(srv, "POST", "/worlds/validate", json={}).json()
    assert body["valid"] is False


def test_corpo_grande_demais(srv):
    huge = {"content": {"name": "a" * (1024 * 1024 + 10)}}
    r = call(srv, "POST", "/worlds/validate", json=huge)
    assert r.status_code == 413 and r.json()["detail"]["code"] == "corpo_grande_demais"


def test_validar_personagem(srv):
    r = call(srv, "POST", "/characters/validate", json={"draft": valid_draft()})
    assert r.status_code == 200
    assert r.json() == {"valid": True, "errors": [], "derived": {"vida": 6, "vontade": 6}}
    draft = valid_draft(name="", attributes={"vigor": 4, "forca": 9})
    body = call(srv, "POST", "/characters/validate", json={"draft": draft}).json()
    assert body["valid"] is False
    assert body["derived"] == {"vida": 7, "vontade": None}
    found = {(e["field"], e["code"]) for e in body["errors"]}
    assert {("name", "obrigatorio"), ("attributes.forca", "acima_do_teto"), ("attributes.astucia", "atributo_ausente")} <= found
    body = call(srv, "POST", "/characters/validate", json={}).json()
    assert body["valid"] is False and body["errors"][0]["code"] == "rascunho_invalido"


def test_regras_e_mundo_funcionam_sem_armazenamento():
    with run_server(FakeNarratorProvider(delay=0)) as server:
        assert call(server, "GET", "/rules/creation").status_code == 200
        assert call(server, "POST", "/worlds/generate", json={"seed": 1}).status_code == 200
        for method, route in (("POST", "/journeys"), ("GET", "/journeys/current"), ("POST", "/journeys/close"),
                              ("POST", f"/journeys/{new_id()}/open"), ("GET", f"/journeys/{new_id()}/backups")):
            r = call(server, method, route, json={})
            assert r.status_code == 503 and r.json()["detail"]["code"] == "storage_unavailable"


# ------------------------------------------------------------------ criação
def test_criar_jornada(srv):
    body = new_journey_body()
    content = body["world"]["content"]
    r = call(srv, "POST", "/journeys", json=body)
    assert r.status_code == 201, r.text
    journey = r.json()["journey"]
    assert journey["status"] == "ok" and journey["name"] == "A Jornada de Ilsa Corvalho"
    assert journey["location"] == content["places"][0]["name"] and journey["day_period"] in DAY_PERIODS
    assert journey["rules_version"] == "fatia-1" and journey["world_name"] == content["name"]
    listed = call(srv, "GET", "/journeys").json()
    assert [j["id"] for j in listed["journeys"]] == [journey["id"]]
    assert listed["journeys"][0]["rules_version"] == "fatia-1"
    assert [w["id"] for w in call(srv, "GET", "/worlds").json()["worlds"]] == [journey["world_id"]]
    named = create(srv, seed=2, name="Crônicas")
    assert named["name"] == "Crônicas"


def test_criar_jornada_invalida_responde_422_por_campo(srv):
    content = generate_world(8)["content"]
    content["religions"] = []
    body = {
        "world": {"content": content},
        "start_place_id": "lugar-9",
        "character": valid_draft(convictions=[], skill_profile="mestre"),
    }
    r = call(srv, "POST", "/journeys", json=body)
    assert r.status_code == 422
    detail = r.json()["detail"]
    assert detail["code"] == "criacao_invalida" and detail["message"]
    found = {(e["field"], e["code"]) for e in detail["errors"]}
    assert ("world.content.religions", "quantidade_invalida") in found
    assert ("character.convictions", "conviccoes_quantidade") in found
    assert ("character.skill_profile", "perfil_desconhecido") in found
    # O lugar inicial só é conferido com um Mundo válido.
    r = call(srv, "POST", "/journeys", json=new_journey_body(start_place_id="lugar-9"))
    assert {(e["field"], e["code"]) for e in r.json()["detail"]["errors"]} == {("start_place_id", "lugar_desconhecido")}
    r = call(srv, "POST", "/journeys", json=new_journey_body(world="x"))
    assert r.status_code == 422 and r.json()["detail"]["errors"][0]["field"] == "world"
    r = call(srv, "POST", "/journeys", json=new_journey_body(world={"content": content, "extra": 1}))
    assert r.status_code == 422 and r.json()["detail"]["errors"][0]["field"] == "world.extra"
    # Mundo novo e salvo ao mesmo tempo: ambíguo.
    r = call(srv, "POST", "/journeys", json=new_journey_body(world={"content": content, "id": "x"}))
    found = {(e["field"], e["code"]) for e in r.json()["detail"]["errors"]}
    assert r.status_code == 422 and ("world", "mundo_ambiguo") in found
    r = call(srv, "POST", "/journeys", json=new_journey_body(extra=True))
    assert r.status_code == 422 and r.json()["detail"]["errors"][0]["field"] == "extra"
    assert call(srv, "POST", "/journeys", json={}).status_code == 422
    assert folders(srv.paths) == []


def test_criar_jornada_com_falha_responde_500_e_limpa(srv, monkeypatch):
    def boom(*args, **kwargs):
        raise OSError("disco cheio (simulado)")

    monkeypatch.setattr(JourneyStore, "get_summary", boom)
    r = call(srv, "POST", "/journeys", json=new_journey_body())
    monkeypatch.undo()
    assert r.status_code == 500
    detail = r.json()["detail"]
    assert detail["code"] == "criacao_falhou" and detail["step"] == "conferir"
    assert folders(srv.paths) == []


# ------------------------------------------------------------------ abrir, atual, fechar
def test_abrir_atual_e_fechar(srv):
    journey = create(srv)
    jid = journey["id"]
    r = call(srv, "GET", "/journeys/current")
    assert r.status_code == 404 and r.json()["detail"]["code"] == "nenhuma_jornada_aberta"
    r = call(srv, "POST", f"/journeys/{jid}/open")
    assert r.status_code == 200, r.text
    snap = r.json()
    assert snap["journey"]["id"] == jid and snap["journey"]["rules_version"] == "fatia-1"
    assert snap["character"]["name"] == "Ilsa Corvalho"
    assert snap["character"]["tracks"]["vontade"] == {"size": 6, "superficial": 0, "agravada": 0}
    assert snap["character"]["ambition"]["text"] == valid_draft()["ambition"]
    assert snap["world"]["id"] == journey["world_id"] and snap["world"]["version"] == 1
    assert snap["world"]["content"]["name"] == journey["world_name"]
    assert call(srv, "GET", "/journeys/current").json() == snap
    assert call(srv, "GET", "/journeys").json()["last_journey_id"] == jid
    # Abrir a mesma de novo devolve a aberta.
    assert call(srv, "POST", f"/journeys/{jid}/open").json() == snap
    r = call(srv, "POST", "/journeys/close")
    assert r.status_code == 200 and r.json() == {"closed": jid}
    assert call(srv, "POST", "/journeys/close").json() == {"closed": None}
    assert call(srv, "GET", "/journeys/current").status_code == 404


def test_abrir_duas_jornadas(srv):
    first, second = create(srv), create(srv, seed=5)
    assert call(srv, "POST", f"/journeys/{first['id']}/open").status_code == 200
    r = call(srv, "POST", f"/journeys/{second['id']}/open")
    assert r.status_code == 409 and r.json()["detail"]["code"] == "jornada_ja_aberta"
    assert call(srv, "GET", "/journeys/current").json()["journey"]["id"] == first["id"]
    call(srv, "POST", "/journeys/close")
    assert call(srv, "POST", f"/journeys/{second['id']}/open").status_code == 200
    assert call(srv, "GET", "/journeys").json()["last_journey_id"] == second["id"]


def test_abrir_inexistente_ou_id_invalido(srv):
    r = call(srv, "POST", f"/journeys/{new_id()}/open")
    assert r.status_code == 404 and r.json()["detail"]["code"] == "jornada_nao_encontrada"
    r = call(srv, "POST", "/journeys/..%2F..%2Fx/open")
    assert r.status_code in (404, 422)
    r = call(srv, "POST", "/journeys/nao-e-uuid/open")
    assert r.status_code == 422 and r.json()["detail"]["code"] == "id_invalido"


def test_abrir_jornada_danificada(srv):
    journey = create(srv)
    srv.paths.journey_db_file(journey["id"]).write_bytes(b"lixo" * 2000)
    r = call(srv, "POST", f"/journeys/{journey['id']}/open")
    assert r.status_code == 409 and r.json()["detail"]["code"] == "banco_danificado"
    assert call(srv, "GET", "/journeys/current").status_code == 404


# ------------------------------------------------------------------ excluir
def test_excluir_exige_confirmacao(srv):
    journey = create(srv)
    jid = journey["id"]
    for route in (f"/journeys/{jid}", f"/journeys/{jid}?confirm=false", f"/journeys/{jid}?confirm=sim"):
        r = call(srv, "DELETE", route)
        assert r.status_code == 400 and r.json()["detail"]["code"] == "confirmacao_necessaria"
    call(srv, "POST", f"/journeys/{jid}/open")
    r = call(srv, "DELETE", f"/journeys/{jid}?confirm=true")
    assert r.status_code == 409 and r.json()["detail"]["code"] == "jornada_aberta"
    call(srv, "POST", "/journeys/close")
    r = call(srv, "DELETE", f"/journeys/{jid}?confirm=true")
    assert r.status_code == 200
    assert r.json() == {"deleted": jid, "world_id": journey["world_id"], "world_deleted": True, "world_kept_reason": None}
    assert call(srv, "GET", "/journeys").json() == {"journeys": [], "last_journey_id": None}
    assert call(srv, "DELETE", f"/journeys/{jid}?confirm=true").status_code == 404
    # O Mundo só desta Jornada foi junto.
    assert call(srv, "GET", "/worlds").json() == {"worlds": []}
    assert folders(srv.paths) == []


def _second_journey_on(srv, world_id: str) -> str:
    """Cria, pelo armazenamento, outra Jornada no mesmo Mundo (a API sempre cria um Mundo novo)."""
    return srv.journeys.create_journey("Outra", world_id)


def test_excluir_mantem_mundo_usado_por_outra_jornada(srv):
    journey = create(srv)
    other = _second_journey_on(srv, journey["world_id"])
    r = call(srv, "DELETE", f"/journeys/{journey['id']}?confirm=true")
    assert r.status_code == 200
    body = r.json()
    assert body["deleted"] == journey["id"] and body["world_id"] == journey["world_id"]
    assert body["world_deleted"] is False and body["world_kept_reason"] == "mundo_em_uso"
    assert srv.paths.world_dir(journey["world_id"]).is_dir()
    # Excluída a última que o usa, o Mundo vai junto.
    r = call(srv, "DELETE", f"/journeys/{other}?confirm=true")
    assert r.json()["world_deleted"] is True
    assert not srv.paths.world_dir(journey["world_id"]).exists()


def test_excluir_mantem_mundo_com_jornada_ilegivel(srv):
    journey = create(srv)
    broken = create(srv, seed=9)
    srv.paths.journey_db_file(broken["id"]).write_bytes(b"lixo" * 2000)
    body = call(srv, "DELETE", f"/journeys/{journey['id']}?confirm=true").json()
    assert body["world_deleted"] is False and body["world_kept_reason"] == "uso_indeterminado"
    assert srv.paths.world_dir(journey["world_id"]).is_dir()


def test_falha_ao_excluir_mundo_nao_derruba_a_exclusao_da_jornada(srv, monkeypatch):
    journey = create(srv)

    def boom(self, world_id, *, confirm=False):
        raise OSError("arquivo em uso (simulado)")

    monkeypatch.setattr(WorldStore, "delete_world", boom)
    r = call(srv, "DELETE", f"/journeys/{journey['id']}?confirm=true")
    monkeypatch.undo()
    assert r.status_code == 200
    body = r.json()
    assert body["deleted"] == journey["id"] and body["world_deleted"] is False
    assert body["world_kept_reason"] == "exclusao_falhou"
    assert not srv.paths.journey_dir(journey["id"]).exists()
    assert srv.paths.world_dir(journey["world_id"]).is_dir()


def test_excluir_jornada_danificada_sem_mundo_conhecido(srv):
    journey = create(srv)
    srv.paths.journey_db_file(journey["id"]).write_bytes(b"lixo" * 2000)
    body = call(srv, "DELETE", f"/journeys/{journey['id']}?confirm=true").json()
    # Sem ler o resumo, não dá para saber o Mundo: ele fica.
    assert body == {"deleted": journey["id"], "world_id": None, "world_deleted": False, "world_kept_reason": None}
    assert srv.paths.world_dir(journey["world_id"]).is_dir()


# ------------------------------------------------------------------ backups e restauração
def test_backups_e_restaurar(srv):
    journey = create(srv)
    jid = journey["id"]
    assert call(srv, "GET", f"/journeys/{jid}/backups").json() == {"backups": []}
    with Database(srv.paths.journey_db_file(jid), synchronous="FULL") as db:
        made = backup_database(db, srv.paths.journey_backups_dir(jid), 2, prefix="journey")
    [info] = call(srv, "GET", f"/journeys/{jid}/backups").json()["backups"]
    assert info["name"] == made.name and info["schema_version"] == 2 and info["size_bytes"] > 0
    srv.paths.journey_db_file(jid).write_bytes(b"lixo" * 2000)  # danificada
    assert call(srv, "POST", f"/journeys/{jid}/open").status_code == 409
    r = call(srv, "POST", f"/journeys/{jid}/restore", json={"backup": made.name})
    assert r.status_code == 200, r.text
    assert r.json()["restored_from"] == made.name and r.json()["preserved_as"].startswith("journey.db.danificado-")
    snap = call(srv, "POST", f"/journeys/{jid}/open").json()
    assert snap["character"]["name"] == "Ilsa Corvalho"
    r = call(srv, "POST", f"/journeys/{jid}/restore", json={"backup": made.name})
    assert r.status_code == 409 and r.json()["detail"]["code"] == "jornada_aberta"
    call(srv, "POST", "/journeys/close")
    r = call(srv, "POST", f"/journeys/{jid}/restore", json={"backup": "journey-v1-20250101-000000.db"})
    assert r.status_code == 404 and r.json()["detail"]["code"] == "backup_nao_encontrado"
    r = call(srv, "POST", f"/journeys/{jid}/restore", json={"backup": "../../henduran.db"})
    assert r.status_code == 422 and r.json()["detail"]["code"] == "backup_invalido"
    r = call(srv, "POST", f"/journeys/{jid}/restore", json={})
    assert r.status_code == 422 and r.json()["detail"]["errors"][0]["field"] == "backup"
    assert call(srv, "GET", f"/journeys/{new_id()}/backups").status_code == 404
    assert call(srv, "POST", f"/journeys/{new_id()}/restore", json={"backup": made.name}).status_code == 404


def test_rotas_existentes_continuam(srv):
    assert call(srv, "GET", "/health").status_code == 200
    assert call(srv, "GET", "/journeys").json() == {"journeys": [], "last_journey_id": None}
    assert call(srv, "GET", "/worlds").json() == {"worlds": []}
