from __future__ import annotations

import time

import httpx
import pytest

from henduran.api.app import create_app
from henduran.providers.fake import DEFAULT_REPLY, FakeNarratorProvider

from .conftest import TOKEN, RunningServer, parse_sse

BODY = {"messages": [{"role": "user", "content": "Olá, Narrador"}]}


def test_create_app_exige_token():
    with pytest.raises(ValueError):
        create_app(FakeNarratorProvider(), "")


def test_health(fast_server: RunningServer):
    r = httpx.get(f"{fast_server.base_url}/health", headers=fast_server.auth)
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "provider": {"name": "fake", "ready": True}}


@pytest.mark.parametrize(
    "headers",
    [{}, {"Authorization": "Bearer errado"}, {"Authorization": TOKEN}],
    ids=["sem-token", "token-errado", "sem-bearer"],
)
@pytest.mark.parametrize(
    "method,path",
    [("GET", "/health"), ("POST", "/chat/stream"), ("POST", "/chat/abc/cancel")],
)
def test_401_sem_token_valido(fast_server: RunningServer, headers, method, path):
    r = httpx.request(method, f"{fast_server.base_url}{path}", headers=headers, json=BODY)
    assert r.status_code == 401


def test_streaming_completo_na_ordem(fast_server: RunningServer):
    r = httpx.post(f"{fast_server.base_url}/chat/stream", headers=fast_server.auth, json=BODY)
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/event-stream")
    events = parse_sse(r.text)
    names = [name for name, _ in events]
    assert names[0] == "start"
    assert names[-1] == "done"
    assert set(names[1:-1]) == {"token"}
    assert events[-1][1] == {"reason": "completed"}
    assert "".join(data["text"] for name, data in events if name == "token") == DEFAULT_REPLY
    assert fast_server.app.state.generations == {}


def test_requisicao_invalida_retorna_422(fast_server: RunningServer):
    r = httpx.post(
        f"{fast_server.base_url}/chat/stream", headers=fast_server.auth, json={"messages": []}
    )
    assert r.status_code == 422


def test_cancelar_id_desconhecido_retorna_404(fast_server: RunningServer):
    r = httpx.post(f"{fast_server.base_url}/chat/nao-existe/cancel", headers=fast_server.auth)
    assert r.status_code == 404


def test_cancelamento_pelo_endpoint_interrompe_o_fluxo(slow_server: RunningServer):
    base, auth = slow_server.base_url, slow_server.auth
    with httpx.Client(timeout=10) as client:
        with client.stream("POST", f"{base}/chat/stream", headers=auth, json=BODY) as r:
            lines = r.iter_lines()
            raw = []
            generation_id = None
            tokens = 0
            cancelled_sent = False
            for line in lines:
                raw.append(line)
                if line.startswith("data:") and generation_id is None:
                    generation_id = parse_sse("\n".join(raw) + "\n\n")[0][1]["id"]
                if line == "event: token":
                    tokens += 1
                if tokens >= 3 and not cancelled_sent:
                    c = client.post(f"{base}/chat/{generation_id}/cancel", headers=auth)
                    assert c.status_code == 200
                    cancelled_sent = True
    events = parse_sse("\n".join(raw) + "\n")
    assert events[0][0] == "start"
    assert events[-1] == ("done", {"reason": "cancelled"})
    emitted = sum(1 for name, _ in events if name == "token")
    assert emitted < 500
    assert slow_server.provider.finished.wait(2)
    assert slow_server.provider.cancel_was_set is True
    assert slow_server.app.state.generations == {}


def test_cancelamento_por_desconexao(slow_server: RunningServer):
    base, auth = slow_server.base_url, slow_server.auth
    with httpx.Client(timeout=10) as client:
        with client.stream("POST", f"{base}/chat/stream", headers=auth, json=BODY) as r:
            tokens = 0
            for line in r.iter_lines():
                if line == "event: token":
                    tokens += 1
                if tokens >= 3:
                    break  # sai do contexto e fecha a conexão
    started = time.monotonic()
    # A geração completa levaria ~10 s (500 palavras x 20 ms); precisa parar bem antes.
    # Na desconexão o provedor é interrompido pelo cancelamento da tarefa (CancelledError).
    assert slow_server.provider.finished.wait(3), "a geração não foi interrompida"
    assert time.monotonic() - started < 3
    assert slow_server.provider.yielded < 500
    deadline = time.monotonic() + 2
    while slow_server.app.state.generations and time.monotonic() < deadline:
        time.sleep(0.01)
    assert slow_server.app.state.generations == {}


def test_cors_permite_somente_origens_do_tauri_e_vite(fast_server: RunningServer):
    def preflight(origin: str) -> httpx.Response:
        return httpx.options(
            f"{fast_server.base_url}/chat/stream",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "authorization,content-type",
            },
        )

    for origin in ("tauri://localhost", "http://tauri.localhost", "http://localhost:5173"):
        r = preflight(origin)
        assert r.status_code == 200
        assert r.headers["access-control-allow-origin"] == origin
    r = preflight("http://evil.example")
    assert "access-control-allow-origin" not in r.headers
