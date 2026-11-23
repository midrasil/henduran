"""Rotas de hardware, modelos e motor, e o chat com o provedor local."""

from __future__ import annotations

import time

import httpx
import pytest

from henduran.ai.engine import EngineManager
from henduran.paths import DataPaths
from henduran.providers.fake import FakeNarratorProvider
from henduran.providers.local import LocalLlamaProvider

from .conftest import TOKEN, RunningServer, open_settings, parse_sse, run_server
from .test_engine import GOOD_ZIP, add_model, fake_launcher, install_fake_binary, releases_with

GB = 2**30
HARDWARE = {"gpus": [{"name": "Placa Teste", "memory_bytes": 8 * GB}], "ram_bytes": 16 * GB, "cpu": "CPU Teste", "os": "Windows"}
BODY = {"messages": [{"role": "user", "content": "Olá"}]}


@pytest.fixture
def manager(tmp_path) -> EngineManager:
    paths = DataPaths(tmp_path / "dados").ensure()
    settings = open_settings(paths)
    state = {"releases": releases_with(GOOD_ZIP), "data": GOOD_ZIP}

    async def fetch_json(url):
        if state["releases"] is None:
            raise OSError("sem rede")
        return state["releases"]

    async def fetch_bytes(url, progress):
        progress(len(state["data"]), len(state["data"]))
        return state["data"]

    m = EngineManager(paths, settings, fetch_json=fetch_json, fetch_bytes=fetch_bytes,
                      launcher=fake_launcher, poll_interval=0.05, ready_timeout=20)
    m.test_state = state  # type: ignore[attr-defined]
    return m


@pytest.fixture
def server(manager):
    with run_server(LocalLlamaProvider(manager), engine=manager, hardware_scan=lambda: HARDWARE) as srv:
        yield srv
        httpx.post(f"{srv.base_url}/engine/stop", headers=srv.auth, timeout=30)


def get(srv: RunningServer, path: str, **kw) -> httpx.Response:
    return httpx.get(f"{srv.base_url}{path}", headers=srv.auth, timeout=30, **kw)


def post(srv: RunningServer, path: str, json=None) -> httpx.Response:
    return httpx.post(f"{srv.base_url}{path}", headers=srv.auth, json=json, timeout=30)


def wait_state(srv: RunningServer, wanted: set[str], timeout: float = 20) -> dict:
    deadline = time.monotonic() + timeout
    while True:
        st = get(srv, "/engine/status").json()
        if st["state"] in wanted or time.monotonic() > deadline:
            return st
        time.sleep(0.05)


NEW_ROUTES = [
    ("GET", "/hardware"), ("GET", "/models"), ("POST", "/models/select"), ("GET", "/engine/status"),
    ("GET", "/engine/release"), ("POST", "/engine/install"), ("POST", "/engine/start"), ("POST", "/engine/stop"),
]


@pytest.mark.parametrize("method,path", NEW_ROUTES)
@pytest.mark.parametrize("headers", [{}, {"Authorization": "Bearer errado"}], ids=["sem-token", "token-errado"])
def test_rotas_novas_exigem_token(server, method, path, headers):
    r = httpx.request(method, f"{server.base_url}{path}", headers=headers, json={"id": "x"})
    assert r.status_code == 401


def test_hardware(server):
    assert get(server, "/hardware").json() == HARDWARE


def test_models_vazio_informa_a_pasta(server, manager):
    body = get(server, "/models").json()
    assert body == {"models": [], "models_dir": str(manager.paths.models_dir), "active": None}


def test_models_lista_fit_e_selecao(server, manager):
    add_model(manager.paths, "pequeno-Q4_K_M.gguf", 100)
    add_model(manager.paths, "Parte-00001-of-00002.gguf", 10)
    models = {m["id"]: m for m in get(server, "/models").json()["models"]}
    small = models["pequeno-Q4_K_M.gguf"]
    assert small["fit"] == "gpu" and small["quant"] == "Q4_K_M" and small["active"] is False
    assert small["size_bytes"] == 100 and small["complete"] is True

    r = post(server, "/models/select", {"id": "nao-existe.gguf"})
    assert r.status_code == 404 and r.json()["detail"]["code"] == "model_not_found"
    r = post(server, "/models/select", {"id": "../../fora.gguf"})
    assert r.status_code == 404
    r = post(server, "/models/select", {"id": "Parte-00001-of-00002.gguf"})
    assert r.status_code == 409 and r.json()["detail"]["code"] == "model_incomplete"
    r = post(server, "/models/select", {"id": "pequeno-Q4_K_M.gguf"})
    assert r.status_code == 200 and r.json()["active"] == "pequeno-Q4_K_M.gguf"
    assert get(server, "/models").json()["active"] == "pequeno-Q4_K_M.gguf"
    assert manager.settings.get("active_model") == "pequeno-Q4_K_M.gguf"
    assert post(server, "/models/select", {}).status_code == 422


