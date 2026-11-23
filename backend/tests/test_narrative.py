"""Migração journey/0003 (Cenas e mensagens), sorteios do motor, validação das propostas e contexto (ADR-076)."""

from __future__ import annotations

import json
import random
import shutil
import sqlite3
from collections.abc import Iterator

import pytest

from henduran.db import open_app_database
from henduran.db import migrations as mig_mod
from henduran.narrative import context as ctx
from henduran.narrative import scene as engine
from henduran.narrative.periods import DAY_PERIODS, draw_day_period
from henduran.narrative.tones import TONES, draw_tone
from henduran.paths import DataPaths
from henduran.providers.fake import FakeNarratorProvider
from henduran.services.journey_creation import create_journey_with_character
from henduran.settings import SettingsStore
from henduran.storage import JourneyStore, StorageError, WorldStore
from henduran.storage import journeys as journeys_mod
from henduran.storage import scenes as store
from henduran.worldgen import generate_world

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


def create(journeys: JourneyStore, rng: random.Random | None = None, place: int = 1):
    content = generate_world(476)["content"]
    summary = create_journey_with_character(
        journeys, world_content=content, start_place_id=content["places"][place]["id"], character=valid_draft(), rng=rng
    )
    return content, summary


# ------------------------------------------------------------------ migração 0003
def test_jornada_so_com_0001_migra_ate_0003(env, monkeypatch):
    paths, worlds, journeys = env
    original = mig_mod.MIGRATIONS_ROOT
    only_first = paths.root.parent / "sets"
    shutil.copytree(original, only_first, ignore=shutil.ignore_patterns("__pycache__"))
    for extra in (only_first / "journey").glob("*.sql"):
        if not extra.name.startswith("0001_"):
            extra.unlink()
    monkeypatch.setattr(mig_mod, "MIGRATIONS_ROOT", only_first)
    jid = journeys.create_journey("Antiga", worlds.create_world("M"))
    with journeys.open_journey(jid) as journey:
        journey.update_summary(location="Vila")
    monkeypatch.setattr(mig_mod, "MIGRATIONS_ROOT", original)
    with journeys.open_journey(jid) as journey:
        assert journey.db.query_one("SELECT MAX(version) FROM schema_migrations")[0] == mig_mod.latest_version("journey")
        summary = journey.summary()
        assert summary["start_place_id"] is None and summary["location"] == "Vila"
        assert store.open_scene(journey.db) is None and store.all_messages(journey.db) == []
        assert not store.has_history(journey.db)
    [backup] = journeys.list_backups(jid)
    assert backup.schema_version == 1


def test_banco_novo_tem_cenas_e_mensagens(env):
    _, worlds, journeys = env
    jid = journeys.create_journey("Nova", worlds.create_world("M"))
    with journeys.open_journey(jid) as journey:
        tables = {r["name"] for r in journey.db.query_all("SELECT name FROM sqlite_master WHERE type = 'table'")}
        assert {"scenes", "messages"} <= tables
        assert journey.db.query_one("SELECT MAX(version) FROM schema_migrations")[0] == mig_mod.latest_version("journey")


def test_restricoes_de_cenas_e_mensagens(env):
    _, worlds, journeys = env
    jid = journeys.create_journey("J", worlds.create_world("M"))
    with journeys.open_journey(jid) as journey:
        db = journey.db
        ok = "INSERT INTO scenes (place_id, day_period, motive, participants, opened_at) VALUES ('l', 'tarde', 'm', '[]', 't')"
        db.execute(ok)
        attempts = [
            ok,  # segunda Cena aberta
            "INSERT INTO scenes (status, place_id, day_period, motive, opened_at, closed_at) "
            "VALUES ('encerrada', 'l', 'tarde', 'm', 't', 't')",  # encerrada sem resumo
            "INSERT INTO scenes (status, place_id, day_period, motive, opened_at) VALUES ('pausada', 'l', 'tarde', 'm', 't')",
            "INSERT INTO scenes (status, place_id, day_period, motive, participants, summary, opened_at, closed_at) "
            "VALUES ('encerrada', 'l', 'tarde', 'm', '{}', 's', 't', 't')",  # participantes não é lista
            "INSERT INTO messages (channel, role, content, created_at) VALUES ('cena', 'narrador', 'x', 't')",  # sem Cena
            "INSERT INTO messages (channel, scene_id, role, content, created_at) VALUES ('fora_de_cena', 1, 'narrador', 'x', 't')",
            "INSERT INTO messages (channel, role, content, created_at) VALUES ('fora_de_cena', 'npc', 'x', 't')",
            "INSERT INTO messages (channel, role, content, status, created_at) VALUES ('fora_de_cena', 'jogador', 'x', 'parcial', 't')",
            "INSERT INTO messages (channel, role, content, created_at) VALUES ('fora_de_cena', 'jogador', '', 't')",
            "INSERT INTO messages (channel, scene_id, role, content, created_at) VALUES ('cena', 99, 'jogador', 'x', 't')",
        ]
        for sql in attempts:
            with pytest.raises(sqlite3.IntegrityError):
                db.execute(sql)


