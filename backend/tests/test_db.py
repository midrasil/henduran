"""Banco do app: conexão, PRAGMAs, transações, concorrência, corrupção, migrações e backups."""

from __future__ import annotations

import asyncio
import hashlib
import sqlite3
import threading
from collections.abc import Iterator
from datetime import datetime, timedelta
from pathlib import Path

import pytest

from henduran.db import Database, DatabaseError, MigrationError, migrate, open_app_database, schema_version
from henduran.db import migrations as mig_mod
from henduran.db.migrations import Migration, backup_database, load_migrations, rotate_backups, split_statements


@pytest.fixture
def opened() -> Iterator[list[Database]]:
    dbs: list[Database] = []
    yield dbs
    for db in dbs:
        db.close()


@pytest.fixture
def open_db(tmp_path, opened):
    def make(path: Path | None = None) -> Database:
        db = Database(path or tmp_path / "henduran.db")
        opened.append(db)
        return db

    return make


def make_migration(version: int, name: str, sql: str) -> Migration:
    return Migration(version, name, sql, hashlib.sha256(sql.encode()).hexdigest())


def write_migrations(folder: Path, files: dict[str, str]) -> Path:
    folder.mkdir(parents=True, exist_ok=True)
    for name, sql in files.items():
        (folder / name).write_text(sql, encoding="utf-8")
    return folder


def tables(db: Database) -> set[str]:
    return {r["name"] for r in db.query_all("SELECT name FROM sqlite_master WHERE type = 'table'")}


# ------------------------------------------------------------------ conexão
def test_pragmas_efetivos(open_db):
    db = open_db()
    assert db.pragma("journal_mode") == "wal"
    assert db.pragma("foreign_keys") == 1
    assert db.pragma("busy_timeout") == 5000
    assert db.pragma("synchronous") == 1  # NORMAL
    # As conexões de leitura também checam chaves estrangeiras.
    assert db.query_one("PRAGMA foreign_keys")[0] == 1
    assert db.recovered is False


def test_transacao_confirma_e_desfaz_em_excecao(open_db):
    db = open_db()
    db.execute("CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)")
    with db.transaction() as tx:
        tx.execute("INSERT INTO t (v) VALUES (?)", ("a",))
        # Leitura na mesma thread enxerga o que ainda não foi confirmado.
        assert db.query_one("SELECT COUNT(*) FROM t")[0] == 1
    with pytest.raises(RuntimeError):
        with db.transaction() as tx:
            tx.execute("INSERT INTO t (v) VALUES (?)", ("b",))
            db.execute("INSERT INTO t (v) VALUES (?)", ("c",))  # junta-se à transação aberta
            raise RuntimeError("falha")
    assert [r["v"] for r in db.query_all("SELECT v FROM t")] == ["a"]


def test_transacao_aninhada_usa_savepoint(open_db):
    db = open_db()
    db.execute("CREATE TABLE t (v TEXT)")
    with db.transaction() as tx:
        tx.execute("INSERT INTO t VALUES ('fora')")
        with pytest.raises(ValueError):
            with db.transaction() as inner:
                inner.execute("INSERT INTO t VALUES ('dentro')")
                raise ValueError
    assert [r["v"] for r in db.query_all("SELECT v FROM t")] == ["fora"]


def test_leitor_nao_ve_transacao_aberta_de_outra_thread(open_db):
    db = open_db()
    db.execute("CREATE TABLE t (v TEXT)")
    seen: list[int] = []
    with db.transaction() as tx:
        tx.execute("INSERT INTO t VALUES ('x')")
        th = threading.Thread(target=lambda: seen.append(db.query_one("SELECT COUNT(*) FROM t")[0]))
        th.start()
        th.join(5)
    assert seen == [0]
    assert db.query_one("SELECT COUNT(*) FROM t")[0] == 1


def test_sql_parametrizado_com_aspas(open_db):
    db = open_db()
    db.execute("CREATE TABLE t (v TEXT)")
    evil = "x'); DROP TABLE t; --"
    db.execute("INSERT INTO t VALUES (?)", (evil,))
    assert db.query_one("SELECT v FROM t")["v"] == evil


