"""Conjuntos de migrações (app, journey, world), checksum normalizado e compatibilidade (ADR-074/075)."""

from __future__ import annotations

import hashlib
import shutil
import sqlite3
from pathlib import Path

import pytest

from henduran.db import Database, MigrationError, migrate, open_app_database
from henduran.db import migrations as mig_mod
from henduran.db.migrations import (
    MIGRATION_SETS,
    load_migration_set,
    load_migrations,
    migration_checksum,
)

# SHA-256 do 0001 do app em LF, igual ao conteúdo versionado no Git (e ao gravado
# por clones sem conversão de finais de linha).
APP_0001_LF_SHA256 = "2fc0e3eddd5a1d5c23dc570e898d09876d5fac104d4e6d09c6ca9cfc8121d7ca"
# O mesmo arquivo em CRLF (clone com core.autocrlf=true), como o código antigo gravava.
APP_0001_CRLF_SHA256 = "75592af1e0ec0ce29dbcb2a9a2e28091cdc5827745095b054c194c0f794f809c"


def tables(db: Database) -> set[str]:
    return {r["name"] for r in db.query_all("SELECT name FROM sqlite_master WHERE type = 'table'")}


def test_tres_conjuntos_com_numeracao_propria():
    assert MIGRATION_SETS == ("app", "journey", "world")
    for name in MIGRATION_SETS:
        known = load_migration_set(name)
        # journey/0002 a 0006 (0005: descrição e História formatada; 0006: aparência opcional); world/0002: semente; app só a 0001
        expected = {"journey": [1, 2, 3, 4, 5, 6], "world": [1, 2], "app": [1]}[name]
        assert [m.version for m in known] == expected
        assert known[0].name == "initial"
    assert mig_mod.MIGRATIONS_DIR == mig_mod.MIGRATIONS_ROOT / "app"
    assert not list(mig_mod.MIGRATIONS_ROOT.glob("*.sql"))  # nada solto fora dos conjuntos
    with pytest.raises(MigrationError) as err:
        load_migration_set("outro")
    assert err.value.code == "conjunto_desconhecido"


def test_conjuntos_sao_independentes(tmp_path):
    created: dict[str, set[str]] = {}
    for name in MIGRATION_SETS:
        db = Database(tmp_path / f"{name}.db")
        try:
            assert migrate(db, migration_set=name).applied == [m.version for m in load_migration_set(name)]
            created[name] = tables(db) - {"schema_migrations", "sqlite_sequence"}
        finally:
            db.close()
    assert created["app"] == {"settings", "app_meta"}
    assert created["journey"] == {
        "journey_meta", "character", "character_attributes", "character_skills", "convictions", "objectives",
        "scenes", "messages", "places", "scene_proposals", "events",
    }
    assert created["world"] == {"world_meta", "world_versions"}


def test_checksum_do_app_continua_igual_ao_gravado():
    mig = load_migration_set("app")[0]
    assert mig.checksum == APP_0001_LF_SHA256
    assert mig.matches(APP_0001_CRLF_SHA256)  # registro antigo feito sobre o arquivo em CRLF
    assert not mig.matches("0" * 64)
    assert "\r" not in mig.sql


def test_checksum_normalizado_crlf_e_lf(tmp_path):
    text = "-- comentário ç\nCREATE TABLE a (x TEXT DEFAULT 'a;b');\nCREATE TABLE b (y);\n"
    lf = tmp_path / "lf"
    crlf = tmp_path / "crlf"
    lf.mkdir()
    crlf.mkdir()
    (lf / "0001_um.sql").write_bytes(text.encode("utf-8"))
    (crlf / "0001_um.sql").write_bytes(text.replace("\n", "\r\n").encode("utf-8"))
    a, b = load_migrations(lf)[0], load_migrations(crlf)[0]
    assert a.checksum == b.checksum == hashlib.sha256(text.encode("utf-8")).hexdigest()
    assert migration_checksum(b"x\r\ny\rz\n") == migration_checksum(b"x\ny\nz\n")
    # Aplicada a partir de um clone em CRLF, confere sem erro num clone em LF.
    db = Database(tmp_path / "x.db")
    try:
        migrate(db, migrations=[b])
        assert migrate(db, migrations=[a]).applied == []
    finally:
        db.close()


