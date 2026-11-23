"""Bancos por Jornada e por Mundo (ADR-075): criação, lista, abertura, bloqueio, anexo, dano e backups."""

from __future__ import annotations

import shutil
import sqlite3
import subprocess
import sys
import threading
import time
from collections.abc import Iterator
from datetime import datetime, timedelta
from pathlib import Path

import pytest

from henduran.db import Database, MigrationError, open_app_database
from henduran.db import migrations as mig_mod
from henduran.db.migrations import backup_database
from henduran.paths import DataPaths, new_id
from henduran.settings import SettingsStore
from henduran.storage import JourneyDamaged, JourneyStore, StorageError, WorldDamaged, WorldStore
from henduran.storage import journeys as journeys_mod
from henduran.storage.lock import FileLock, LockBusy, is_locked

SRC = Path(__file__).resolve().parents[1]

HOLDER = r"""
import sys
from pathlib import Path
from henduran.paths import DataPaths
from henduran.storage import JourneyStore, StorageError, WorldStore
paths = DataPaths(Path(sys.argv[1]))
store = JourneyStore(paths, WorldStore(paths))
try:
    journey = store.open_journey(sys.argv[2])
except StorageError as exc:
    print("erro", exc.code, flush=True)
    sys.exit(7)
print("aberta", flush=True)
sys.stdin.read()
journey.close()
"""


@pytest.fixture(autouse=True)
def _no_journey_left_open() -> Iterator[None]:
    yield
    # Um teste que falhar no meio não deixa a vaga do processo presa para os outros.
    journeys_mod._process_open["id"] = None


@pytest.fixture
def env(tmp_path) -> Iterator[tuple[DataPaths, WorldStore, JourneyStore, SettingsStore]]:
    paths = DataPaths(tmp_path / "dados").ensure()
    app_db, _ = open_app_database(paths.database_file)
    settings = SettingsStore(app_db)
    worlds = WorldStore(paths)
    journeys = JourneyStore(paths, worlds, settings)
    try:
        yield paths, worlds, journeys, settings
    finally:
        app_db.close()


def raw(path: Path) -> sqlite3.Connection:
    """Conexão crua de teste (para simular bancos antigos, novos ou alterados por fora)."""
    return sqlite3.connect(path)


def spawn_holder(paths: DataPaths, journey_id: str) -> subprocess.Popen:
    proc = subprocess.Popen(
        [sys.executable, "-c", HOLDER, str(paths.root), journey_id],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        cwd=SRC,
    )
    line = proc.stdout.readline().strip()
    assert line == "aberta", (line, proc.stderr.read() if proc.poll() is not None else "")
    return proc


def kill(proc: subprocess.Popen) -> None:
    proc.kill()  # TerminateProcess no Windows, como taskkill /F
    proc.wait(timeout=15)
    for pipe in (proc.stdin, proc.stdout, proc.stderr):
        if pipe is not None:
            pipe.close()


def damage_pages(path: Path, pages: range, page_size: int = 4096) -> bytes:
    data = bytearray(path.read_bytes())
    for page in pages:
        start = page * page_size + 64
        data[start : start + 3000] = b"\xab" * 3000
    path.write_bytes(bytes(data))
    return bytes(data)


# ------------------------------------------------------------------ Mundos
def test_criar_listar_e_abrir_mundo(env):
    paths, worlds, _, _ = env
    wid = worlds.create_world("Terras Altas ç", {"regiões": ["norte"]}, label="inicial")
    assert (paths.world_dir(wid) / "world.db").is_file()
    assert paths.world_backups_dir(wid).is_dir()
    [summary] = worlds.list_worlds()
    assert summary.id == wid and summary.name == "Terras Altas ç" and summary.status == "ok"
    assert summary.versions == [1] and summary.to_dict()["latest_version"] == 1
    with worlds.open_world(wid) as db:
        assert db.pragma("synchronous") == 2  # FULL
        assert db.pragma("journal_mode") == "wal"
        assert db.pragma("foreign_keys") == 1
        row = db.query_one("SELECT label, content FROM world_versions WHERE version = 1")
        assert row["label"] == "inicial" and '"regiões"' in row["content"]
        with pytest.raises(sqlite3.IntegrityError):
            db.execute("INSERT INTO world_meta (id, name, created_at) VALUES (?, 'x', 'y')", (new_id(),))