def test_escrita_concorrente_sem_bloqueio_nem_perda(open_db):
    db = open_db()
    db.execute("CREATE TABLE t (thread INTEGER, n INTEGER)")
    errors: list[BaseException] = []
    threads_n, per_thread = 8, 60

    def work(i: int) -> None:
        try:
            for n in range(per_thread):
                if n % 3 == 0:
                    with db.transaction() as tx:
                        tx.execute("INSERT INTO t VALUES (?, ?)", (i, n))
                else:
                    db.execute("INSERT INTO t VALUES (?, ?)", (i, n))
                db.query_one("SELECT COUNT(*) FROM t")
        except BaseException as exc:  # noqa: BLE001
            errors.append(exc)

    threads = [threading.Thread(target=work, args=(i,)) for i in range(threads_n)]
    for th in threads:
        th.start()
    for th in threads:
        th.join(30)
    assert errors == []
    assert db.query_one("SELECT COUNT(*) FROM t")[0] == threads_n * per_thread
    assert db.query_one("SELECT COUNT(DISTINCT thread || '-' || n) FROM t")[0] == threads_n * per_thread


def test_duas_instancias_no_mesmo_arquivo(open_db, tmp_path):
    a = open_db()
    b = open_db(tmp_path / "henduran.db")
    a.execute("CREATE TABLE t (v INTEGER)")
    errors: list[BaseException] = []

    def work(db: Database) -> None:
        try:
            for i in range(50):
                db.execute("INSERT INTO t VALUES (?)", (i,))
        except BaseException as exc:  # noqa: BLE001
            errors.append(exc)

    ths = [threading.Thread(target=work, args=(d,)) for d in (a, b)]
    for th in ths:
        th.start()
    for th in ths:
        th.join(30)
    assert errors == []
    assert a.query_one("SELECT COUNT(*) FROM t")[0] == 100


async def test_fachada_assincrona(open_db):
    db = open_db()
    await db.aexecute("CREATE TABLE t (v INTEGER)")
    await asyncio.gather(*(db.aexecute("INSERT INTO t VALUES (?)", (i,)) for i in range(20)))

    def tx_work(tx) -> int:
        tx.execute("INSERT INTO t VALUES (?)", (100,))
        return tx.query_one("SELECT COUNT(*) FROM t")[0]

    assert await db.arun_transaction(tx_work) == 21
    assert (await db.aquery_one("SELECT MAX(v) FROM t"))[0] == 100
    assert len(await db.aquery_all("SELECT v FROM t")) == 21


def test_close_libera_o_arquivo(tmp_path):
    path = tmp_path / "henduran.db"
    db = Database(path)
    db.execute("CREATE TABLE t (v INTEGER)")
    db.execute("INSERT INTO t VALUES (1)")
    db.query_one("SELECT * FROM t")  # abre uma conexão de leitura também
    db.close()
    db.close()  # idempotente
    assert not path.with_name("henduran.db-wal").exists() or path.with_name("henduran.db-wal").stat().st_size == 0
    moved = path.with_name("movido.db")
    path.rename(moved)
    moved.unlink()
    for side in ("-wal", "-shm"):
        extra = path.with_name("henduran.db" + side)
        if extra.exists():
            extra.unlink()
    with pytest.raises(DatabaseError) as err:
        db.execute("SELECT 1")
    assert err.value.code == "banco_fechado"


def test_caminho_com_espacos_e_acentos(tmp_path):
    folder = tmp_path / "Meus Dados ç" / "Henduran ação"
    db, result = open_app_database(folder / "henduran.db")
    try:
        assert result.version == 1
        db.execute("INSERT INTO app_meta (key, value) VALUES (?, ?)", ("teste", "ñ"))
        assert db.query_one("SELECT value FROM app_meta WHERE key = 'teste'")["value"] == "ñ"
    finally:
        db.close()
    assert (folder / "henduran.db").is_file()


# --------------------------------------------------------------- corrupção
def test_arquivo_que_nao_e_sqlite_e_preservado_e_recriado(tmp_path):
    path = tmp_path / "henduran.db"
    garbage = b"isto nao e um banco sqlite" * 400
    path.write_bytes(garbage)
    (tmp_path / "henduran.db-wal").write_bytes(b"wal velho")
    db = Database(path)
    try:
        assert db.recovered is True
        assert db.recovered_from is not None
        assert db.recovered_from.name.startswith("henduran.db.corrompido-")
        assert db.recovered_from.read_bytes() == garbage  # nada apagado
        assert db.recovered_from.with_name(db.recovered_from.name + "-wal").read_bytes() == b"wal velho"
        assert db.pragma("journal_mode") == "wal"
        assert migrate(db).version == 1
    finally:
        db.close()


