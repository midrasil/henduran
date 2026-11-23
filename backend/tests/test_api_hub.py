"""Rotas do Hugging Face, remoção de modelos e pastas extras (sem rede)."""

from __future__ import annotations

import time
from collections import namedtuple
from urllib.parse import quote

import httpx
import pytest

from henduran.ai.engine import EngineManager
from henduran.ai.modelhub import HubClient, ModelHub
from henduran.paths import DataPaths
from henduran.providers.fake import FakeNarratorProvider
from henduran.settings import SettingsStore

from .conftest import RunningServer, run_server
from .fake_hub import BLOB, FakeHub

GB = 2**30
HARDWARE = {"gpus": [{"name": "Placa Teste", "memory_bytes": 8 * GB}], "ram_bytes": 16 * GB, "cpu": "CPU", "os": "Windows"}
REPO = "autor/Repo-GGUF"
Usage = namedtuple("Usage", "total used free")


@pytest.fixture
def setup(tmp_path):
    paths = DataPaths(tmp_path / "dados").ensure()
    settings = SettingsStore(paths.settings_file)
    engine = EngineManager(paths, settings)
    fake = FakeHub()
    state = {"free": 10**12}
    hub = ModelHub(paths, settings, engine=engine, client=HubClient(fake.transport()),
                   disk_usage=lambda _p: Usage(state["free"], 0, state["free"]))
    with run_server(FakeNarratorProvider(delay=0), engine=engine, hub=hub, hardware_scan=lambda: HARDWARE) as srv:
        yield srv, paths, fake, state


def call(srv: RunningServer, method: str, path: str, **kw) -> httpx.Response:
    return httpx.request(method, f"{srv.base_url}{path}", headers=srv.auth, timeout=30, **kw)


def wait_download(srv: RunningServer, did: str, timeout: float = 10) -> dict:
    deadline = time.monotonic() + timeout
    while True:
        items = {d["id"]: d for d in call(srv, "GET", "/hub/downloads").json()["downloads"]}
        item = items.get(did)
        if item and item["state"] not in ("queued", "downloading", "verifying"):
            return item
        if time.monotonic() > deadline:
            raise AssertionError(f"download não terminou: {item}")
        time.sleep(0.05)


ROUTES = [
    ("GET", "/hub/search?q=x"), ("GET", f"/hub/repos/{REPO}/files"), ("GET", "/hub/downloads"),
    ("POST", "/hub/downloads"), ("POST", "/hub/downloads/abc/cancel"), ("POST", "/hub/downloads/abc/retry"),
    ("DELETE", "/hub/downloads/abc"), ("DELETE", "/models/a.gguf"), ("GET", "/models/folders"),
    ("POST", "/models/folders"), ("DELETE", "/models/folders?path=C:/x"),
]


@pytest.mark.parametrize("method,path", ROUTES)
def test_rotas_exigem_token(setup, method, path):
    srv = setup[0]
    for headers in ({}, {"Authorization": "Bearer errado"}):
        r = httpx.request(method, f"{srv.base_url}{path}", headers=headers, json={"repo": REPO, "file": "x.gguf", "path": "x"})
        assert r.status_code == 401


def test_sem_hub_responde_503():
    with run_server(FakeNarratorProvider(delay=0)) as srv:
        r = call(srv, "GET", "/hub/search?q=x")
        assert r.status_code == 503 and r.json()["detail"]["code"] == "hub_unavailable"


def test_busca(setup):
    srv, _, fake, _ = setup
    r = call(srv, "GET", "/hub/search", params={"q": "repo", "limit": 5})
    assert r.status_code == 200
    results = r.json()["results"]
    assert results[0]["license"] == "apache-2.0" and results[1]["restricted"] is True
    assert call(srv, "GET", "/hub/search", params={"limit": 0}).status_code == 422
    fake.status_override = 429
    r = call(srv, "GET", "/hub/search", params={"q": "x"})
    assert r.status_code == 429 and r.json()["detail"]["code"] == "limite_requisicoes"


def test_arquivos_com_fit_instalado_e_espaco(setup):
    srv = setup[0]
    r = call(srv, "GET", f"/hub/repos/{REPO}/files")
    assert r.status_code == 200
    body = r.json()
    assert body["license"] == "apache-2.0" and body["free_bytes"] == 10**12
    assert {f["fit"] for f in body["files"]} == {"gpu"}
    assert all(f["installed"] is False for f in body["files"])
    assert call(srv, "GET", "/hub/repos/../x/files").status_code in (404, 422)
    r = call(srv, "GET", "/hub/repos/a/CON/files")
    assert r.status_code == 422 and r.json()["detail"]["code"] == "repo_invalido"


def test_fluxo_de_download_e_remocao(setup):
    srv, paths, _, _ = setup
    r = call(srv, "POST", "/hub/downloads", json={"repo": REPO, "file": "Modelo-Q4_K_M.gguf"})
    assert r.status_code == 202
    item = wait_download(srv, r.json()["id"])
    assert item["state"] == "done" and item["verified"] is True and item["progress"] == 1.0
    models = call(srv, "GET", "/models").json()["models"]
    assert [m["id"] for m in models] == [item["model_id"]]
    assert models[0]["source"] == "app" and models[0]["removable"] is True
    files = call(srv, "GET", f"/hub/repos/{REPO}/files").json()["files"]
    assert next(f for f in files if f["name"] == "Modelo-Q4_K_M.gguf")["installed"] is True
    assert call(srv, "DELETE", f"/hub/downloads/{item['id']}").status_code == 200
    assert call(srv, "GET", "/hub/downloads").json()["downloads"] == []
    r = call(srv, "DELETE", "/models/" + quote(item["model_id"]))
    assert r.status_code == 200 and r.json()["files"] == 1
    assert not any(paths.models_dir.rglob("*.gguf"))
    r = call(srv, "DELETE", "/models/" + quote(item["model_id"]))
    assert r.status_code == 404 and r.json()["detail"]["code"] == "model_not_found"