def test_mundo_rejeita_nome_e_conteudo_invalidos(env):
    _, worlds, _, _ = env
    for name in ("", "   ", None, "x" * 201):
        with pytest.raises(StorageError) as err:
            worlds.create_world(name)
        assert err.value.code == "nome_invalido"
    with pytest.raises(StorageError) as err:
        worlds.create_world("ok", {"x": object()})
    assert err.value.code == "conteudo_invalido"
    assert worlds.list_worlds() == []


def test_excluir_mundo_exige_confirmacao_e_recusa_em_uso(env):
    paths, worlds, journeys, _ = env
    wid = worlds.create_world("M")
    other = worlds.create_world("Livre")
    jid = journeys.create_journey("J", wid)
    assert worlds.world_in_use(wid) is True and worlds.world_in_use(other) is False
    with pytest.raises(StorageError) as err:
        worlds.delete_world(other)
    assert err.value.code == "confirmacao_necessaria"
    with pytest.raises(StorageError) as err:
        worlds.delete_world(wid, confirm=True)
    assert err.value.code == "mundo_em_uso"
    assert paths.world_dir(wid).is_dir()
    worlds.delete_world(other, confirm=True)
    assert not paths.world_dir(other).exists()
    journeys.delete_journey(jid, confirm=True)
    assert worlds.world_in_use(wid) is False
    worlds.delete_world(wid, confirm=True)
    assert worlds.list_worlds() == []
    with pytest.raises(StorageError) as err:
        worlds.delete_world(wid, confirm=True)
    assert err.value.code == "mundo_nao_encontrado"


def test_excluir_mundo_recusa_se_ha_jornada_ilegivel(env):
    paths, worlds, journeys, _ = env
    wid = worlds.create_world("M")
    jid = journeys.create_journey("J", wid)
    paths.journey_db_file(jid).write_bytes(b"lixo" * 2000)
    assert worlds.journeys_using(wid) == ([], [jid])
    with pytest.raises(StorageError) as err:
        worlds.delete_world(wid, confirm=True)
    assert err.value.code == "uso_indeterminado"


def test_mundo_danificado_nao_e_recriado(env):
    paths, worlds, _, _ = env
    wid = worlds.create_world("M")
    garbage = b"nao e sqlite" * 500
    paths.world_db_file(wid).write_bytes(garbage)
    [summary] = worlds.list_worlds()
    assert summary.status == "danificado" and summary.error_code == "banco_danificado"
    with pytest.raises(WorldDamaged):
        worlds.open_world(wid)
    assert paths.world_db_file(wid).read_bytes() == garbage


# ------------------------------------------------------------------ Jornadas
def test_criar_jornada_confere_mundo_e_versao(env):
    paths, worlds, journeys, _ = env
    wid = worlds.create_world("M")
    with pytest.raises(StorageError) as err:
        journeys.create_journey("J", new_id())
    assert err.value.code == "mundo_ausente"
    with pytest.raises(StorageError) as err:
        journeys.create_journey("J", wid, world_version=2)
    assert err.value.code == "versao_ausente"
    for bad in (0, -1, True, "1"):
        with pytest.raises(StorageError) as err:
            journeys.create_journey("J", wid, world_version=bad)
        assert err.value.code == "versao_invalida"
    with pytest.raises(StorageError) as err:
        journeys.create_journey("J", "../" + wid)
    assert err.value.code == "id_invalido"
    assert not paths.journeys_dir.exists() or list(paths.journeys_dir.iterdir()) == []
    jid = journeys.create_journey("Primeira", wid)
    folder = paths.journey_dir(jid)
    assert {p.name for p in folder.iterdir()} == {"journey.db", "assets", "backups"}
    conn = raw(paths.journey_db_file(jid))
    try:
        assert conn.execute("SELECT COUNT(*) FROM journey_meta").fetchone()[0] == 1
        with pytest.raises(sqlite3.IntegrityError):
            conn.execute(
                "INSERT INTO journey_meta (id, name, world_id, world_version, created_at) VALUES (?, 'x', ?, 1, 'y')",
                (new_id(), wid),
            )
    finally:
        conn.close()