def test_quick_check_falhando_em_banco_danificado(tmp_path):
    path = tmp_path / "henduran.db"
    conn = sqlite3.connect(path)
    conn.execute("PRAGMA page_size = 4096")
    conn.execute("CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)")
    conn.execute("CREATE INDEX t_v ON t (v)")
    conn.executemany("INSERT INTO t (v) VALUES (?)", [(f"valor {i}" * 10,) for i in range(2000)])
    conn.commit()
    conn.close()
    data = bytearray(path.read_bytes())
    assert len(data) > 4096 * 6
    # Estraga páginas do meio (não o cabeçalho): o arquivo ainda abre como SQLite.
    for page in (2, 3, 4, 5):
        start = page * 4096 + 100
        data[start : start + 2000] = b"\xab" * 2000
    path.write_bytes(bytes(data))
    db = Database(path)
    try:
        assert db.recovered is True
        assert db.recovered_from.read_bytes() == bytes(data)
        assert tables(db) == set()  # banco novo
    finally:
        db.close()


def test_erro_que_nao_e_corrupcao_nao_mexe_no_arquivo(tmp_path):
    folder = tmp_path / "pasta"
    folder.mkdir()
    # Um diretório no lugar do arquivo: não abre, mas não é corrupção.
    (folder / "henduran.db").mkdir()
    with pytest.raises(DatabaseError) as err:
        Database(folder / "henduran.db")
    assert err.value.code == "banco_inacessivel"
    assert (folder / "henduran.db").is_dir()


# --------------------------------------------------------------- migrações
def test_migracoes_do_app_sao_validas():
    known = load_migrations()
    assert [m.version for m in known] == [1]
    assert known[0].name == "initial"


def test_migracao_do_zero_e_reexecucao_sem_efeito(open_db):
    db = open_db()
    first = migrate(db)
    assert first.applied == [1] and first.version == 1
    assert first.backup is None  # banco vazio: nada a copiar
    assert {"schema_migrations", "settings", "app_meta"} <= tables(db)
    assert tables(db) == {"schema_migrations", "settings", "app_meta"}
    created = db.query_one("SELECT value FROM app_meta WHERE key = 'created_at'")["value"]
    row = db.query_one("SELECT version, name, checksum, applied_at FROM schema_migrations")
    assert (row["version"], row["name"]) == (1, "initial")
    assert row["checksum"] == load_migrations()[0].checksum
    again = migrate(db)
    assert again.applied == [] and again.version == 1 and again.backup is None
    assert db.query_one("SELECT COUNT(*) FROM schema_migrations")[0] == 1
    assert db.query_one("SELECT value FROM app_meta WHERE key = 'created_at'")["value"] == created
    assert schema_version(db) == 1


def test_schema_version_de_banco_novo_e_zero(open_db):
    assert schema_version(open_db()) == 0


def test_checksum_alterado_e_rejeitado(open_db):
    db = open_db()
    m1 = make_migration(1, "um", "CREATE TABLE a (x INTEGER);")
    migrate(db, migrations=[m1])
    changed = make_migration(1, "um", "CREATE TABLE a (x INTEGER, y TEXT);")
    with pytest.raises(MigrationError) as err:
        migrate(db, migrations=[changed, make_migration(2, "dois", "CREATE TABLE b (x);")])
    assert err.value.code == "checksum_divergente"
    assert "0001" in str(err.value)
    assert "b" not in tables(db)


def test_banco_mais_novo_e_recusado(open_db):
    db = open_db()
    migrate(db, migrations=[make_migration(1, "um", "CREATE TABLE a (x);"), make_migration(2, "dois", "CREATE TABLE b (x);")])
    before = db.query_all("SELECT * FROM schema_migrations")
    with pytest.raises(MigrationError) as err:
        migrate(db, migrations=[make_migration(1, "um", "CREATE TABLE a (x);")])
    assert err.value.code == "banco_mais_novo"
    assert "versão 2" in str(err.value) and "Atualize o Henduran" in str(err.value)
    assert [tuple(r) for r in db.query_all("SELECT * FROM schema_migrations")] == [tuple(r) for r in before]