def test_queda_e_tentar_de_novo(setup):
    srv, _, fake, _ = setup
    fake.fail_after["Modelo-Q4_K_M.gguf"] = 5000
    did = call(srv, "POST", "/hub/downloads", json={"repo": REPO, "file": "Modelo-Q4_K_M.gguf"}).json()["id"]
    item = wait_download(srv, did)
    assert item["state"] == "error" and item["error"]["code"] == "rede" and item["done_bytes"] == 5000
    assert call(srv, "POST", f"/hub/downloads/{did}/retry").status_code == 202
    assert wait_download(srv, did)["state"] == "done"
    assert fake.range_headers() == [None, "bytes=5000-"]


def test_cancelar_e_limpar_via_api(setup):
    srv, paths, fake, _ = setup
    fake.slow = True
    did = call(srv, "POST", "/hub/downloads", json={"repo": REPO, "file": "Modelo-Q4_K_M.gguf"}).json()["id"]
    r = call(srv, "POST", "/hub/downloads", json={"repo": REPO, "file": "big/Grande-Q8_0-00001-of-00002.gguf"})
    assert r.status_code == 409 and r.json()["detail"]["code"] == "ocupado"
    assert call(srv, "DELETE", f"/hub/downloads/{did}").status_code == 409
    r = call(srv, "POST", f"/hub/downloads/{did}/cancel")
    assert r.status_code == 200 and r.json()["state"] == "cancelled"
    assert call(srv, "DELETE", f"/hub/downloads/{did}").status_code == 200
    assert not any(paths.models_dir.rglob("*.part"))
    assert call(srv, "POST", "/hub/downloads/nada/cancel").status_code == 404


@pytest.mark.parametrize("body,code", [
    ({"repo": "../x", "file": "a.gguf"}, "repo_invalido"),
    ({"repo": REPO, "file": "../a.gguf"}, "arquivo_invalido"),
    ({"repo": REPO, "file": "a.exe"}, "arquivo_invalido"),
    ({"repo": REPO, "file": "CON.gguf"}, "arquivo_invalido"),
])
def test_download_recusa_nomes_maliciosos(setup, body, code):
    r = call(setup[0], "POST", "/hub/downloads", json=body)
    assert r.status_code == 422 and r.json()["detail"]["code"] == code


def test_download_restrito_e_sem_espaco(setup):
    srv, _, fake, state = setup
    fake.gated = "manual"
    r = call(srv, "POST", "/hub/downloads", json={"repo": REPO, "file": "Modelo-Q4_K_M.gguf"})
    assert r.status_code == 403 and r.json()["detail"]["code"] == "restrito"
    fake.gated = False
    state["free"] = 10
    r = call(srv, "POST", "/hub/downloads", json={"repo": REPO, "file": "Modelo-Q4_K_M.gguf"})
    assert r.status_code == 507 and r.json()["detail"]["code"] == "sem_espaco"


def test_pastas_via_api(setup, tmp_path):
    srv, paths, _, _ = setup
    other = tmp_path / "ext"
    other.mkdir()
    (other / "E-Q4_K_M.gguf").write_bytes(BLOB)
    folders = call(srv, "GET", "/models/folders").json()["folders"]
    assert folders == [{"path": str(paths.models_dir), "kind": "app", "exists": True}]
    r = call(srv, "POST", "/models/folders", json={"path": str(other)})
    assert r.status_code == 200 and r.json()["added"]["path"] == str(other.resolve())
    models = call(srv, "GET", "/models").json()["models"]
    assert models[0]["source"] == "extra" and models[0]["removable"] is False
    assert models[0]["folder"] == str(other.resolve())
    r = call(srv, "POST", "/models/select", json={"id": models[0]["id"]})
    assert r.status_code == 200
    r = call(srv, "DELETE", "/models/" + quote(models[0]["id"]))
    assert r.status_code == 409 and r.json()["detail"]["code"] == "pasta_externa"
    assert (other / "E-Q4_K_M.gguf").exists()
    r = call(srv, "POST", "/models/folders", json={"path": str(tmp_path / "nao-existe")})
    assert r.status_code == 404 and r.json()["detail"]["code"] == "pasta_inexistente"
    r = call(srv, "DELETE", "/models/folders", params={"path": str(other.resolve())})
    assert r.status_code == 200 and len(r.json()["folders"]) == 1
    assert (other / "E-Q4_K_M.gguf").exists()
    r = call(srv, "DELETE", "/models/folders", params={"path": str(other)})
    assert r.status_code == 404 and r.json()["detail"]["code"] == "pasta_desconhecida"


def test_cors_permite_delete(setup):
    srv = setup[0]
    r = httpx.options(f"{srv.base_url}/models/a.gguf", headers={
        "Origin": "http://tauri.localhost", "Access-Control-Request-Method": "DELETE",
        "Access-Control-Request-Headers": "authorization",
    })
    assert r.status_code == 200
    assert "DELETE" in r.headers["access-control-allow-methods"]