def test_abrir_atualizar_resumo_e_salvar(env):
    _, worlds, journeys, _ = env
    wid = worlds.create_world("M", {"cidade": "Vila"})
    jid = journeys.create_journey("J", wid)
    with journeys.open_journey(jid) as journey:
        assert journeys.open_journey_id == jid
        assert journey.world_id == wid and journey.world_version == 1
        assert journey.world_content() == {"cidade": "Vila"}
        out = journey.update_summary(character_name="Ana", location="Vila", day_period="manhã")
        assert (out["character_name"], out["location"], out["day_period"]) == ("Ana", "Vila", "manhã")
        journey.update_summary(name="Renomeada", location=None)
        saved = journey.touch_saved()
        with pytest.raises(StorageError):
            journey.update_summary(name="")
        summary = journey.summary()
    assert journeys.open_journey_id is None
    assert summary["name"] == "Renomeada" and summary["location"] is None and summary["last_saved_at"] == saved
    [item] = journeys.list_journeys()
    assert item.status == "ok" and item.name == "Renomeada" and item.character_name == "Ana"
    assert item.world_name == "M" and item.last_saved_at == saved and item.error_code is None


def test_pragmas_dos_tres_bancos(env):
    paths, worlds, journeys, settings = env
    assert settings.db.pragma("synchronous") == 1  # NORMAL no banco do app
    jid = journeys.create_journey("J", worlds.create_world("M"))
    with journeys.open_journey(jid) as journey:
        assert journey.db.pragma("synchronous") == 2  # FULL na Jornada
        assert journey.db.pragma("journal_mode") == "wal"
        assert journey.db.pragma("foreign_keys") == 1
        assert journey.db.query_one("PRAGMA foreign_keys")[0] == 1


def test_lista_ordena_pelo_ultimo_salvamento(env):
    _, worlds, journeys, _ = env
    wid = worlds.create_world("M")
    ids = [journeys.create_journey(f"J{i}", wid) for i in range(3)]
    for jid, stamp in zip(ids, ["2026-01-02T00:00:00Z", "2026-03-01T00:00:00Z", None], strict=True):
        with journeys.open_journey(jid) as journey:
            journey.db.execute("UPDATE journey_meta SET last_saved_at = ?, created_at = ?", (stamp, "2026-02-01T00:00:00Z"))
    assert [s.id for s in journeys.list_journeys()] == [ids[1], ids[2], ids[0]]


def test_lista_vazia_e_pastas_estranhas_ignoradas(env):
    paths, worlds, journeys, _ = env
    assert journeys.list_journeys() == []
    paths.journeys_dir.mkdir(parents=True, exist_ok=True)
    (paths.journeys_dir / "nao-e-uuid").mkdir()
    (paths.journeys_dir / "arquivo.txt").write_text("x")
    (paths.journeys_dir / new_id().upper()).mkdir()  # só a forma canônica vale
    assert journeys.list_journeys() == []


def test_lista_robusta_com_jornadas_com_problema(env):
    paths, worlds, journeys, _ = env
    wid = worlds.create_world("M")
    gone = worlds.create_world("Some")
    ok = journeys.create_journey("Boa", wid)
    corrupt = journeys.create_journey("Corrompida", wid)
    newer = journeys.create_journey("Nova", wid)
    orphan = journeys.create_journey("Órfã", gone)
    no_version = journeys.create_journey("Sem versão", wid)
    empty = journeys.create_journey("Vazia", wid)
    garbage = b"isto nao e sqlite" * 300
    paths.journey_db_file(corrupt).write_bytes(garbage)
    conn = raw(paths.journey_db_file(newer))
    conn.execute("INSERT INTO schema_migrations VALUES (99, 'futura', 'x', 'agora')")
    conn.commit()
    conn.close()
    shutil.rmtree(paths.world_dir(gone))
    conn = raw(paths.journey_db_file(no_version))
    conn.execute("UPDATE journey_meta SET world_version = 7")
    conn.commit()
    conn.close()
    paths.journey_db_file(empty).write_bytes(b"")
    by_id = {s.id: s for s in journeys.list_journeys()}
    assert by_id[ok].status == "ok"
    assert (by_id[corrupt].status, by_id[corrupt].error_code) == ("danificada", "banco_danificado")
    assert (by_id[newer].status, by_id[newer].error_code) == ("mais_nova", "banco_mais_novo")
    assert by_id[newer].name == "Nova"
    assert (by_id[orphan].status, by_id[orphan].error_code) == ("sem_mundo", "mundo_ausente")
    assert (by_id[no_version].status, by_id[no_version].error_code) == ("sem_mundo", "versao_ausente")
    assert (by_id[empty].status, by_id[empty].error_code) == ("danificada", "banco_vazio")
    # A lista não alterou nada.
    assert paths.journey_db_file(corrupt).read_bytes() == garbage
    assert paths.journey_db_file(empty).read_bytes() == b""
    # Abrir cada uma dá o erro certo, e a vaga do processo fica livre depois.
    with pytest.raises(JourneyDamaged) as err:
        journeys.open_journey(corrupt)
    assert err.value.code == "banco_danificado" and err.value.path == paths.journey_db_file(corrupt)
    with pytest.raises(JourneyDamaged) as err:
        journeys.open_journey(empty)
    assert err.value.code == "banco_vazio"
    with pytest.raises(MigrationError) as err:
        journeys.open_journey(newer)
    assert err.value.code == "banco_mais_novo"
    with pytest.raises(StorageError) as err:
        journeys.open_journey(orphan)
    assert err.value.code == "mundo_ausente"
    with pytest.raises(StorageError) as err:
        journeys.open_journey(no_version)
    assert err.value.code == "versao_ausente"
    assert journeys.open_journey_id is None
    assert not is_locked(paths.journey_lock_file(no_version))
    conn = raw(paths.journey_db_file(newer))
    assert conn.execute("SELECT MAX(version) FROM schema_migrations").fetchone()[0] == 99
    conn.close()
    with journeys.open_journey(ok):
        pass


