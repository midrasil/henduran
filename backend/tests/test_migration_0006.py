"""Migração journey/0006: aparência opcional, reconstruindo ``character`` sem perder nada."""

from __future__ import annotations

import shutil

import pytest

from henduran.db import migrations as mig_mod
from henduran.services.journey_creation import create_journey_with_character
from henduran.worldgen import generate_world

from .drafts import valid_draft
from .test_narrative import env  # noqa: F401

TABLES = {
    "character": "SELECT * FROM character",
    "character_attributes": "SELECT * FROM character_attributes ORDER BY attribute",
    "character_skills": "SELECT * FROM character_skills ORDER BY skill",
    "convictions": "SELECT * FROM convictions ORDER BY position",
    "objectives": "SELECT * FROM objectives ORDER BY id",
    "scenes": "SELECT * FROM scenes ORDER BY id",
    "messages": "SELECT * FROM messages ORDER BY id",
    "events": "SELECT * FROM events ORDER BY id",
    "journey_meta": "SELECT * FROM journey_meta",
}


def dump(db) -> dict[str, list[dict]]:
    return {name: [dict(r) for r in db.query_all(sql)] for name, sql in TABLES.items()}


@pytest.fixture
def before_0006(env, monkeypatch):  # noqa: F811
    """Conjunto de migrações só até a 0005 (como um banco gravado antes desta versão)."""
    paths, worlds, journeys = env
    original = mig_mod.MIGRATIONS_ROOT
    sets = paths.root.parent / "sets"
    shutil.copytree(original, sets, ignore=shutil.ignore_patterns("__pycache__"))
    for extra in (sets / "journey").glob("*.sql"):
        if extra.name[:4] > "0005":
            extra.unlink()
    monkeypatch.setattr(mig_mod, "MIGRATIONS_ROOT", sets)
    yield journeys, lambda: monkeypatch.setattr(mig_mod, "MIGRATIONS_ROOT", original)


def test_0006_preserva_todos_os_dados(before_0006):
    journeys, restore = before_0006
    content = generate_world(476)["content"]
    summary = create_journey_with_character(
        journeys,
        world_content=content,
        start_place_id=content["places"][1]["id"],
        character=valid_draft(history_html="<h3>Origens</h3><p>Cresceu no <strong>porto</strong>.</p>", age="31"),
    )
    with journeys.open_journey(summary.id) as journey:
        db = journey.db
        assert db.query_one("SELECT MAX(version) FROM schema_migrations")[0] == 5
        ambition = db.query_one("SELECT id FROM objectives WHERE kind = 'ambicao'")["id"]
        with db.transaction() as tx:
            tx.execute(
                "UPDATE character SET vida_superficial = 2, vontade_agravada = 1, portrait_file = 'portrait.png', "
                "portrait_crop = '{\"x\": 0.25, \"y\": 0.5, \"zoom\": 2}'"
            )
            tx.execute("UPDATE convictions SET fractures = 1 WHERE position = 2")
            tx.execute(
                "INSERT INTO scenes (place_id, day_period, motive, opened_at, objective_id) VALUES (?, 'tarde', 'm', 't', ?)",
                (content["places"][1]["id"], ambition),
            )
            tx.execute("INSERT INTO messages (channel, scene_id, role, content, created_at) VALUES ('cena', 1, 'narrador', 'x', 't')")
        old = dump(db)
    restore()
    with journeys.open_journey(summary.id) as journey:
        db = journey.db
        assert db.query_one("SELECT MAX(version) FROM schema_migrations")[0] == 6
        assert dump(db) == old
        assert db.query_all("PRAGMA foreign_key_check") == []
        assert db.query_one("SELECT name FROM sqlite_master WHERE name LIKE 'm0006_%' OR name = 'character_new'") is None
        sheet = journey.character_sheet()
        assert sheet["appearance"] == "Alta, cabelo raspado, cicatriz no queixo."
        assert sheet["portrait"] == {"crop": {"x": 0.25, "y": 0.5, "zoom": 2}, "url_path": "/journeys/current/portrait"}
        assert sheet["tracks"]["vida"]["superficial"] == 2
        # A cascata continua: as chaves de character_* ainda apontam para a tabela nova.
        fks = {r["table"] for r in db.query_all("PRAGMA foreign_key_list(character_attributes)")}
        assert fks == {"character"}
        # Aparência vazia agora é aceita; o limite continua.
        db.execute("UPDATE character SET appearance = ''")
        with pytest.raises(Exception):
            db.execute("UPDATE character SET appearance = ?", ("x" * 4001,))
    assert [b.schema_version for b in journeys.list_backups(summary.id)] == [5]


def test_personagem_sem_aparencia_e_criado_e_lido(env):  # noqa: F811
    _, _, journeys = env
    content = generate_world(476)["content"]
    draft = valid_draft()
    draft["appearance"] = "   "
    summary = create_journey_with_character(
        journeys, world_content=content, start_place_id=content["places"][0]["id"], character=draft
    )
    with journeys.open_journey(summary.id) as journey:
        assert journey.character_sheet()["appearance"] == ""
