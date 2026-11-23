"""Migração journey/0002 (personagem), leitura e escrita do personagem e criação atômica de Jornada."""

from __future__ import annotations

import shutil
import sqlite3
from collections.abc import Iterator
from pathlib import Path

import pytest

from henduran.db import open_app_database
from henduran.db import migrations as mig_mod
from henduran.narrative.periods import DAY_PERIODS
from henduran.paths import DataPaths
from henduran.rules import fatia1 as R
from henduran.rules.creation import validate_character
from henduran.services import journey_creation as jc
from henduran.services.journey_creation import (
    JourneyCreationFailed,
    JourneyCreationInvalid,
    create_journey_with_character,
    default_journey_name,
)
from henduran.settings import SettingsStore
from henduran.storage import JourneyStore, StorageError, WorldStore
from henduran.storage import character as character_mod
from henduran.storage import journeys as journeys_mod
from henduran.worldgen import generate_world

from .drafts import ATTRIBUTES, valid_draft


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


def folders(paths: DataPaths) -> list[str]:
    out = []
    for root in (paths.journeys_dir, paths.worlds_dir):
        if root.is_dir():
            out += [f"{root.name}/{p.name}" for p in root.iterdir()]
    return out


def create(journeys: JourneyStore, seed: int = 476, **kwargs):
    content = generate_world(seed)["content"]
    args = {
        "world_content": content,
        "start_place_id": content["places"][1]["id"],
        "character": valid_draft(),
    } | kwargs
    return content, create_journey_with_character(journeys, **args)


# ------------------------------------------------------------------ migração 0002
def test_jornada_criada_so_com_0001_migra_com_backup(env, monkeypatch):
    paths, worlds, journeys = env
    original = mig_mod.MIGRATIONS_ROOT
    only_first = paths.root.parent / "sets"
    shutil.copytree(original, only_first, ignore=shutil.ignore_patterns("__pycache__"))
    for extra in (only_first / "journey").glob("*.sql"):
        if not extra.name.startswith("0001_"):
            extra.unlink()
    monkeypatch.setattr(mig_mod, "MIGRATIONS_ROOT", only_first)
    wid = worlds.create_world("Antigo")
    jid = journeys.create_journey("Jornada antiga", wid)
    with journeys.open_journey(jid) as journey:
        assert journey.db.query_one("SELECT MAX(version) FROM schema_migrations")[0] == 1
        journey.update_summary(character_name="Antes", location="Vila")
    [old] = journeys.list_journeys()
    assert old.status == "ok" and old.rules_version is None and old.schema_version == 1

    monkeypatch.setattr(mig_mod, "MIGRATIONS_ROOT", original)
    with journeys.open_journey(jid) as journey:
        assert journey.db.query_one("SELECT MAX(version) FROM schema_migrations")[0] == mig_mod.latest_version("journey")
        summary = journey.summary()
        assert summary["rules_version"] == "fatia-1"
        assert summary["character_name"] == "Antes" and summary["location"] == "Vila"
        assert journey.character_sheet() is None and journey.read_character() is None
        journey.write_character(validate_character(valid_draft()).character)
        assert journey.character_sheet()["name"] == "Ilsa Corvalho"
        with pytest.raises(StorageError) as err:
            journey.write_character(validate_character(valid_draft()).character)
        assert err.value.code == "personagem_existente"
    [backup] = journeys.list_backups(jid)
    assert backup.schema_version == 1 and backup.name.startswith("journey-v1-")
    copy = sqlite3.connect(paths.journey_backups_dir(jid) / backup.name)
    try:
        assert copy.execute("SELECT MAX(version) FROM schema_migrations").fetchone()[0] == 1
        assert copy.execute("SELECT character_name FROM journey_meta").fetchone()[0] == "Antes"
    finally:
        copy.close()
    [migrated] = journeys.list_journeys()
    assert migrated.rules_version == "fatia-1" and migrated.character_name == "Ilsa Corvalho"


@pytest.fixture
def opened(env):
    _, worlds, journeys = env
    jid = journeys.create_journey("J", worlds.create_world("M"))
    with journeys.open_journey(jid) as journey:
        yield journey