def test_lista_de_50_jornadas_em_tempo_razoavel(env):
    _, worlds, journeys, _ = env
    wid = worlds.create_world("M")
    for i in range(50):
        journeys.create_journey(f"J{i}", wid)
    start = time.perf_counter()
    items = journeys.list_journeys()
    elapsed = time.perf_counter() - start
    assert len(items) == 50 and all(s.status == "ok" for s in items)
    assert elapsed < 3.0, elapsed


def test_excluir_jornada(env):
    paths, worlds, journeys, settings = env
    wid = worlds.create_world("M")
    jid = journeys.create_journey("J", wid)
    journeys.set_last_played(jid)
    with pytest.raises(StorageError) as err:
        journeys.delete_journey(jid)
    assert err.value.code == "confirmacao_necessaria"
    with journeys.open_journey(jid):
        with pytest.raises(StorageError) as err:
            journeys.delete_journey(jid, confirm=True)
        assert err.value.code == "jornada_aberta"
    journeys.delete_journey(jid, confirm=True)
    assert not paths.journey_dir(jid).exists()
    assert journeys.last_journey_id is None and settings.get("last_journey_id") is None
    with pytest.raises(StorageError) as err:
        journeys.delete_journey(jid, confirm=True)
    assert err.value.code == "jornada_nao_encontrada"
    with pytest.raises(StorageError) as err:
        journeys.open_journey(jid)
    assert err.value.code == "jornada_nao_encontrada"


# ------------------------------------------------------------------ bloqueio
def test_uma_jornada_aberta_por_vez_no_processo(env):
    _, worlds, journeys, _ = env
    wid = worlds.create_world("M")
    a = journeys.create_journey("A", wid)
    b = journeys.create_journey("B", wid)
    other_store = JourneyStore(journeys.paths, worlds)
    with journeys.open_journey(a):
        for store, jid in ((journeys, a), (journeys, b), (other_store, b)):
            with pytest.raises(StorageError) as err:
                store.open_journey(jid)
            assert err.value.code == "jornada_ja_aberta"
    with journeys.open_journey(b):  # depois de fechar, outra abre
        pass


def test_bloqueio_contra_outro_processo_e_liberado_ao_matar(env):
    paths, worlds, journeys, _ = env
    wid = worlds.create_world("M")
    jid = journeys.create_journey("J", wid)
    backup_dir = paths.journey_backups_dir(jid)
    proc = spawn_holder(paths, jid)
    try:
        assert is_locked(paths.journey_lock_file(jid))
        with pytest.raises(StorageError) as err:
            journeys.open_journey(jid)
        assert err.value.code == "jornada_bloqueada"
        assert journeys.open_journey_id is None  # a recusa não prende a vaga do processo
        with pytest.raises(StorageError) as err:
            journeys.delete_journey(jid, confirm=True)
        assert err.value.code == "jornada_bloqueada"
        (backup_dir / "journey-v1-20260101-000000.db").write_bytes(b"x")
        with pytest.raises(StorageError) as err:
            journeys.restore_backup(jid, "journey-v1-20260101-000000.db")
        assert err.value.code == "jornada_bloqueada"
        # A lista continua lendo a Jornada aberta pelo outro processo.
        assert journeys.list_journeys()[0].status == "ok"
    finally:
        kill(proc)
    assert not is_locked(paths.journey_lock_file(jid))
    with journeys.open_journey(jid) as journey:
        assert journey.summary()["name"] == "J"


