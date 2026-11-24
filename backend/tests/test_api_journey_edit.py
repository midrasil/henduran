"""Editar o nome e a descrição da Jornada aberta (``PATCH /journeys/current``)."""

from __future__ import annotations

from .test_api_journeys import _no_journey_left_open, call, create, srv  # noqa: F401


def opened(srv, **overrides) -> dict:  # noqa: F811
    journey = create(srv, **overrides)
    assert call(srv, "POST", f"/journeys/{journey['id']}/open").status_code == 200
    return journey


def patch(srv, body) -> object:  # noqa: F811
    return call(srv, "PATCH", "/journeys/current", json=body)


def test_editar_nome_e_descricao_grava_e_aparece_na_lista(srv):  # noqa: F811
    journey = opened(srv, description="Antes.")
    r = patch(srv, {"name": "  Crônicas do Porto  ", "description": "Uma dívida antiga.\nE um porto."})
    assert r.status_code == 200, r.text
    body = r.json()["journey"]
    assert body["name"] == "Crônicas do Porto" and body["description"] == "Uma dívida antiga.\nE um porto."
    assert call(srv, "GET", "/journeys/current").json()["journey"]["name"] == "Crônicas do Porto"
    call(srv, "POST", "/journeys/close")
    [listed] = call(srv, "GET", "/journeys").json()["journeys"]
    assert listed["id"] == journey["id"] and listed["name"] == "Crônicas do Porto"
    # Reaberta, a edição continua lá (gravada no journey.db).
    call(srv, "POST", f"/journeys/{journey['id']}/open")
    assert call(srv, "GET", "/journeys/current").json()["journey"]["description"] == "Uma dívida antiga.\nE um porto."


def test_em_branco_volta_ao_padrao_e_apaga_a_descricao(srv):  # noqa: F811
    opened(srv, name="Outro nome", description="Algo.")
    body = patch(srv, {"name": "   ", "description": ""}).json()["journey"]
    assert body["name"] == "A Jornada de Ilsa Corvalho" and body["description"] is None
    body = patch(srv, {"name": None}).json()["journey"]
    assert body["name"] == "A Jornada de Ilsa Corvalho"


def test_campo_ausente_nao_muda(srv):  # noqa: F811
    opened(srv, name="Fixo", description="Fica.")
    assert patch(srv, {"description": "Nova."}).json()["journey"]["name"] == "Fixo"
    assert patch(srv, {"name": "Outro"}).json()["journey"]["description"] == "Nova."
    assert patch(srv, {}).json()["journey"]["name"] == "Outro"


def test_erros_claros_e_nada_muda(srv):  # noqa: F811
    opened(srv, name="Fixo", description="Fica.")
    r = patch(srv, {"name": "x" * 201, "description": "y" * 2001})
    assert r.status_code == 422
    detail = r.json()["detail"]
    assert detail["code"] == "resumo_invalido"
    assert {(e["field"], e["code"]) for e in detail["errors"]} == {("name", "muito_longo"), ("description", "muito_longo")}
    r = patch(srv, {"name": "linha\nquebrada", "description": "ok"})
    assert r.status_code == 422 and [e["field"] for e in r.json()["detail"]["errors"]] == ["name"]
    r = patch(srv, {"name": 3})
    assert r.status_code == 422 and r.json()["detail"]["errors"][0]["code"] == "tipo_invalido"
    r = patch(srv, {"outro": 1})
    assert r.status_code == 422 and r.json()["detail"]["code"] == "corpo_invalido"
    journey = call(srv, "GET", "/journeys/current").json()["journey"]
    assert journey["name"] == "Fixo" and journey["description"] == "Fica."


def test_sem_jornada_aberta(srv):  # noqa: F811
    r = patch(srv, {"name": "x"})
    assert r.status_code == 404 and r.json()["detail"]["code"] == "nenhuma_jornada_aberta"