@pytest.mark.parametrize("recorded", [APP_0001_LF_SHA256, APP_0001_CRLF_SHA256])
def test_banco_do_app_criado_pelo_codigo_antigo_abre(tmp_path, recorded):
    """Banco criado com o arquivo antigo (``migrations/0001_initial.sql``, SHA-256 dos bytes crus)."""
    old_file = tmp_path / "0001_initial.sql"
    shutil.copyfile(mig_mod.MIGRATIONS_DIR / "0001_initial.sql", old_file)
    raw = old_file.read_bytes().replace(b"\r\n", b"\n")
    if recorded == APP_0001_CRLF_SHA256:
        raw = raw.replace(b"\n", b"\r\n")
    assert hashlib.sha256(raw).hexdigest() == recorded  # o que o código antigo gravaria
    path = tmp_path / "dados" / "henduran.db"
    path.parent.mkdir()
    conn = sqlite3.connect(path)
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute(
        "CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, "
        "checksum TEXT NOT NULL, applied_at TEXT NOT NULL)"
    )
    conn.executescript(raw.decode("utf-8"))
    conn.execute("INSERT INTO settings (key, value, updated_at) VALUES ('context_size', '8192', 'x')")
    conn.execute(
        "INSERT INTO schema_migrations VALUES (1, 'initial', ?, '2026-11-23T00:00:00Z')", (recorded,)
    )
    conn.commit()
    conn.close()
    db, result = open_app_database(path)
    try:
        assert result.version == 1 and result.applied == [] and result.backup is None
        assert db.query_one("SELECT value FROM settings WHERE key = 'context_size'")["value"] == "8192"
        assert db.query_one("SELECT checksum FROM schema_migrations")["checksum"] == recorded  # não reescrito
    finally:
        db.close()
    assert not (path.parent / "backups").exists()


def _copy_sets(dest: Path, extra: dict[str, str]) -> Path:
    """Cópia dos conjuntos reais com uma migração extra (a seguinte à última real) nos conjuntos de ``extra``."""
    shutil.copytree(mig_mod.MIGRATIONS_ROOT, dest, ignore=shutil.ignore_patterns("__pycache__"))
    for name, sql in extra.items():
        nxt = mig_mod.latest_version(name) + 1
        (dest / name / f"{nxt:04d}_extra.sql").write_text(sql, encoding="utf-8")
    return dest


@pytest.mark.parametrize("name,prefix", [("app", "henduran"), ("journey", "journey"), ("world", "world")])
def test_backup_antes_de_migrar_e_banco_mais_novo_por_conjunto(tmp_path, monkeypatch, name, prefix):
    original = mig_mod.MIGRATIONS_ROOT
    db = Database(tmp_path / "x.db")
    try:
        migrate(db, migration_set=name)
        current = mig_mod.latest_version(name)
        root = _copy_sets(tmp_path / "sets", {name: "CREATE TABLE extra_teste (x INTEGER);\n"})
        monkeypatch.setattr(mig_mod, "MIGRATIONS_ROOT", root)
        result = migrate(db, migration_set=name, backups_dir=tmp_path / "bk")
        assert result.applied == [current + 1]
        assert result.backup is not None and result.backup.name.startswith(f"{prefix}-v{current}-")
        copy = sqlite3.connect(result.backup)
        try:
            assert copy.execute("SELECT MAX(version) FROM schema_migrations").fetchone()[0] == current
        finally:
            copy.close()
        # O app (sem a migração extra) recusa o banco mais novo, sem alterá-lo.
        monkeypatch.setattr(mig_mod, "MIGRATIONS_ROOT", original)
        with pytest.raises(MigrationError) as err:
            migrate(db, migration_set=name)
        assert err.value.code == "banco_mais_novo"
        assert "extra_teste" in tables(db)
    finally:
        db.close()


def test_rotacao_por_prefixo_nao_mistura_conjuntos(tmp_path):
    from datetime import datetime, timedelta

    from henduran.db.migrations import backup_database

    db = Database(tmp_path / "x.db")
    try:
        db.execute("CREATE TABLE a (x)")
        folder = tmp_path / "b"
        base = datetime(2026, 1, 1)
        app_copy = backup_database(db, folder, 1, now=base)  # prefixo henduran
        made = [backup_database(db, folder, 1, now=base + timedelta(minutes=i), prefix="journey") for i in range(7)]
        names = sorted(p.name for p in folder.iterdir())
        assert app_copy.name in names
        assert [p.name for p in made[2:]] == sorted(n for n in names if n.startswith("journey-"))
    finally:
        db.close()