# ------------------------------------------------------------------ sorteios
def test_criacao_grava_lugar_inicial_e_periodo_sorteado(env):
    _, _, journeys = env
    expected = random.Random(7).choice(DAY_PERIODS)
    content, summary = create(journeys, rng=random.Random(7), place=2)
    assert summary.day_period == expected
    assert summary.location == content["places"][2]["name"]
    with journeys.open_journey(summary.id) as journey:
        meta = journey.summary()
        assert meta["start_place_id"] == content["places"][2]["id"] and meta["day_period"] == expected


def test_sorteios_tem_peso_igual():
    rng = random.Random(3)
    periods = [draw_day_period(rng) for _ in range(6000)]
    assert set(periods) == set(DAY_PERIODS) == {"madrugada", "amanhecer", "manha", "tarde", "entardecer", "noite"}
    assert all(800 < periods.count(p) < 1200 for p in DAY_PERIODS)
    tones = [draw_tone(rng).id for _ in range(6000)]
    assert set(tones) == {
        "em_movimento", "chegada", "encontro", "rotina_interrompida", "em_apuros", "consequencia",
    } == {t.id for t in TONES}
    assert all(800 < tones.count(t.id) < 1200 for t in TONES)


# ------------------------------------------------------------------ validação das propostas
@pytest.mark.parametrize(
    "raw",
    [
        "não é json",
        "[]",
        '{"motive": "x", "participants": []}',  # sem título
        '{"title": "", "motive": "x", "participants": []}',
        json.dumps({"title": "t" * 81, "motive": "x", "participants": []}),
        '{"motive": "x"}',
        '{"motive": "", "participants": []}',
        '{"motive": "   ", "participants": []}',
        '{"motive": 3, "participants": []}',
        '{"motive": "x", "participants": "Ana"}',
        '{"motive": "x", "participants": [""]}',
        '{"motive": "x", "participants": [1]}',
        json.dumps({"motive": "x" * 301, "participants": []}),
        json.dumps({"motive": "x", "participants": ["a"] * 7}),
        json.dumps({"motive": "x", "participants": ["a" * 81]}),
        '{"motive": "x", "participants": [], "place_id": "lugar-1"}',  # o lugar é do motor
        '{"motive": "x", "participants": [], "day_period": "noite"}',  # o período é do motor
    ],
)
def test_proposta_de_cena_invalida(raw):
    with pytest.raises(engine.InvalidProposal):
        engine.parse_scene_proposal(raw)


def test_proposta_de_cena_valida():
    p = engine.parse_scene_proposal(
        '```json\n{"title": " A  fuga ", "motive": "  Uma fuga  ", "participants": [" Ana ", "Guarda"]}\n```'
    )
    assert p.motive == "Uma fuga" and p.participants == ("Ana", "Guarda") and p.title == "A fuga"
    assert engine.parse_scene_proposal(
        json.dumps({"title": "t" * 80, "motive": "m" * 300, "participants": ["p" * 80] * 6})
    ).motive
    assert engine.parse_scene_summary('{"summary": " fim "}') == "fim"
    for raw in ('{"summary": ""}', json.dumps({"summary": "s" * 2001}), '{"summary": "a", "x": 1}', "{}"):
        with pytest.raises(engine.InvalidProposal):
            engine.parse_scene_summary(raw)


async def test_novas_tentativas_e_recusa():
    provider = FakeNarratorProvider(
        delay=0, completions=["lixo", '{"motive": ""}', '{"title": "T", "motive": "ok", "participants": []}']
    )

    async def complete(messages):
        return await provider.complete(messages, json_schema=engine.SCENE_PROPOSAL_SCHEMA)

    base = [{"role": "user", "content": "proponha"}]
    proposal = await engine.request_valid(complete, base, engine.parse_scene_proposal)
    assert proposal.motive == "ok" and len(provider.complete_calls) == 3
    retry_messages = provider.complete_calls[1][0]
    assert retry_messages[:1] == base and retry_messages[1] == {"role": "assistant", "content": "lixo"}
    assert "recusada" in retry_messages[2]["content"]

    provider = FakeNarratorProvider(delay=0, completions=["a", "b", "c", '{"motive": "tarde demais", "participants": []}'])
    with pytest.raises(engine.ProposalRejected) as err:
        await engine.request_valid(complete, base, engine.parse_scene_proposal)
    assert err.value.code == "proposta_invalida" and len(err.value.reasons) == 3
    assert len(provider.complete_calls) == 3  # 1 + RETRIES