def test_restricoes_do_esquema_do_personagem(opened):
    db = opened.db
    attempts = [
        "INSERT INTO character_attributes (attribute, value) VALUES ('forca', 2)",  # sem personagem: FK
        "INSERT INTO character (id, name, concept, appearance, history, creation_profile, created_at) "
        "VALUES (2, 'n', 'c', 'a', 'h', 'generalista', 't')",
        "INSERT INTO character (id, name, concept, appearance, history, creation_profile, created_at) "
        "VALUES (1, 'n', 'c', 'a', 'h', 'mestre', 't')",
        "INSERT INTO character (id, name, concept, appearance, history, creation_profile, created_at) "
        "VALUES (1, '', 'c', 'a', 'h', 'generalista', 't')",
    ]
    for sql in attempts:
        with pytest.raises(sqlite3.IntegrityError):
            db.execute(sql)
    opened.write_character(validate_character(valid_draft()).character)
    bad = [
        "INSERT INTO character (id, name, concept, appearance, history, creation_profile, created_at) "
        "VALUES (1, 'n', 'c', 'a', 'h', 'generalista', 't')",  # linha única
        "UPDATE character SET vida_superficial = -1",
        "UPDATE character SET vontade_agravada = -1",
        "UPDATE character_attributes SET value = 6 WHERE attribute = 'forca'",
        "UPDATE character_attributes SET value = 0 WHERE attribute = 'forca'",
        "INSERT INTO character_attributes (attribute, value) VALUES ('forca', 3)",  # repetido
        "UPDATE character_skills SET value = 6 WHERE skill = 'lutar'",
        "UPDATE character_skills SET value = -1 WHERE skill = 'lutar'",
        "INSERT INTO convictions (position, text, pillar) VALUES (4, 't', 'p')",
        "INSERT INTO convictions (position, text, pillar) VALUES (0, 't', 'p')",
        "UPDATE convictions SET fractures = 3 WHERE position = 1",
        "UPDATE convictions SET pillar = '' WHERE position = 1",
        "INSERT INTO objectives (kind, text, created_at) VALUES ('ambicao', 'Outra', 't')",  # 2ª ativa
        "INSERT INTO objectives (kind, text, created_at) VALUES ('meta', 'x', 't')",
        "INSERT INTO objectives (kind, text, status, created_at, closed_at) VALUES ('desejo', 'x', 'perdido', 't', 't')",
        "INSERT INTO objectives (kind, text, status, created_at, closed_at) VALUES ('desejo', 'x', 'ativo', 't', 't')",
        "UPDATE objectives SET status = 'concluido' WHERE kind = 'desejo'",  # sem closed_at
        "INSERT INTO character_skills (skill, value, character_id) VALUES ('nova', 1, 7)",  # FK
    ]
    for sql in bad:
        with pytest.raises(sqlite3.IntegrityError):
            db.execute(sql)
    # Trocar o Desejo: encerra o atual (com motivo e data) e então cria outro ativo.
    db.execute("UPDATE objectives SET status = 'concluido', closed_at = 't2' WHERE kind = 'desejo'")
    db.execute("INSERT INTO objectives (kind, text, created_at) VALUES ('desejo', 'Novo desejo', 't3')")
    db.execute("UPDATE objectives SET status = 'impossivel', closed_at = 't4' WHERE kind = 'ambicao'")
    with pytest.raises(sqlite3.IntegrityError):
        db.execute("INSERT INTO objectives (kind, text, created_at) VALUES ('desejo', 'Terceiro', 't5')")
    sheet = opened.character_sheet()
    assert sheet["desire"]["text"] == "Novo desejo" and sheet["ambition"] is None
    counts = db.query_one(
        "SELECT (SELECT COUNT(*) FROM objectives) AS o, (SELECT COUNT(*) FROM objectives WHERE status = 'ativo') AS a"
    )
    assert (counts["o"], counts["a"]) == (3, 1)
    # Remover o personagem remove tudo o que depende dele (chave estrangeira em cascata).
    db.execute("DELETE FROM character")
    for table in ("character_attributes", "character_skills", "convictions", "objectives"):
        assert db.query_one(f"SELECT COUNT(*) FROM {table}")[0] == 0


