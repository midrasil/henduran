from __future__ import annotations

import json
import os
import socket
import sqlite3
import subprocess
import sys

import httpx
import pytest

from henduran.__main__ import EXIT_BAD_PROVIDER, EXIT_DATABASE, EXIT_MISSING_TOKEN, HOST, bind_socket

from .conftest import TOKEN


def _env(**extra: str) -> dict[str, str]:
    env = {k: v for k, v in os.environ.items() if not k.startswith("HENDURAN_")}
    env["PYTHONUNBUFFERED"] = "1"
    env.update(extra)
    return env


def test_recusa_iniciar_sem_token(tmp_path):
    result = subprocess.run(
        [sys.executable, "-m", "henduran", "--port", "0"],
        env=_env(HENDURAN_DATA_DIR=str(tmp_path)),
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode == EXIT_MISSING_TOKEN
    assert "HENDURAN_TOKEN" in result.stderr
    assert result.stdout == ""


def test_bind_somente_em_loopback():
    assert HOST == "127.0.0.1"
    sock = bind_socket(0)
    try:
        assert sock.getsockname()[0] == "127.0.0.1"
    finally:
        sock.close()


def _non_loopback_ipv4() -> str | None:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("192.0.2.1", 9))  # não envia pacotes; só escolhe a interface
            ip = s.getsockname()[0]
    except OSError:
        return None
    return None if ip.startswith("127.") or ip == "0.0.0.0" else ip


def test_provedor_invalido_recusa_iniciar(tmp_path):
    result = subprocess.run(
        [sys.executable, "-m", "henduran", "--port", "0"],
        env=_env(HENDURAN_TOKEN=TOKEN, HENDURAN_PROVIDER="outro", HENDURAN_DATA_DIR=str(tmp_path)),
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode == EXIT_BAD_PROVIDER
    assert "HENDURAN_PROVIDER" in result.stderr


@pytest.mark.parametrize("provider,ready", [("local", False), ("fake", True)])
def test_seleciona_provedor_pela_variavel(tmp_path, provider, ready):
    proc = subprocess.Popen(
        [sys.executable, "-m", "henduran"],
        env=_env(HENDURAN_TOKEN=TOKEN, HENDURAN_PROVIDER=provider, HENDURAN_DATA_DIR=str(tmp_path)),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    try:
        port = json.loads(proc.stdout.readline())["port"]
        auth = {"Authorization": f"Bearer {TOKEN}"}
        health = httpx.get(f"http://127.0.0.1:{port}/health", headers=auth).json()
        assert health["provider"]["name"] == provider
        assert health["provider"]["ready"] is ready
        status = httpx.get(f"http://127.0.0.1:{port}/engine/status", headers=auth).json()
        assert status["provider"] == provider and status["installed"] is False
        # A pasta de dados foi criada onde HENDURAN_DATA_DIR mandou.
        assert (tmp_path / "models").is_dir() and (tmp_path / "engine").is_dir()
    finally:
        proc.kill()
        proc.wait(timeout=10)


def test_processo_anuncia_porta_e_escuta_somente_em_loopback(tmp_path):
    proc = subprocess.Popen(
        [sys.executable, "-m", "henduran"],
        env=_env(HENDURAN_TOKEN=TOKEN, HENDURAN_DATA_DIR=str(tmp_path)),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    try:
        line = proc.stdout.readline()
        ready = json.loads(line)
        assert ready["event"] == "ready"
        port = ready["port"]
        assert isinstance(port, int) and port > 0

        r = httpx.get(
            f"http://127.0.0.1:{port}/health",
            headers={"Authorization": f"Bearer {TOKEN}"},
        )
        assert r.status_code == 200

        ip = _non_loopback_ipv4()
        if ip is None:
            pytest.skip("sem interface de rede não loopback para testar")
        with pytest.raises(OSError):
            socket.create_connection((ip, port), timeout=1).close()
    finally:
        proc.kill()
        proc.wait(timeout=10)


# ------------------------------------------------------------ banco do app
def _start(tmp_path) -> tuple[subprocess.Popen, int]:
    proc = subprocess.Popen(
        [sys.executable, "-m", "henduran"],
        env=_env(HENDURAN_TOKEN=TOKEN, HENDURAN_PROVIDER="fake", HENDURAN_DATA_DIR=str(tmp_path)),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    line = proc.stdout.readline()
    if not line:
        proc.kill()
        raise AssertionError(proc.stderr.read())
    return proc, json.loads(line)["port"]


def _stop(proc: subprocess.Popen) -> None:
    proc.kill()
    proc.wait(timeout=10)
    for pipe in (proc.stdout, proc.stderr):
        if pipe is not None:
            pipe.close()


def test_health_informa_o_banco_e_preferencias_persistem(tmp_path):
    data = tmp_path / "dados"
    data.mkdir()
    (data / "settings.json").write_text(
        json.dumps({"engine_variant": "cpu", "context_size": "x"}), encoding="utf-8"
    )
    auth = {"Authorization": f"Bearer {TOKEN}"}
    extra = tmp_path / "Modelos extras ç"
    extra.mkdir()
    proc, port = _start(data)
    try:
        health = httpx.get(f"http://127.0.0.1:{port}/health", headers=auth).json()
        assert health["status"] == "ok"
        assert health["database"] == {"schema_version": 1, "recovered": False}
        assert (data / "henduran.db").is_file()
        assert (data / "settings.json.migrado").is_file() and not (data / "settings.json").exists()
        r = httpx.post(f"http://127.0.0.1:{port}/models/folders", headers=auth, json={"path": str(extra)})
        assert r.status_code == 200, r.text
    finally:
        _stop(proc)  # morte abrupta: o WAL precisa bastar para não perder nada
    proc, port = _start(data)
    try:
        folders = httpx.get(f"http://127.0.0.1:{port}/models/folders", headers=auth).json()["folders"]
        assert [f["path"] for f in folders if f["kind"] == "extra"] == [str(extra.resolve())]
    finally:
        _stop(proc)


def test_banco_corrompido_e_recriado_e_avisado(tmp_path):
    (tmp_path / "henduran.db").write_bytes(b"lixo" * 1000)
    proc, port = _start(tmp_path)
    try:
        health = httpx.get(f"http://127.0.0.1:{port}/health", headers={"Authorization": f"Bearer {TOKEN}"}).json()
        assert health["database"]["recovered"] is True
        assert health["database"]["schema_version"] == 1
        assert "corrompido" in health["database"]["message"]
        assert list(tmp_path.glob("henduran.db.corrompido-*"))
    finally:
        _stop(proc)


def test_banco_mais_novo_impede_o_inicio(tmp_path):
    conn = sqlite3.connect(tmp_path / "henduran.db")
    conn.execute("CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT, checksum TEXT, applied_at TEXT)")
    conn.execute("INSERT INTO schema_migrations VALUES (999, 'futura', 'x', 'agora')")
    conn.commit()
    conn.close()
    result = subprocess.run(
        [sys.executable, "-m", "henduran"],
        env=_env(HENDURAN_TOKEN=TOKEN, HENDURAN_PROVIDER="fake", HENDURAN_DATA_DIR=str(tmp_path)),
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode == EXIT_DATABASE
    assert "banco_mais_novo" in result.stderr and "não foi iniciado" in result.stderr
    assert result.stdout == ""
