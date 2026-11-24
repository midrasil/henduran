"""Nova Jornada, rodada 1 (ADR-077): Mundos salvos, semente, descrição da Jornada e História formatada."""

from __future__ import annotations

from collections.abc import Iterator

import httpx
import pytest

from henduran.db import open_app_database
from henduran.narrative import context as ctx
from henduran.narrative.tones import TONES
from henduran.paths import DataPaths
from henduran.providers.fake import FakeNarratorProvider
from henduran.services import narration
from henduran.services.journey_creation import (
    JourneyCreationInvalid,
    create_journey_with_character,
    world_seed_for,
)
from henduran.settings import SettingsStore
from henduran.storage import JourneyStore, WorldStore
from henduran.storage import journeys as journeys_mod
from henduran.worldgen import SEED_MAX, generate_world, validate_world_content

from .conftest import open_settings, run_server
from .drafts import valid_draft


@pytest.fixture(autouse=True)
def _no_journey_left_open() -> Iterator[None]:
    yield
    journeys_mod._process_open["id"] = None


@pytest.fixture
def env(tmp_path) -> Iterator[tuple[DataPaths, WorldStore, JourneyStore]]:
    paths = DataPaths(tmp_path / "dados").ensure()
    app_db, _ = open_app_database(paths.database_file)
    worlds = WorldStore(paths)
    journeys = JourneyStore(paths, worlds, SettingsStore(app_db))
    try:
        yield paths, worlds, journeys
    finally:
        app_db.close()


def new(journeys: JourneyStore, seed: int = 476, **kwargs):
    content = generate_world(seed)["content"]
    args = {"world_content": content, "start_place_id": content["places"][0]["id"], "character": valid_draft()} | kwargs
    return content, create_journey_with_character(journeys, **args)


def world_files(paths: DataPaths) -> list[tuple[str, int]]:
    return sorted((p.name, (p / "world.db").stat().st_mtime_ns) for p in paths.worlds_dir.iterdir())


# ------------------------------------------------------------------ semente
def test_mundo_gerado_sem_edicao_guarda_a_semente(env):
    _, worlds, journeys = env
    _, summary = new(journeys, world_seed=476)
    [item] = worlds.catalog()
    assert item.id == summary.world_id and item.seed == 476


def test_mundo_editado_ou_sem_semente_recebe_semente_nova(env, monkeypatch):
    _, worlds, journeys = env
    content = generate_world(476)["content"]
    content["name"] = "Terras Editadas"
    monkeypatch.setattr("henduran.services.journey_creation.new_seed", lambda: 1234)
    new(journeys, world_content=content, world_seed=476)
    new(journeys, seed=8)  # sem semente pedida (criado do zero ou duplicado)
    seeds = {w.name: w.seed for w in worlds.catalog()}
    assert seeds["Terras Editadas"] == 1234
    assert seeds[generate_world(8)["content"]["name"]] == 1234


def test_semente_pedida_invalida_vira_semente_nova(monkeypatch):
    content = validate_world_content(generate_world(476)["content"]).content
    monkeypatch.setattr("henduran.services.journey_creation.new_seed", lambda: 7)
    assert world_seed_for(content, 476) == 476
    for bad in (None, -1, SEED_MAX + 1, True, "476", 477):
        assert world_seed_for(content, bad) == 7


# ------------------------------------------------------------------ Mundo salvo
def test_jornada_num_mundo_salvo_nao_altera_o_mundo(env):
    paths, worlds, journeys = env
    content, first = new(journeys, world_seed=476)
    before = world_files(paths)
    summary = create_journey_with_character(
        journeys, world_id=first.world_id, start_place_id=content["places"][2]["id"], character=valid_draft()
    )
    assert summary.world_id == first.world_id and summary.world_version == 1
    assert summary.location == content["places"][2]["name"]
    assert world_files(paths) == before  # nenhum Mundo novo; o world.db não foi tocado
    [item] = worlds.catalog()
    assert item.journey_count == 2 and item.seed == 476
    assert item.era == content["era"]["name"] and item.tone == content["tone"]["name"]
    # A Jornada abre normalmente com o Mundo salvo anexado em leitura.
    with journeys.open_journey(summary.id) as journey:
        assert journey.world_content()["name"] == content["name"]