def test_outro_processo_nao_abre_jornada_aberta_aqui(env):
    paths, worlds, journeys, _ = env
    wid = worlds.create_world("M")
    jid = journeys.create_journey("J", wid)
    other = journeys.create_journey("Outra", wid)
    with journeys.open_journey(jid):
        result = subprocess.run(
            [sys.executable, "-c", HOLDER, str(paths.root), jid],
            input="", capture_output=True, text=True, timeout=60, cwd=SRC,
        )
        assert result.returncode == 7 and "jornada_bloqueada" in result.stdout
        # Duas Jornadas no mesmo Mundo, abertas ao mesmo tempo em processos diferentes.
        proc = spawn_holder(paths, other)
        kill(proc)


def test_file_lock_basico(tmp_path):
    path = tmp_path / "x.lock"
    first = FileLock(path)
    first.acquire()
    assert first.held and is_locked(path)
    with pytest.raises(LockBusy):
        FileLock(path).acquire()
    first.release()
    first.release()  # idempotente
    assert not is_locked(path)
    with FileLock(path):
        assert is_locked(path)


# ------------------------------------------------------------------ anexo do Mundo
def test_anexo_do_mundo_e_somente_leitura(env):
    paths, worlds, journeys, _ = env
    wid = worlds.create_world("M", {"a": 1})
    jid = journeys.create_journey("J", wid)
    world_file = paths.world_db_file(wid)
    before = world_file.read_bytes()
    with journeys.open_journey(jid) as journey:
        db = journey.db
        assert db.attached()["world"].endswith("world.db?mode=ro")
        assert db.query_one("SELECT name FROM world.world_meta")["name"] == "M"
        for sql in (
            "INSERT INTO world.world_versions (version, created_at, content) VALUES (2, 'x', '{}')",
            "UPDATE world.world_meta SET name = 'hack'",
            "DELETE FROM world.world_versions",
            "CREATE TABLE world.nova (x)",
        ):
            with pytest.raises(sqlite3.OperationalError, match="readonly"):
                db.execute(sql)
        # Escrita no banco da Jornada continua funcionando, e o Mundo não muda.
        db.execute("UPDATE journey_meta SET location = 'praça'")
    conn = raw(world_file)
    try:
        assert conn.execute("SELECT name FROM world_meta").fetchone()[0] == "M"
        assert conn.execute("SELECT COUNT(*) FROM world_versions").fetchone()[0] == 1
    finally:
        conn.close()
    assert world_file.read_bytes() == before


def test_anexo_vale_nas_conexoes_de_leitura_atuais_e_futuras(tmp_path):
    world = tmp_path / "w.db"
    conn = raw(world)
    conn.execute("CREATE TABLE v (x)")
    conn.execute("INSERT INTO v VALUES (42)")
    conn.commit()
    conn.close()
    db = Database(tmp_path / "j.db", synchronous="FULL")
    try:
        db.execute("CREATE TABLE t (x)")
        # Cria várias conexões de leitura antes do anexo.
        barrier = threading.Barrier(4)
        hold = threading.Event()

        def reader() -> None:
            with db._reader():
                barrier.wait(5)
                hold.wait(5)

        threads = [threading.Thread(target=reader) for _ in range(3)]
        for th in threads:
            th.start()
        barrier.wait(5)
        db.attach(world, "world")  # três leitores em uso neste momento
        hold.set()
        for th in threads:
            th.join(5)
        assert len(db._all_readers) >= 3
        results: list[object] = []

        def query() -> None:
            try:
                results.append(db.query_one("SELECT x FROM world.v")[0])
            except Exception as exc:  # noqa: BLE001
                results.append(exc)

        threads = [threading.Thread(target=query) for _ in range(8)]
        for th in threads:
            th.start()
        for th in threads:
            th.join(10)
        assert results == [42] * 8
        for reader_conn in db._all_readers:
            names = {r[1] for r in reader_conn.execute("PRAGMA database_list")}
            assert "world" in names
        with pytest.raises(sqlite3.OperationalError, match="readonly"):
            db.execute("INSERT INTO world.v VALUES (1)")
        with pytest.raises(ValueError):
            db.attach(world, "main")
        with pytest.raises(ValueError):
            db.attach(world, "x; DROP TABLE t")
        from henduran.db import DatabaseError

        with pytest.raises(DatabaseError) as err:
            db.attach(world, "world")
        assert err.value.code == "alias_em_uso"
        with pytest.raises(DatabaseError) as err:
            db.attach(tmp_path / "nao-existe.db", "outro")
        assert err.value.code == "banco_ausente"
        with db.transaction():
            with pytest.raises(DatabaseError) as err:
                db.attach(world, "outro")
        assert err.value.code == "anexo_em_transacao"
    finally:
        db.close()
    for name in ("w.db", "j.db"):
        (tmp_path / name).rename(tmp_path / f"{name}.movido")  # arquivos liberados


