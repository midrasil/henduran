"""LocalLlamaProvider contra o servidor falso que fala a API OpenAI com streaming."""

from __future__ import annotations

import asyncio
import json

import pytest

from henduran.ai.engine import EngineManager
from henduran.providers.base import ProviderUnavailable
from henduran.providers.local import LocalLlamaProvider

from .test_engine import add_model, fake_launcher, install_fake_binary

MESSAGES = [{"role": "user", "content": "Olá"}]


@pytest.fixture
def manager(tmp_path):
    from henduran.paths import DataPaths
    from henduran.settings import SettingsStore

    paths = DataPaths(tmp_path / "dados").ensure()
    settings = SettingsStore(paths.settings_file)
    return EngineManager(paths, settings, launcher=fake_launcher, poll_interval=0.05, ready_timeout=20)


async def collect(agen):
    return [p async for p in agen]


async def test_codigos_quando_nao_pronto(manager):
    provider = LocalLlamaProvider(manager)
    with pytest.raises(ProviderUnavailable) as err:
        await collect(provider.stream_chat(MESSAGES))
    assert err.value.code == "engine_not_installed"
    install_fake_binary(manager.paths)
    with pytest.raises(ProviderUnavailable) as err:
        await collect(provider.stream_chat(MESSAGES))
    assert err.value.code == "no_model"
    add_model(manager.paths)
    manager.settings.update(active_model="autor/Modelo-Q4_K_M.gguf")
    with pytest.raises(ProviderUnavailable) as err:
        await collect(provider.stream_chat(MESSAGES))
    assert err.value.code == "engine_not_ready"
    health = await provider.health()
    assert health["ready"] is False and health["code"] == "engine_not_ready"
    assert await provider.list_models() == ["autor/Modelo-Q4_K_M.gguf"]


async def test_streaming_real_com_servidor_falso(manager, monkeypatch):
    install_fake_binary(manager.paths)
    add_model(manager.paths)
    manager.settings.update(active_model="autor/Modelo-Q4_K_M.gguf")
    provider = LocalLlamaProvider(manager)
    try:
        assert (await manager.start())["state"] == "ready"
        assert (await provider.health())["ready"] is True
        pieces = await collect(provider.stream_chat(MESSAGES))
        assert len(pieces) > 1
        assert "".join(pieces) == "Olá, viajante. A estrada é longa."  # sem o bloco <think>
        text = await provider.complete(MESSAGES, json_schema={"type": "object"})
        assert json.loads(text) == {"ok": True}
    finally:
        await provider.aclose()
        await manager.stop()


async def test_servidor_exige_a_chave_da_execucao(manager):
    """Outro processo local sem a chave recebe 401 do llama-server."""
    import httpx

    install_fake_binary(manager.paths)
    add_model(manager.paths)
    manager.settings.update(active_model="autor/Modelo-Q4_K_M.gguf")
    try:
        await manager.start()
        base, key = manager.endpoint()
        async with httpx.AsyncClient() as c:
            assert (await c.get(f"{base}/models")).status_code == 401
            assert (await c.get(f"{base}/models", headers={"Authorization": f"Bearer {key}"})).status_code == 200
    finally:
        await manager.stop()


async def test_cancelamento_interrompe(manager, monkeypatch):
    monkeypatch.setenv("FAKE_REPLY", " ".join(f"p{i}" for i in range(200)))
    monkeypatch.setenv("FAKE_DELAY", "0.05")
    install_fake_binary(manager.paths)
    add_model(manager.paths)
    manager.settings.update(active_model="autor/Modelo-Q4_K_M.gguf")
    provider = LocalLlamaProvider(manager)
    cancel = asyncio.Event()
    got: list[str] = []
    try:
        await manager.start()

        async def consume():
            async for piece in provider.stream_chat(MESSAGES, cancel=cancel):
                got.append(piece)

        task = asyncio.create_task(consume())
        while len(got) < 3:
            await asyncio.sleep(0.01)
        cancel.set()
        await asyncio.wait_for(task, timeout=2)
        assert 3 <= len(got) < 200
    finally:
        await provider.aclose()
        await manager.stop()