def test_mundo_salvo_desconhecido_ou_lugar_fora_dele(env):
    paths, _, journeys = env
    content, first = new(journeys)
    with pytest.raises(JourneyCreationInvalid) as err:
        create_journey_with_character(
            journeys, world_id="11111111-1111-4111-8111-111111111111", start_place_id="lugar-1", character=valid_draft()
        )
    assert {(e.field, e.code) for e in err.value.errors} == {("world.id", "mundo_desconhecido")}
    with pytest.raises(JourneyCreationInvalid) as err:
        create_journey_with_character(journeys, world_id=first.world_id, start_place_id="lugar-9", character=valid_draft())
    assert {(e.field, e.code) for e in err.value.errors} == {("start_place_id", "lugar_desconhecido")}
    with pytest.raises(JourneyCreationInvalid) as err:
        create_journey_with_character(
            journeys, world_id=first.world_id, world_content=content, start_place_id="lugar-1", character=valid_draft()
        )
    assert ("world", "mundo_ambiguo") in {(e.field, e.code) for e in err.value.errors}
    assert len(list(paths.journeys_dir.iterdir())) == 1  # nada foi criado


def test_falha_numa_jornada_de_mundo_salvo_nao_remove_o_mundo(env, monkeypatch):
    paths, worlds, journeys = env
    content, first = new(journeys)

    def boom(*args, **kwargs):
        raise RuntimeError("falhou")

    monkeypatch.setattr(journeys, "create_journey", boom)
    with pytest.raises(Exception):
        create_journey_with_character(
            journeys, world_id=first.world_id, start_place_id=content["places"][0]["id"], character=valid_draft()
        )
    assert worlds.world_exists(first.world_id)


# ------------------------------------------------------------------ descrição e História
def test_descricao_da_jornada_e_validada_e_gravada(env):
    _, _, journeys = env
    _, summary = new(journeys, description="  Uma travessia pelo pântano.\nSem volta.  ")
    assert summary.description == "Uma travessia pelo pântano.\nSem volta."
    _, empty = new(journeys, description="   ")
    assert empty.description is None
    with pytest.raises(JourneyCreationInvalid) as err:
        new(journeys, description="x" * 2001)
    assert {(e.field, e.code) for e in err.value.errors} == {("description", "muito_longo")}
    with pytest.raises(JourneyCreationInvalid) as err:
        new(journeys, description=5)
    assert {(e.field, e.code) for e in err.value.errors} == {("description", "tipo_invalido")}
    with journeys.open_journey(summary.id) as journey:
        assert journey.summary()["description"] == "Uma travessia pelo pântano.\nSem volta."


def test_historia_formatada_na_ficha_e_texto_puro_no_banco(env):
    _, _, journeys = env
    _, summary = new(journeys, character=valid_draft(history_html="<h3>Origens</h3><p>Cresceu <b>no porto</b>.</p>"))
    with journeys.open_journey(summary.id) as journey:
        sheet = journey.character_sheet()
        assert sheet["history"] == "Origens\nCresceu no porto."
        assert sheet["history_html"] == "<h3>Origens</h3><p>Cresceu <strong>no porto</strong>.</p>"


def test_historia_antiga_sai_como_paragrafos(env):
    _, _, journeys = env
    _, summary = new(journeys)  # valid_draft: texto simples com uma quebra de linha
    with journeys.open_journey(summary.id) as journey:
        sheet = journey.character_sheet()
        assert sheet["history_html"] == "<p>Cresceu numa vila de pescadores.</p><p>Partiu cedo para a guerra.</p>"


def test_descricao_no_contexto_do_narrador(env):
    _, _, journeys = env
    _, summary = new(journeys, description="Tom sombrio; a dívida pesa.")
    with journeys.open_journey(summary.id) as journey:
        state = narration.load_state(journey)
        plan = narration.ReplyPlan(channel="fora_de_cena", scene_id=None, player_message=None)
        system = narration.reply_context(journey, plan)[0]["content"]
        assert "Descrição da Jornada, escrita pelo jogador:\nTom sombrio; a dívida pesa." in system
        # Texto puro da História no contexto, nunca o HTML.
        assert "<p>" not in system
        opening = ctx.opening_proposal_context(
            world=state.world, character=state.character, day_period="noite", place=None, place_id="lugar-1",
            tone=TONES[0], description=state.meta.get("description"),
        )
        assert "Tom sombrio" in opening[0]["content"]
    _, plain = new(journeys)
    with journeys.open_journey(plain.id) as journey:
        plan = narration.ReplyPlan(channel="fora_de_cena", scene_id=None, player_message=None)
        assert "Descrição da Jornada" not in narration.reply_context(journey, plan)[0]["content"]