def test_duas_jornadas_no_mesmo_mundo(env):
    paths, worlds, journeys, _ = env
    wid = worlds.create_world("M", {"v": 1})
    a = journeys.create_journey("A", wid)
    b = journeys.create_journey("B", wid)
    assert sorted(worlds.journeys_using(wid)[0]) == sorted([a, b])
    for jid in (a, b):
        with journeys.open_journey(jid) as journey:
            assert journey.world_content() == {"v": 1}
            journey.update_summary(location=f"lugar {jid[:4]}")
    items = {s.id: s for s in journeys.list_journeys()}
    assert items[a].location != items[b].location


def test_mundo_ausente_ou_versao_ausente_ao_abrir(env):
    paths, worlds, journeys, _ = env
    wid = worlds.create_world("M")
    jid = journeys.create_journey("J", wid)
    conn = raw(paths.world_db_file(wid))
    conn.execute("DELETE FROM world_versions")
    conn.commit()
    conn.close()
    with pytest.raises(StorageError) as err:
        journeys.open_journey(jid)
    assert err.value.code == "versao_ausente"
    shutil.rmtree(paths.world_dir(wid))
    with pytest.raises(StorageError) as err:
        journeys.open_journey(jid)
    assert err.value.code == "mundo_ausente"
    assert journeys.open_journey_id is None


# ------------------------------------------------------------------ dano e restauração
def _fill(path: Path, rows: int = 3000) -> None:
    conn = raw(path)
    conn.execute("CREATE TABLE enchimento (id INTEGER PRIMARY KEY, v TEXT)")
    conn.executemany("INSERT INTO enchimento (v) VALUES (?)", [(f"valor {i} " * 12,) for i in range(rows)])
    conn.commit()
    conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
    conn.close()


def test_jornada_com_bytes_invalidos_nao_e_recriada(env):
    paths, worlds, journeys, _ = env
    jid = journeys.create_journey("J", worlds.create_world("M"))
    db_file = paths.journey_db_file(jid)
    garbage = b"isto nao e um banco sqlite" * 400
    db_file.write_bytes(garbage)
    wal = db_file.with_name("journey.db-wal")
    wal.write_bytes(b"wal velho")
    before = {p.name for p in db_file.parent.iterdir()}
    with pytest.raises(JourneyDamaged) as err:
        journeys.open_journey(jid)
    assert err.value.code == "banco_danificado" and err.value.path == db_file
    assert db_file.read_bytes() == garbage
    assert wal.read_bytes() == b"wal velho"
    after = {p.name for p in db_file.parent.iterdir()}
    assert after - before <= {"journey.db-shm", "journey.lock"}
    assert not list(db_file.parent.glob("*corrompido*"))
    assert journeys.open_journey_id is None