def test_ida_e_volta_do_personagem(opened):
    char = validate_character(valid_draft("especialista")).character
    opened.write_character(char)
    sheet = opened.character_sheet()
    assert sheet["name"] == char.name and sheet["concept"] == char.concept
    assert sheet["appearance"] == char.appearance and sheet["history"] == char.history
    assert sheet["skill_profile"] == "especialista"
    assert sheet["attributes"] == ATTRIBUTES and list(sheet["attributes"]) == list(R.ATTRIBUTE_IDS)
    assert sheet["skills"] == dict(char.skills) and len(sheet["skills"]) == 22
    assert [(c["position"], c["text"], c["pillar"], c["fractures"]) for c in sheet["convictions"]] == [
        (i, c.text, c.pillar, 0) for i, c in enumerate(char.convictions, start=1)
    ]
    assert sheet["ambition"]["text"] == char.ambition and sheet["desire"]["text"] == char.desire
    assert sheet["tracks"] == {
        "vida": {"size": 3 + ATTRIBUTES["vigor"], "superficial": 0, "agravada": 0},
        "vontade": {"size": 3 + ATTRIBUTES["determinacao"], "superficial": 0, "agravada": 0},
    }
    assert sheet["derived"] == {"vida": 6, "vontade": 6}
    assert sheet["rules_version"] == "fatia-1"
    assert opened.summary()["character_name"] == char.name


def test_escrita_do_personagem_e_uma_transacao(opened, monkeypatch):
    real = character_mod.write_character

    def broken(tx, character, now):
        real(tx, character, now)
        raise RuntimeError("falha depois de gravar tudo")

    monkeypatch.setattr(character_mod, "write_character", broken)
    with pytest.raises(RuntimeError):
        opened.write_character(validate_character(valid_draft()).character)
    for table in ("character", "character_attributes", "character_skills", "convictions", "objectives"):
        assert opened.db.query_one(f"SELECT COUNT(*) FROM {table}")[0] == 0
    assert opened.summary()["character_name"] is None


# ------------------------------------------------------------------ criação atômica
def test_criacao_caminho_feliz(env):
    paths, worlds, journeys = env
    content, summary = create(journeys)
    assert summary.status == "ok"
    assert summary.name == "A Jornada de Ilsa Corvalho"
    assert summary.character_name == "Ilsa Corvalho"
    assert summary.location == content["places"][1]["name"]
    assert summary.day_period in DAY_PERIODS
    assert summary.rules_version == "fatia-1"
    assert summary.world_version == 1 and summary.world_name == content["name"]
    assert summary.last_saved_at and summary.created_at
    assert summary.schema_version == mig_mod.latest_version("journey")
    [world] = worlds.list_worlds()
    assert world.id == summary.world_id and world.versions == [1]
    assert journeys.last_journey_id is None  # só abrir marca a última jogada
    with journeys.open_journey(summary.id) as journey:
        assert journey.world_id == summary.world_id and journey.world_version == 1
        assert journey.world_content() == content
        sheet = journey.character_sheet()
        assert sheet["name"] == "Ilsa Corvalho" and sheet["tracks"]["vida"]["size"] == 6
        assert len(sheet["convictions"]) == 3
    # Nada foi gravado no Mundo depois de criado: uma só versão, sem tabelas de Jornada.
    conn = sqlite3.connect(paths.world_db_file(summary.world_id))
    try:
        tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
        assert "character" not in tables and "journey_meta" not in tables
    finally:
        conn.close()


def test_nome_da_jornada_opcional_e_longo(env):
    _, _, journeys = env
    _, summary = create(journeys, name="  Crônicas do Vale  ")
    assert summary.name == "Crônicas do Vale"
    long_name = default_journey_name("x" * 200)
    assert len(long_name) == 200 and long_name.endswith("…")
    _, summary = create(journeys, seed=1, character=valid_draft(name="y" * 200))
    assert len(summary.name) == 200


def test_criacao_invalida_nao_grava_nada(env):
    paths, _, journeys = env
    content = generate_world(5)["content"]
    content["places"][0]["name"] = ""
    with pytest.raises(JourneyCreationInvalid) as err:
        create_journey_with_character(
            journeys, world_content=content, start_place_id="lugar-1", character=valid_draft(attributes={}), name=3
        )
    fields = {(e["field"], e["code"]) for e in err.value.error_dicts()}
    assert ("world.content.places[0].name", "obrigatorio") in fields
    assert ("character.attributes.forca", "atributo_ausente") in fields
    assert ("name", "tipo_invalido") in fields
    with pytest.raises(JourneyCreationInvalid) as err:
        create(journeys, start_place_id="lugar-99")
    assert {(e.field, e.code) for e in err.value.errors} == {("start_place_id", "lugar_desconhecido")}
    with pytest.raises(JourneyCreationInvalid) as err:
        create(journeys, start_place_id=None)
    assert {(e.field, e.code) for e in err.value.errors} == {("start_place_id", "obrigatorio")}
    assert folders(paths) == []