# ------------------------------------------------------------------ API
@pytest.fixture
def srv(tmp_path):
    paths = DataPaths(tmp_path / "dados").ensure()
    settings = open_settings(paths)
    worlds = WorldStore(paths)
    journeys = JourneyStore(paths, worlds, settings)
    with run_server(FakeNarratorProvider(delay=0), journeys=journeys, worlds=worlds) as server:
        server.paths = paths
        try:
            yield server
        finally:
            server.app.state.session.close()


def call(srv, method: str, route: str, **kwargs) -> httpx.Response:
    return httpx.request(method, f"{srv.base_url}{route}", headers=srv.auth, timeout=30, **kwargs)


def test_api_mundos_salvos_e_jornada_num_mundo_salvo(srv):
    content = generate_world(476)["content"]
    body = {
        "world": {"content": content, "seed": 476},
        "start_place_id": content["places"][0]["id"],
        "character": valid_draft(history_html="<p>Cresceu <em>no porto</em>.</p>"),
        "description": "Começa no porto.",
    }
    r = call(srv, "POST", "/journeys", json=body)
    assert r.status_code == 201, r.text
    created = r.json()["journey"]
    assert created["description"] == "Começa no porto."
    world_id = created["world_id"]

    [item] = call(srv, "GET", "/worlds").json()["worlds"]
    assert item["id"] == world_id and item["seed"] == 476 and item["journey_count"] == 1
    assert item["era"] == content["era"]["name"] and item["tone"] == content["tone"]["name"]

    r = call(srv, "GET", f"/worlds/{world_id}")
    assert r.status_code == 200
    assert r.json()["content"]["name"] == content["name"] and r.json()["world"]["journey_count"] == 1
    assert call(srv, "GET", "/worlds/11111111-1111-4111-8111-111111111111").status_code == 404
    assert call(srv, "GET", "/worlds/schema").json()["seed_max"] == SEED_MAX  # a rota fixa vem antes

    r = call(srv, "POST", "/journeys", json={
        "world": {"id": world_id},
        "start_place_id": content["places"][1]["id"],
        "character": valid_draft(name="Bram"),
    })
    assert r.status_code == 201, r.text
    assert r.json()["journey"]["world_id"] == world_id
    assert len(list(srv.paths.worlds_dir.iterdir())) == 1
    assert call(srv, "GET", "/worlds").json()["worlds"][0]["journey_count"] == 2

    listed = call(srv, "GET", "/journeys").json()["journeys"]
    assert {j["description"] for j in listed} == {"Começa no porto.", None}

    r = call(srv, "POST", f"/journeys/{created['id']}/open")
    assert r.status_code == 200
    snap = r.json()
    assert snap["journey"]["description"] == "Começa no porto."
    assert snap["character"]["history"] == "Cresceu no porto."
    assert snap["character"]["history_html"] == "<p>Cresceu <em>no porto</em>.</p>"


def test_api_rascunho_com_historia_formatada_valida_o_texto_puro(srv):
    r = call(srv, "POST", "/characters/validate", json={"draft": valid_draft(history_html="<p><script>x</script></p>")})
    assert r.status_code == 200
    assert {(e["field"], e["code"]) for e in r.json()["errors"]} == {("history", "obrigatorio")}
    r = call(srv, "POST", "/journeys", json={
        "world": {"id": "nao-e-um-id"},
        "start_place_id": "lugar-1",
        "character": valid_draft(),
        "description": "x" * 2001,
    })
    assert r.status_code == 422
    found = {(e["field"], e["code"]) for e in r.json()["detail"]["errors"]}
    assert ("world.id", "mundo_desconhecido") in found and ("description", "muito_longo") in found
