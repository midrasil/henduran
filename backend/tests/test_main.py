from __future__ import annotations

import json
import os
import socket
import subprocess
import sys

import httpx
import pytest

from henduran.__main__ import EXIT_MISSING_TOKEN, HOST, bind_socket

from .conftest import TOKEN


def _env(**extra: str) -> dict[str, str]:
    env = {k: v for k, v in os.environ.items() if k != "HENDURAN_TOKEN"}
    env["PYTHONUNBUFFERED"] = "1"
    env.update(extra)
    return env


def test_recusa_iniciar_sem_token():
    result = subprocess.run(
        [sys.executable, "-m", "henduran", "--port", "0"],
        env=_env(),
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


def test_processo_anuncia_porta_e_escuta_somente_em_loopback():
    proc = subprocess.Popen(
        [sys.executable, "-m", "henduran"],
        env=_env(HENDURAN_TOKEN=TOKEN),
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