def test_status_inicial(server):
    st = get(server, "/engine/status").json()
    assert st["state"] == "stopped" and st["installed"] is False and st["provider"] == "local"
    for key in ("message", "progress", "version", "active_model", "log"):
        assert key in st


def test_release_informa_tamanho_e_digest(server, manager):
    body = get(server, "/engine/release", params={"variant": "vulkan"}).json()
    assert body["size"] == len(GOOD_ZIP) and body["verifiable"] is True and body["tag"] == "b12635"
    assert get(server, "/engine/release", params={"variant": "cuda"}).status_code == 422
    manager._release_cache.clear()
    manager.test_state["releases"] = None
    r = get(server, "/engine/release")
    assert r.status_code == 502 and r.json()["detail"]["code"] == "release_lookup_failed"


def test_install_com_digest_conferido(server):
    r = post(server, "/engine/install", {"variant": "vulkan"})
    assert r.status_code == 202
    st = wait_state(server, {"stopped", "error"})
    assert st["state"] == "stopped" and st["installed"] is True and st["verified"] is True
    assert st["version"] == "b12635" and st["variant"] == "vulkan"


def test_install_sem_digest_exige_consentimento(server, manager):
    manager.test_state["releases"] = releases_with(GOOD_ZIP, digest=None)
    r = post(server, "/engine/install", {"variant": "vulkan"})
    assert r.status_code == 409 and r.json()["detail"]["code"] == "digest_unavailable"
    r = post(server, "/engine/install", {"variant": "vulkan", "allow_unverified": True})
    assert r.status_code == 202
    st = wait_state(server, {"stopped", "error"})
    assert st["installed"] is True and st["verified"] is False
    assert post(server, "/engine/install", {"variant": "cuda"}).status_code == 422


def test_start_explica_o_que_falta(server, manager):
    r = post(server, "/engine/start")
    assert r.status_code == 409 and r.json()["detail"]["code"] == "engine_not_installed"
    install_fake_binary(manager.paths)
    r = post(server, "/engine/start")
    assert r.status_code == 409 and r.json()["detail"]["code"] == "no_model"


@pytest.mark.parametrize(
    "prepare,code",
    [("nada", "engine_not_installed"), ("motor", "no_model"), ("motor+modelo", "engine_not_ready")],
)
def test_chat_sem_motor_pronto_emite_erro_com_codigo(server, manager, prepare, code):
    if "motor" in prepare:
        install_fake_binary(manager.paths)
    if "modelo" in prepare:
        add_model(manager.paths)
        manager.settings.update(active_model="autor/Modelo-Q4_K_M.gguf")
    r = httpx.post(f"{server.base_url}/chat/stream", headers=server.auth, json=BODY, timeout=30)
    events = parse_sse(r.text)
    assert events[0][0] == "start"
    assert events[-1][0] == "error"
    assert events[-1][1]["code"] == code
    assert events[-1][1]["message"]
    health = get(server, "/health").json()["provider"]
    assert health["ready"] is False and health["code"] == code


def test_fluxo_completo_start_chat_stop(server, manager):
    install_fake_binary(manager.paths)
    add_model(manager.paths)
    assert post(server, "/models/select", {"id": "autor/Modelo-Q4_K_M.gguf"}).status_code == 200
    r = post(server, "/engine/start")
    assert r.status_code == 202 and r.json()["state"] == "starting"
    st = wait_state(server, {"ready", "error"})
    assert st["state"] == "ready", st
    assert st["active_model_name"] == "Modelo-Q4_K_M.gguf"

    r = httpx.post(f"{server.base_url}/chat/stream", headers=server.auth, json=BODY, timeout=30)
    events = parse_sse(r.text)
    assert events[0][0] == "start" and events[-1] == ("done", {"reason": "completed"})
    text = "".join(d["text"] for n, d in events if n == "token")
    assert text == "Olá, viajante. A estrada é longa."

    st = post(server, "/engine/stop").json()
    assert st["state"] == "stopped"


def test_sem_gerente_do_motor_rotas_respondem_503():
    with run_server(FakeNarratorProvider(delay=0)) as srv:
        r = httpx.get(f"{srv.base_url}/engine/status", headers={"Authorization": f"Bearer {TOKEN}"})
        assert r.status_code == 503 and r.json()["detail"]["code"] == "engine_unavailable"