async def test_provedor_falso_responde_aos_esquemas():
    provider = FakeNarratorProvider(delay=0)
    assert engine.parse_scene_proposal(await provider.complete([], json_schema=engine.SCENE_PROPOSAL_SCHEMA)).motive
    assert engine.parse_scene_summary(await provider.complete([], json_schema=engine.SCENE_SUMMARY_SCHEMA))


# ------------------------------------------------------------------ operações do motor
def test_abrir_e_encerrar_cena(env):
    _, _, journeys = env
    _, summary = create(journeys)
    with journeys.open_journey(summary.id) as journey:
        proposal = engine.SceneProposal("motivo", ("Ana",))
        with pytest.raises(StorageError) as err:
            engine.open_scene_with_opening(
                journey.db, proposal=proposal, place_id="lugar-1", day_period="meio-dia", opening_tone=None, narration="x"
            )
        assert err.value.code == "periodo_invalido"
        scene, message = engine.open_scene_with_opening(
            journey.db, proposal=proposal, place_id="lugar-1", day_period="tarde", opening_tone="chegada", narration=" Abre. "
        )
        assert scene["status"] == "aberta" and scene["participants"] == ["Ana"] and scene["opening_tone"] == "chegada"
        assert message["content"] == "Abre." and message["channel"] == "cena" and message["scene_id"] == scene["id"]
        with pytest.raises(StorageError) as err:
            engine.open_scene_with_opening(
                journey.db, proposal=proposal, place_id="lugar-1", day_period="tarde", opening_tone=None, narration="x"
            )
        assert err.value.code == "abertura_existente"
        with journey.db.transaction() as tx, pytest.raises(StorageError) as err:
            store.insert_scene(tx, place_id="l", day_period="tarde", motive="m", participants=[], opening_tone=None, now="t")
        assert err.value.code == "cena_ja_aberta"
        closed = engine.close_open_scene(journey.db, "resumo")
        assert closed["status"] == "encerrada" and closed["summary"] == "resumo" and closed["closed_at"]
        with pytest.raises(StorageError) as err:
            engine.close_open_scene(journey.db, "de novo")
        assert err.value.code == "sem_cena_aberta"


# ------------------------------------------------------------------ contexto
def sheet() -> dict:
    return {
        "name": "Ilsa", "concept": "Batedora", "appearance": "Alta", "history": "Fugiu de casa",
        "ambition": {"text": "Reaver a casa"}, "desire": {"text": "Uma noite de sono"},
        "convictions": [{"text": "Nunca abandono", "pillar": "Lealdade"}],
    }


def test_contexto_aduran_e_narrador_da_cena():
    world = generate_world(476)["content"]
    history = [
        {"role": "narrador", "content": "Abertura"},
        {"role": "jogador", "content": "Olho em volta"},
        {"role": "jogador", "content": "E espero"},
    ]
    out = ctx.chat_context(world=world, character=sheet(), day_period="noite", scene=None, history=history)
    system = out[0]["content"]
    assert out[0]["role"] == "system" and "Aduran" in system and "Fora de Cena" in system
    assert "Narrador da Cena" not in system and "Cena aberta:" not in system
    for piece in (world["name"], world["era"]["name"], world["tone"]["name"], world["calendar"]["name"],
                  world["religions"][0]["name"], world["places"][0]["name"], "Ilsa", "Batedora", "Fugiu de casa",
                  "Reaver a casa", "Uma noite de sono", "Nunca abandono", "Período do dia atual: Noite"):
        assert piece in system
    # A conversa alterna usuário e assistente: marca de início antes da fala do Narrador; falas seguidas unidas.
    assert [m["role"] for m in out[1:]] == ["user", "assistant", "user"]
    assert out[-1]["content"] == "Olho em volta\n\nE espero"
    scene = {"place_id": world["places"][1]["id"], "day_period": "noite", "motive": "Fuga pela ponte", "participants": ["Guarda"]}
    out = ctx.chat_context(world=world, character=sheet(), day_period="noite", scene=scene, history=[],
                           previous=[{"summary": "Chegou à vila."}])
    system = out[0]["content"]
    assert "Narrador da Cena" in system and "Aduran" not in system
    assert "Fuga pela ponte" in system and "Guarda" in system and world["places"][1]["name"] in system
    assert "Chegou à vila." in system
    assert "Não role dados" in system and "Não inicie combate" in system
