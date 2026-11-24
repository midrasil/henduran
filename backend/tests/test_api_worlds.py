"""Tela de Mundos (modelo provisório): salvar um Mundo sem Jornada e excluir um Mundo salvo."""

from __future__ import annotations

from henduran.storage import WorldStore
from henduran.worldgen import generate_world

from .test_api_journeys import _no_journey_left_open, call, create, srv  # noqa: F401


def save(srv, content, **extra):
    return call(srv, "POST", "/worlds", json={"content": content, **extra})


def test_salvar_mundo_gerado_guarda_a_semente(srv):  # noqa: F811
    content = generate_world(476)["content"]
    r = save(srv, content, seed=476)
    assert r.status_code == 201, r.text
    world = r.json()["world"]
    assert world["seed"] == 476 and world["journey_count"] == 0 and world["name"] == content["name"]
    assert world["era"] == content["era"]["name"] and world["tone"] == content["tone"]["name"]
    [listed] = call(srv, "GET", "/worlds").json()["worlds"]
    assert listed["id"] == world["id"] and listed["seed"] == 476
    assert call(srv, "GET", f"/worlds/{world['id']}").json()["content"] == content


def test_mundo_editado_ou_sem_semente_e_personalizado(srv):  # noqa: F811
    content = generate_world(476)["content"]
    content["name"] = "Terras Editadas"
    assert save(srv, content, seed=476).json()["world"]["seed"] is None
    assert save(srv, generate_world(8)["content"]).json()["world"]["seed"] is None


def test_salvar_valida_o_conteudo_e_nao_grava_nada(srv):  # noqa: F811
    content = generate_world(476)["content"]
    content["name"] = ""
    r = save(srv, content)
    assert r.status_code == 422
    detail = r.json()["detail"]
    assert detail["code"] == "mundo_invalido"
    assert {"field": "content.name", "code": "obrigatorio"} in [{"field": e["field"], "code": e["code"]} for e in detail["errors"]]
    assert call(srv, "GET", "/worlds").json() == {"worlds": []}
    r = call(srv, "POST", "/worlds", json={"content": generate_world(1)["content"], "outro": 1})
    assert r.status_code == 422 and r.json()["detail"]["code"] == "corpo_invalido"


def test_excluir_mundo_exige_confirmacao_e_recusa_em_uso(srv):  # noqa: F811
    journey = create(srv)
    wid = journey["world_id"]
    r = call(srv, "DELETE", f"/worlds/{wid}")
    assert r.status_code == 400 and r.json()["detail"]["code"] == "confirmacao_necessaria"
    r = call(srv, "DELETE", f"/worlds/{wid}?confirm=true")
    assert r.status_code == 409 and r.json()["detail"]["code"] == "mundo_em_uso"
    assert srv.paths.world_dir(wid).is_dir()
    # Sem Jornadas, a exclusão vale e a pasta some da lista.
    assert call(srv, "DELETE", f"/journeys/{journey['id']}?confirm=true").status_code == 200
    r = call(srv, "DELETE", f"/worlds/{wid}?confirm=true")
    assert r.status_code == 200 and r.json() == {"deleted": wid}
    assert call(srv, "GET", "/worlds").json() == {"worlds": []}
    assert not any(srv.paths.worlds_dir.iterdir())
    assert call(srv, "DELETE", f"/worlds/{wid}?confirm=true").status_code == 404
    assert call(srv, "DELETE", "/worlds/nao-e-id?confirm=true").status_code == 422


def test_falha_no_renome_nao_altera_o_mundo(srv, monkeypatch):  # noqa: F811
    wid = save(srv, generate_world(3)["content"]).json()["world"]["id"]
    from pathlib import Path

    def locked(self, target):
        raise PermissionError("arquivo em uso (simulado)")

    monkeypatch.setattr(Path, "rename", locked)
    r = call(srv, "DELETE", f"/worlds/{wid}?confirm=true")
    monkeypatch.undo()
    assert r.status_code == 500 and r.json()["detail"]["code"] == "exclusao_falhou"
    assert [w["id"] for w in call(srv, "GET", "/worlds").json()["worlds"]] == [wid]


def test_pasta_de_mundo_excluido_que_nao_foi_apagada_fica_fora_da_lista(srv, monkeypatch):  # noqa: F811
    wid = save(srv, generate_world(3)["content"]).json()["world"]["id"]
    import shutil

    real = shutil.rmtree

    def fail(path, *a, **k):
        raise PermissionError("arquivo em uso (simulado)")

    monkeypatch.setattr(shutil, "rmtree", fail)
    assert call(srv, "DELETE", f"/worlds/{wid}?confirm=true").status_code == 200
    monkeypatch.setattr(shutil, "rmtree", real)
    leftovers = [p.name for p in srv.paths.worlds_dir.iterdir()]
    assert leftovers == [f".excluindo-{wid}-0"]
    assert call(srv, "GET", "/worlds").json() == {"worlds": []}
    # A próxima exclusão limpa o que ficou.
    other = save(srv, generate_world(4)["content"]).json()["world"]["id"]
    assert call(srv, "DELETE", f"/worlds/{other}?confirm=true").status_code == 200
    assert not any(srv.paths.worlds_dir.iterdir())
    assert isinstance(WorldStore, type)