def test_falha_no_meio_desfaz_a_migracao_inteira(open_db, tmp_path):
    db = open_db()
    m1 = make_migration(1, "um", "CREATE TABLE a (x INTEGER);\nINSERT INTO a VALUES (1);")
    migrate(db, migrations=[m1])
    bad = make_migration(
        2,
        "dois",
        "CREATE TABLE b (x INTEGER);\nINSERT INTO b VALUES (1);\nUPDATE a SET x = 99;\nINSERT INTO tabela_que_nao_existe VALUES (1);",
    )
    with pytest.raises(MigrationError) as err:
        migrate(db, migrations=[m1, bad], backups_dir=tmp_path / "bk")
    assert err.value.code == "migracao_falhou"
    assert "b" not in tables(db)
    assert db.query_one("SELECT x FROM a")[0] == 1
    assert [r[0] for r in db.query_all("SELECT version FROM schema_migrations")] == [1]
    # Corrigida, a migração aplica normalmente depois.
    fixed = make_migration(2, "dois", "CREATE TABLE b (x INTEGER);")
    assert migrate(db, migrations=[m1, fixed], backups_dir=tmp_path / "bk").applied == [2]


def test_falha_na_primeira_migracao_deixa_banco_vazio(open_db):
    db = open_db()
    bad = make_migration(1, "um", "CREATE TABLE a (x);\nCOMANDO INVALIDO;")
    with pytest.raises(MigrationError):
        migrate(db, migrations=[bad])
    assert tables(db) == {"schema_migrations"}
    assert schema_version(db) == 0


def test_migracao_nao_pode_controlar_transacao(open_db):
    db = open_db()
    with pytest.raises(MigrationError) as err:
        migrate(db, migrations=[make_migration(1, "um", "CREATE TABLE a (x);\nCOMMIT;")])
    assert err.value.code == "migracao_invalida"
    assert "a" not in tables(db)


def test_migracao_aplicada_que_sumiu_do_app(open_db):
    db = open_db()
    migrate(db, migrations=[make_migration(1, "um", "CREATE TABLE a (x);"), make_migration(2, "dois", "CREATE TABLE b (x);")])
    with pytest.raises(MigrationError) as err:
        migrate(db, migrations=[make_migration(1, "um", "CREATE TABLE a (x);"), make_migration(3, "tres", "SELECT 1;")])
    assert err.value.code in ("migracao_desconhecida", "banco_mais_novo")


def test_arquivos_de_migracao(tmp_path):
    folder = write_migrations(tmp_path / "m", {"0001_um.sql": "CREATE TABLE a (v TEXT DEFAULT 'x;y');\n-- fim\n",
                                              "0002_dois.sql": "CREATE TABLE b (x);"})
    known = load_migrations(folder)
    assert [(m.version, m.name) for m in known] == [(1, "um"), (2, "dois")]
    assert split_statements(known[0].sql) == ["CREATE TABLE a (v TEXT DEFAULT 'x;y');"]
    with pytest.raises(MigrationError) as err:
        load_migrations(write_migrations(tmp_path / "lacuna", {"0001_um.sql": "SELECT 1;", "0003_tres.sql": "SELECT 1;"}))
    assert err.value.code == "migracoes_invalidas"
    with pytest.raises(MigrationError):
        load_migrations(write_migrations(tmp_path / "nome", {"1_um.sql": "SELECT 1;"}))
    with pytest.raises(MigrationError) as err:
        split_statements("CREATE TABLE a (x)")
    assert err.value.code == "migracao_invalida"


def test_checksum_de_arquivo_alterado_em_disco(tmp_path, open_db):
    folder = write_migrations(tmp_path / "m", {"0001_um.sql": "CREATE TABLE a (x);"})
    db = open_db()
    migrate(db, migrations=load_migrations(folder))
    (folder / "0001_um.sql").write_text("CREATE TABLE a (x, y);", encoding="utf-8")
    with pytest.raises(MigrationError) as err:
        migrate(db, migrations=load_migrations(folder))
    assert err.value.code == "checksum_divergente"