def _fail_world_migration(monkeypatch):
    from henduran.storage import worlds as worlds_mod

    def boom(*args, **kwargs):
        raise sqlite3.OperationalError("disco cheio (simulado)")

    monkeypatch.setattr(worlds_mod, "migrate", boom)


def _fail_journey_migration(monkeypatch):
    def boom(*args, **kwargs):
        raise sqlite3.OperationalError("disco cheio (simulado)")

    monkeypatch.setattr(journeys_mod, "migrate", boom)


def _fail_character(monkeypatch):
    real = character_mod.write_character

    def broken(tx, character, now):
        real(tx, character, now)
        raise sqlite3.OperationalError("falha ao gravar o personagem (simulada)")

    monkeypatch.setattr(character_mod, "write_character", broken)


def _fail_meta_update(monkeypatch):
    # rules_version é NOT NULL: o UPDATE do resumo falha depois de o personagem ter sido gravado.
    monkeypatch.setattr(jc.R, "RULES_VERSION", None)


def _fail_check(monkeypatch):
    def boom(self, journey_id):
        raise StorageError("banco_inacessivel", "leitura falhou (simulada)")

    monkeypatch.setattr(JourneyStore, "get_summary", boom)


def _bad_status(monkeypatch):
    real = JourneyStore.get_summary

    def damaged(self, journey_id):
        summary = real(self, journey_id)
        summary.status, summary.error_code = "danificada", "banco_danificado"
        return summary

    monkeypatch.setattr(JourneyStore, "get_summary", damaged)


@pytest.mark.parametrize(
    "inject,step",
    [
        (_fail_world_migration, "criar_mundo"),
        (_fail_journey_migration, "criar_jornada"),
        (_fail_character, "criar_jornada"),
        (_fail_meta_update, "criar_jornada"),
        (_fail_check, "conferir"),
        (_bad_status, "conferir"),
    ],
)
def test_falha_injetada_em_cada_etapa_limpa_tudo(env, monkeypatch, inject, step):
    paths, worlds, journeys = env
    _, kept = create(journeys, seed=99)  # uma Jornada que já existia não é tocada
    before = folders(paths)
    inject(monkeypatch)
    with pytest.raises(JourneyCreationFailed) as err:
        create(journeys)
    assert err.value.code == "criacao_falhou" and err.value.step == step
    assert err.value.leftovers == []
    assert "Nada foi mantido" in str(err.value)
    assert folders(paths) == before
    monkeypatch.undo()
    assert [j.id for j in journeys.list_journeys()] == [kept.id]
    assert [w.id for w in worlds.list_worlds()] == [kept.world_id]


def test_compensacao_que_falha_e_relatada(env, monkeypatch):
    paths, worlds, journeys = env
    _fail_check(monkeypatch)

    def stuck(self, world_id):
        raise StorageError("exclusao_falhou", "arquivo em uso (simulado)")

    monkeypatch.setattr(WorldStore, "discard_new_world", stuck)
    with pytest.raises(JourneyCreationFailed) as err:
        create(journeys)
    assert len(err.value.leftovers) == 1 and err.value.leftovers[0].startswith("Mundo ")
    assert "Não foi possível remover" in str(err.value)
    assert [p.split("/")[0] for p in folders(paths)] == ["worlds"]  # a Jornada saiu; o Mundo ficou e foi relatado


def test_descartar_jornada_aberta_e_recusado(env):
    _, _, journeys = env
    _, summary = create(journeys)
    with journeys.open_journey(summary.id):
        with pytest.raises(StorageError) as err:
            journeys.discard_new_journey(summary.id)
        assert err.value.code == "jornada_aberta"
    journeys.discard_new_journey(summary.id)
    journeys.discard_new_journey(summary.id)  # já removida: sem erro
    assert journeys.list_journeys() == []


def test_nada_fica_preso_em_caminho_com_acentos(tmp_path):
    paths = DataPaths(tmp_path / "Dados ç" / "Henduran ação").ensure()
    app_db, _ = open_app_database(paths.database_file)
    try:
        worlds = WorldStore(paths)
        journeys = JourneyStore(paths, worlds, SettingsStore(app_db))
        _, summary = create(journeys)
        with journeys.open_journey(summary.id) as journey:
            assert journey.character_sheet()["name"] == "Ilsa Corvalho"
        journeys.delete_journey(summary.id, confirm=True)
        assert not Path(paths.journey_dir(summary.id)).exists()
    finally:
        app_db.close()