def test_jornada_com_paginas_danificadas_nao_e_recriada(env):
    paths, worlds, journeys, _ = env
    jid = journeys.create_journey("J", worlds.create_world("M"))
    db_file = paths.journey_db_file(jid)
    _fill(db_file)
    size_pages = db_file.stat().st_size // 4096
    assert size_pages > 40
    damaged = damage_pages(db_file, range(size_pages // 2, size_pages // 2 + 6))
    wal = db_file.with_name("journey.db-wal")
    wal.write_bytes(b"wal velho")
    with pytest.raises(JourneyDamaged) as err:
        journeys.open_journey(jid)
    assert err.value.code == "banco_danificado"
    assert db_file.read_bytes() == damaged
    assert wal.read_bytes() == b"wal velho"
    assert not list(db_file.parent.glob("*corrompido*"))


def test_restaurar_backup_preserva_o_danificado(env):
    paths, worlds, journeys, _ = env
    wid = worlds.create_world("M")
    jid = journeys.create_journey("J", wid)
    other = journeys.create_journey("Outra", wid)
    backups = paths.journey_backups_dir(jid)
    with journeys.open_journey(jid) as journey:
        journey.update_summary(name="Antes do dano")
        good = backup_database(journey.db, backups, 1, prefix="journey", now=datetime(2026, 1, 1))
    with journeys.open_journey(other) as journey:
        foreign = backup_database(journey.db, backups, 1, prefix="journey", now=datetime(2026, 1, 2))
    bad_backup = backups / "journey-v1-20260103-000000.db"
    bad_backup.write_bytes(b"backup estragado" * 100)
    db_file = paths.journey_db_file(jid)
    garbage = b"lixo" * 3000
    db_file.write_bytes(garbage)
    db_file.with_name("journey.db-wal").write_bytes(b"wal velho")
    assert {s.id: s.status for s in journeys.list_journeys()} == {jid: "danificada", other: "ok"}
    assert [b.name for b in journeys.list_backups(jid)] == [bad_backup.name, foreign.name, good.name]
    for name, code in (
        ("../journey.db", "backup_invalido"),
        ("journey-v1-20260101-000000.db\\..\\x", "backup_invalido"),
        ("henduran-v1-20260101-000000.db", "backup_invalido"),
        ("journey-v1-20991231-000000.db", "backup_nao_encontrado"),
        (bad_backup.name, "backup_invalido"),
        (foreign.name, "backup_invalido"),  # é de outra Jornada
    ):
        with pytest.raises(StorageError) as err:
            journeys.restore_backup(jid, name)
        assert err.value.code == code, name
        assert db_file.read_bytes() == garbage  # nada mudou
    result = journeys.restore_backup(jid, good.name)
    assert result.restored_from == good.name
    assert result.preserved_as is not None and result.preserved_as.name.startswith("journey.db.danificado-")
    assert result.preserved_as.read_bytes() == garbage
    assert result.preserved_as.with_name(result.preserved_as.name + "-wal").read_bytes() == b"wal velho"
    assert not db_file.with_name("journey.db-wal").exists() or db_file.with_name("journey.db-wal").read_bytes() != b"wal velho"
    assert good.is_file()  # o backup é copiado, não movido
    with journeys.open_journey(jid) as journey:
        assert journey.summary()["name"] == "Antes do dano"
        with pytest.raises(StorageError) as err:
            journeys.restore_backup(jid, good.name)
        assert err.value.code == "jornada_aberta"
    assert {s.id: s.status for s in journeys.list_journeys()} == {jid: "ok", other: "ok"}


def test_backup_pre_migracao_por_jornada_com_rotacao(env, monkeypatch):
    paths, worlds, journeys, _ = env
    wid = worlds.create_world("M")
    jid = journeys.create_journey("J", wid)
    other = journeys.create_journey("Outra", wid)
    original = mig_mod.MIGRATIONS_ROOT
    root = tmp = paths.root.parent / "sets"
    shutil.copytree(original, tmp, ignore=shutil.ignore_patterns("__pycache__"))
    backups = paths.journey_backups_dir(jid)
    base = datetime(2025, 1, 1)
    for i in range(6):  # backups antigos da mesma Jornada
        with Database(paths.journey_db_file(jid), synchronous="FULL") as db:
            backup_database(db, backups, 1, prefix="journey", now=base + timedelta(minutes=i))
    assert len(journeys.list_backups(jid)) == 5
    (root / "journey" / "0002_extra.sql").write_text("CREATE TABLE extra_teste (x INTEGER);\n", encoding="utf-8")
    (root / "world" / "0002_extra.sql").write_text("CREATE TABLE extra_mundo (x INTEGER);\n", encoding="utf-8")
    monkeypatch.setattr(mig_mod, "MIGRATIONS_ROOT", root)
    with journeys.open_journey(jid) as journey:
        assert journey.db.query_one("SELECT MAX(version) FROM schema_migrations")[0] == 2
        assert journey.db.query_one("SELECT COUNT(*) FROM world.extra_mundo")[0] == 0  # Mundo migrado antes
    found = journeys.list_backups(jid)
    assert len(found) == 5 and found[0].schema_version == 1 and found[0].created.startswith("20")
    assert found[0].created > "2025"  # o novo, de agora
    assert journeys.list_backups(other) == []  # só a Jornada aberta foi copiada
    assert len(list(paths.world_backups_dir(wid).glob("world-v1-*.db"))) == 1
    assert not paths.backups_dir.exists() or not list(paths.backups_dir.iterdir())
    # Um app sem a migração extra recusa a Jornada mais nova, sem mexer nela.
    monkeypatch.setattr(mig_mod, "MIGRATIONS_ROOT", original)
    with pytest.raises(MigrationError) as err:
        journeys.open_journey(jid)
    assert err.value.code == "banco_mais_novo"
    with pytest.raises(StorageError) as err:
        journeys.open_journey(other)  # o Mundo agora é mais novo
    assert err.value.code == "mundo_mais_novo"
    statuses = {s.id: (s.status, s.error_code) for s in journeys.list_journeys()}
    assert statuses[jid] == ("mais_nova", "banco_mais_novo")
    assert statuses[other] == ("sem_mundo", "mundo_mais_novo")
    assert worlds.list_worlds()[0].status == "mais_novo"


# ------------------------------------------------------------------ arquivos e caminhos
def test_caminhos_com_espacos_e_acentos_e_close_libera(tmp_path):
    paths = DataPaths(tmp_path / "Meus Dados ç" / "Henduran ação").ensure()
    worlds = WorldStore(paths)
    journeys = JourneyStore(paths, worlds)
    wid = worlds.create_world("Mundo ã")
    jid = journeys.create_journey("Jornada é", wid)
    journey = journeys.open_journey(jid)
    journey.update_summary(location="São João")
    journey.db.query_one("SELECT * FROM world.world_meta")
    journey.close()
    journey.close()  # idempotente
    assert journeys.list_journeys()[0].location == "São João"
    # Logo depois de fechar, os arquivos podem ser renomeados e apagados (Windows).
    db_file = paths.journey_db_file(jid)
    moved = db_file.with_name("movido.db")
    db_file.rename(moved)
    moved.rename(db_file)
    paths.world_db_file(wid).rename(paths.world_dir(wid) / "w.db")
    shutil.rmtree(paths.world_dir(wid))
    shutil.rmtree(paths.journey_dir(jid))


# ------------------------------------------------------------------ última Jornada
def test_last_journey_id(env):
    _, worlds, journeys, settings = env
    assert journeys.last_journey_id is None
    jid = journeys.create_journey("J", worlds.create_world("M"))
    journeys.set_last_played(jid.upper())
    assert journeys.last_journey_id == jid
    for bad in ("../x", "nao-uuid", 5):
        with pytest.raises((ValueError, StorageError)):
            journeys.set_last_played(bad)
        with pytest.raises(ValueError):
            settings.update(last_journey_id=bad)
    assert settings.get("last_journey_id") == jid
    journeys.set_last_played(None)
    assert settings.get("last_journey_id") is None
    # Valor inválido gravado por fora é ignorado (vale o padrão).
    settings.db.execute(
        "INSERT INTO settings (key, value, updated_at) VALUES ('last_journey_id', '\"../../x\"', 'x') "
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    )
    assert SettingsStore(settings.db).get("last_journey_id") is None


# ------------------------------------------------------------------ opções do Database
def test_database_sem_recuperacao_e_sem_criacao(tmp_path):
    from henduran.db import DatabaseError

    with pytest.raises(ValueError):
        Database(tmp_path / "x.db", synchronous="OFF")
    with pytest.raises(DatabaseError) as err:
        Database(tmp_path / "ausente.db", create=False)
    assert err.value.code == "banco_ausente"
    assert not (tmp_path / "ausente.db").exists()
    bad = tmp_path / "ruim.db"
    bad.write_bytes(b"lixo" * 1000)
    with pytest.raises(DatabaseError) as err:
        Database(bad, recover_corrupt=False)
    assert err.value.code == "banco_danificado"
    assert bad.read_bytes() == b"lixo" * 1000
    assert not list(tmp_path.glob("*corrompido*"))
    with Database(tmp_path / "novo.db", synchronous="full") as db:
        assert db.pragma("synchronous") == 2