# ----------------------------------------------------------------- backups
def test_backup_antes_de_migrar_banco_com_conteudo(open_db, tmp_path):
    db = open_db()
    m1 = make_migration(1, "um", "CREATE TABLE a (x INTEGER);")
    migrate(db, migrations=[m1], backups_dir=tmp_path / "backups")
    assert not (tmp_path / "backups").exists()  # banco vazio: sem backup
    db.execute("INSERT INTO a VALUES (42)")
    result = migrate(db, migrations=[m1, make_migration(2, "dois", "CREATE TABLE b (x);")], backups_dir=tmp_path / "backups")
    assert result.backup is not None
    assert result.backup.parent == tmp_path / "backups"
    assert result.backup.name.startswith("henduran-v1-") and result.backup.suffix == ".db"
    copy = sqlite3.connect(result.backup)
    try:
        assert copy.execute("SELECT x FROM a").fetchone()[0] == 42
        assert copy.execute("SELECT MAX(version) FROM schema_migrations").fetchone()[0] == 1
        assert copy.execute("PRAGMA quick_check").fetchone()[0] == "ok"
    finally:
        copy.close()
    # Sem pendências, nenhum backup novo.
    assert migrate(db, migrations=[m1, make_migration(2, "dois", "CREATE TABLE b (x);")],
                   backups_dir=tmp_path / "backups").backup is None
    assert len(list((tmp_path / "backups").iterdir())) == 1


def test_backup_padrao_fica_ao_lado_do_banco(open_db, tmp_path):
    db = open_db()
    m1 = make_migration(1, "um", "CREATE TABLE a (x);")
    migrate(db, migrations=[m1])
    result = migrate(db, migrations=[m1, make_migration(2, "dois", "CREATE TABLE b (x);")])
    assert result.backup.parent == tmp_path / "backups"


def test_rotacao_mantem_os_cinco_mais_recentes(open_db, tmp_path):
    db = open_db()
    db.execute("CREATE TABLE a (x)")
    folder = tmp_path / "backups"
    folder.mkdir()
    (folder / "outro-arquivo.db").write_bytes(b"nao e backup")  # fora do padrão: não é tocado
    base = datetime(2026, 1, 1, 12, 0, 0)
    made = [backup_database(db, folder, 1, now=base + timedelta(minutes=i)) for i in range(5)]
    assert sorted(p.name for p in folder.glob("henduran-*.db")) == sorted(p.name for p in made)
    sixth = backup_database(db, folder, 2, now=base + timedelta(minutes=10))
    names = sorted(p.name for p in folder.glob("henduran-*.db"))
    assert len(names) == 5
    assert made[0].name not in names  # o mais antigo saiu
    assert sixth.name in names and made[1].name in names
    assert (folder / "outro-arquivo.db").exists()


def test_rotacao_ordena_pela_data_e_nao_pela_versao(tmp_path):
    folder = tmp_path / "b"
    folder.mkdir()
    for name in ["henduran-v9-20250101-000000.db", "henduran-v1-20260101-000000.db",
                 "henduran-v1-20260101-000000-1.db", "henduran-v2-20260102-000000.db"]:
        (folder / name).write_bytes(b"x")
    removed = rotate_backups(folder, keep=2)
    assert sorted(p.name for p in removed) == ["henduran-v1-20260101-000000.db", "henduran-v9-20250101-000000.db"]


def test_backups_no_mesmo_segundo_nao_se_sobrescrevem(open_db, tmp_path):
    db = open_db()
    db.execute("CREATE TABLE a (x)")
    now = datetime(2026, 1, 1)
    a = backup_database(db, tmp_path / "b", 1, now=now)
    b = backup_database(db, tmp_path / "b", 1, now=now)
    assert a != b and a.exists() and b.exists()


def test_open_app_database_fecha_em_falha(tmp_path, monkeypatch):
    def boom(db, **kw):
        raise MigrationError("migracao_falhou", "falha simulada")

    monkeypatch.setattr("henduran.db.migrate", boom)
    path = tmp_path / "henduran.db"
    with pytest.raises(MigrationError):
        open_app_database(path)
    path.rename(tmp_path / "x.db")  # o arquivo foi liberado


def test_modulo_de_migracoes_aponta_para_a_pasta_do_pacote():
    assert (mig_mod.MIGRATIONS_DIR / "0001_initial.sql").is_file()
