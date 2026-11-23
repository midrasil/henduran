"""EngineManager: descoberta de modelos, escada de camadas, download seguro e ciclo de vida.

Adaptado de ``backend/tests/test_runtime.py`` do Caliope (commit ``1cab9e0``):
os testes de início, falta de memória e download seguem a mesma ideia, mas o
servidor falso agora é um script Python (``fake_llama_server.py``) e roda
também no Windows. A detecção de modelos divididos segue ``test_models.py``.
"""

from __future__ import annotations

import asyncio
import hashlib
import io
import json
import os
import subprocess
import sys
import textwrap
import time
import zipfile
from pathlib import Path

import pytest

from henduran.ai import engine as eng
from henduran.ai.engine import (
    CREATE_BREAKAWAY_FROM_JOB,
    SPAWN_FLAGS,
    EngineError,
    EngineManager,
    build_command,
    child_env,
    extract_zip_safely,
    find_models,
    fit_ladder,
    out_of_memory,
    pick_asset,
    quant_of,
)
from henduran.paths import DataPaths

from .conftest import open_settings

FAKE_SERVER = Path(__file__).with_name("fake_llama_server.py")
TAG = "b12635"


def zipped(files: dict[str, bytes], *, symlink: str | None = None) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        for name, data in files.items():
            z.writestr(name, data)
        if symlink:
            info = zipfile.ZipInfo(symlink)
            info.external_attr = (0o120777 << 16)
            z.writestr(info, "../../fora")
    return buf.getvalue()


GOOD_ZIP = zipped({"llama-server.exe": b"binario", "ggml.dll": b"x", "LICENSE": b"MIT"})


def releases_with(data: bytes | None, *, digest: str | None | bool = True, variant: str = "vulkan") -> list:
    """Lista de releases como a da API do GitHub. ``digest=True`` usa o SHA-256 de ``data``."""
    if digest is True:
        digest = "sha256:" + hashlib.sha256(data or b"").hexdigest()
    asset = {
        "name": f"llama-{TAG}-bin-win-{variant}-x64.zip",
        "size": len(data or b""),
        "browser_download_url": f"https://github.com/ggml-org/llama.cpp/releases/download/{TAG}/llama-{TAG}-bin-win-{variant}-x64.zip",
    }
    if digest:
        asset["digest"] = digest
    return [
        {"tag_name": "v1.0.0", "assets": [{"name": "nightly-tag.txt", "size": 7}]},
        {"tag_name": TAG, "prerelease": True, "assets": [
            {"name": f"llama-{TAG}-bin-win-cuda-13.5-x64.zip", "size": 1,
             "browser_download_url": "https://github.com/ggml-org/llama.cpp/releases/download/x/cuda.zip"},
            asset,
        ]},
    ]


@pytest.fixture
def paths(tmp_path: Path) -> DataPaths:
    return DataPaths(tmp_path / "dados").ensure()


@pytest.fixture
def settings(paths: DataPaths) -> SettingsStore:
    return open_settings(paths)


def make_manager(paths, settings, *, releases=None, data: bytes | None = None, fetched=None, **kw) -> EngineManager:
    async def fetch_json(url):
        if releases is None:
            raise OSError("sem rede")
        return releases

    async def fetch_bytes(url, progress):
        if fetched is not None:
            fetched.append(url)
        progress(len(data or b"") // 2, len(data or b""))
        return data or b""

    return EngineManager(paths, settings, fetch_json=fetch_json, fetch_bytes=fetch_bytes, **kw)


def install_fake_binary(paths: DataPaths, variant: str = "vulkan") -> Path:
    folder = paths.engine_dir
    folder.mkdir(parents=True, exist_ok=True)
    binary = folder / "llama-server.exe"
    binary.write_bytes(b"falso")
    (folder / "SOURCE.json").write_text(json.dumps({"tag": TAG, "variant": variant, "verified": True}))
    return binary


def add_model(paths: DataPaths, rel: str = "autor/Modelo-Q4_K_M.gguf", size: int = 10) -> Path:
    p = paths.models_dir / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(b"0" * size)
    return p


def fake_launcher(binary: Path) -> list[str]:
    return [sys.executable, "-I", str(FAKE_SERVER)]


# --------------------------------------------------------------- descoberta
def test_find_models_ordena_ignora_mmproj_e_agrupa_partes(paths):
    add_model(paths, "a/Zeta-Q8_0.gguf", 30)
    add_model(paths, "a/mmproj-f16.gguf", 5)
    add_model(paths, "a/notas.txt", 5)
    add_model(paths, "b/Big-Q4_K_M-00002-of-00002.gguf", 4)
    add_model(paths, "b/Big-Q4_K_M-00001-of-00002.gguf", 6)
    add_model(paths, "c/Torto-IQ3_XS-00001-of-00003.gguf", 1)
    add_model(paths, "c/Orfao-00002-of-00002.gguf", 1)
    found = find_models(paths.models_dir)
    assert [m["name"] for m in found] == ["Big-Q4_K_M.gguf", "Torto-IQ3_XS.gguf", "Zeta-Q8_0.gguf"]
    big, torto, zeta = found
    assert big["id"] == "b/Big-Q4_K_M-00001-of-00002.gguf"
    assert big["size_bytes"] == 10 and big["parts"] == 2 and big["complete"] is True
    assert big["quant"] == "Q4_K_M"
    assert torto["complete"] is False and torto["quant"] == "IQ3_XS"
    assert zeta["parts"] == 1 and zeta["quant"] == "Q8_0" and zeta["size_bytes"] == 30


def test_find_models_pasta_ausente(tmp_path):
    assert find_models(tmp_path / "nao-existe") == []


@pytest.mark.parametrize(
    "name,quant",
    [
        ("qwen2.5-0.5b-instruct-q4_k_m.gguf", "Q4_K_M"),
        ("Llama-3.2-1B-Instruct-Q8_0.gguf", "Q8_0"),
        ("x.IQ3_XS.gguf", "IQ3_XS"),
        ("modelo-f16.gguf", "F16"),
        ("modelo-BF16-00001-of-00002.gguf", "BF16"),
        ("sem-quantizacao.gguf", None),
    ],
)
def test_quant_of(name, quant):
    assert quant_of(name) == quant


# ------------------------------------------------------------- comando/escada
def test_escada_de_camadas_e_falta_de_memoria():
    assert fit_ladder("auto") == [(2, "auto"), (1, "auto"), (1, "26"), (1, "18")]
    assert fit_ladder("28") == [(2, "28"), (1, "28")]
    assert fit_ladder("auto", "cpu") == [(2, "0"), (1, "0")]
    assert out_of_memory("vk::Device::allocateMemory: ErrorOutOfDeviceMemory")
    assert out_of_memory("ggml: failed to allocate buffer")
    assert not out_of_memory("model loaded")


def test_build_command_em_loopback_sem_chave(tmp_path):
    cmd = build_command(tmp_path / "llama-server.exe", "m.gguf", 4096, 8091, "auto")
    assert cmd[cmd.index("--host") + 1] == "127.0.0.1"
    assert cmd[cmd.index("--port") + 1] == "8091"
    assert cmd[cmd.index("-c") + 1] == "8192"  # dois slots de 4096
    assert cmd[cmd.index("-np") + 1] == "2"
    assert "--no-webui" in cmd
    assert "--api-key" not in cmd


def test_child_env_remove_llama_e_token(monkeypatch):
    monkeypatch.setenv("LLAMA_ARG_HOST", "0.0.0.0")
    monkeypatch.setenv("HENDURAN_TOKEN", "segredo")
    env = child_env("chave")
    assert env["LLAMA_API_KEY"] == "chave"
    assert "LLAMA_ARG_HOST" not in env and "HENDURAN_TOKEN" not in env


def test_flags_de_criacao_nao_escapam_do_job():
    assert SPAWN_FLAGS & CREATE_BREAKAWAY_FROM_JOB == 0


# ----------------------------------------------------------------- releases
def test_pick_asset_ignora_latest_falso_e_outras_variantes():
    rel = releases_with(GOOD_ZIP)
    asset = pick_asset(rel, "vulkan")
    assert asset is not None
    assert asset.name == f"llama-{TAG}-bin-win-vulkan-x64.zip" and asset.tag == TAG
    assert asset.digest == hashlib.sha256(GOOD_ZIP).hexdigest()
    assert pick_asset(rel, "cpu") is None


def test_pick_asset_rejeita_url_fora_do_github_oficial():
    rel = releases_with(GOOD_ZIP)
    rel[1]["assets"][1]["browser_download_url"] = "https://exemplo.test/llama.zip"
    assert pick_asset(rel, "vulkan") is None


# ----------------------------------------------------------------- download
async def test_download_com_digest_correto_instala(paths, settings):
    fetched: list[str] = []
    m = make_manager(paths, settings, releases=releases_with(GOOD_ZIP, variant="cpu"), data=GOOD_ZIP, fetched=fetched)
    st = await m.download("cpu")
    assert fetched == [f"https://github.com/ggml-org/llama.cpp/releases/download/{TAG}/llama-{TAG}-bin-win-cpu-x64.zip"]
    assert st["state"] == "stopped" and st["installed"] is True
    assert st["version"] == TAG and st["variant"] == "cpu" and st["verified"] is True
    assert (paths.engine_dir / "llama-server.exe").read_bytes() == b"binario"
    assert settings.get("engine_variant") == "cpu"
    assert "SHA-256 conferido" in m.log_tail()


async def test_download_com_digest_divergente_descarta(paths, settings):
    m = make_manager(paths, settings, releases=releases_with(GOOD_ZIP, digest="sha256:" + "0" * 64), data=GOOD_ZIP)
    st = await m.download("vulkan")
    assert st["state"] == "error" and "SHA-256" in st["message"]
    assert not paths.engine_dir.joinpath("llama-server.exe").exists()
    assert not (paths.root / "engine.new").exists()
    assert "divergente" in m.log_tail()


async def test_download_sem_digest_exige_confirmacao(paths, settings):
    fetched: list[str] = []
    m = make_manager(paths, settings, releases=releases_with(GOOD_ZIP, digest=None), data=GOOD_ZIP, fetched=fetched)
    with pytest.raises(EngineError) as err:
        await m.install("vulkan")
    assert err.value.code == "digest_unavailable"
    assert fetched == [] and m.state == "stopped"

    st = await m.download("vulkan", allow_unverified=True)
    assert st["state"] == "stopped" and st["installed"] is True and st["verified"] is False
    assert "sem verificação" in m.log_tail()


@pytest.mark.parametrize(
    "files,symlink",
    [
        ({"../fora.exe": b"x", "llama-server.exe": b"x"}, None),
        ({"pasta/../../fora.exe": b"x", "llama-server.exe": b"x"}, None),
        ({"/absoluto.exe": b"x", "llama-server.exe": b"x"}, None),
        ({"C:/Windows/fora.exe": b"x", "llama-server.exe": b"x"}, None),
        ({"llama-server.exe": b"x"}, "link"),
    ],
    ids=["dotdot", "dotdot-aninhado", "absoluto", "letra-de-unidade", "symlink"],
)
async def test_download_rejeita_zip_inseguro(paths, settings, files, symlink):
    data = zipped(files, symlink=symlink)
    m = make_manager(paths, settings, releases=releases_with(data), data=data)
    st = await m.download("vulkan")
    assert st["state"] == "error"
    assert "inseguros" in st["message"] or "simbólicos" in st["message"]
    assert not (paths.root / "fora.exe").exists()
    assert not paths.engine_dir.joinpath("llama-server.exe").exists()


async def test_download_rejeita_zip_sem_servidor_e_tamanho_errado(paths, settings):
    data = zipped({"leia-me.txt": b"x"})
    m = make_manager(paths, settings, releases=releases_with(data), data=data)
    assert "não contém" in (await m.download("vulkan"))["message"]

    rel = releases_with(GOOD_ZIP)
    rel[1]["assets"][1]["size"] = len(GOOD_ZIP) + 1
    m2 = make_manager(paths, settings, releases=rel, data=GOOD_ZIP)
    assert "tamanho" in (await m2.download("vulkan"))["message"]


def test_extract_zip_safely_rejeita_antes_de_gravar(tmp_path):
    data = zipped({"ok.txt": b"x", "llama-server.exe": b"x", "../fora.txt": b"x"})
    with pytest.raises(EngineError):
        extract_zip_safely(data, tmp_path / "dest")
    assert not (tmp_path / "dest" / "ok.txt").exists()
    assert not (tmp_path / "fora.txt").exists()


async def test_consulta_de_release_sem_rede(paths, settings):
    m = make_manager(paths, settings, releases=None)
    with pytest.raises(EngineError) as err:
        await m.lookup_release("vulkan")
    assert err.value.code == "release_lookup_failed"
    with pytest.raises(EngineError) as err:
        await m.lookup_release("cuda")
    assert err.value.code == "invalid_variant"


# --------------------------------------------------------------- início
async def test_erros_de_inicio_sao_explicados(paths, settings):
    m = EngineManager(paths, settings)
    with pytest.raises(EngineError) as err:
        m.request_start()
    assert err.value.code == "engine_not_installed"
    install_fake_binary(paths)
    with pytest.raises(EngineError) as err:
        m.request_start()
    assert err.value.code == "no_model"
    settings.update(active_model="sumiu.gguf")
    with pytest.raises(EngineError) as err:
        m.request_start()
    assert err.value.code == "no_model"
    add_model(paths, "Parte-00001-of-00002.gguf")
    settings.update(active_model="Parte-00001-of-00002.gguf")
    with pytest.raises(EngineError) as err:
        m.request_start()
    assert err.value.code == "model_incomplete"


async def test_inicio_pronto_e_parada_com_servidor_falso(paths, settings, monkeypatch):
    monkeypatch.setenv("FAKE_LOADING", "2")
    install_fake_binary(paths)
    add_model(paths)
    settings.update(active_model="autor/Modelo-Q4_K_M.gguf")
    m = EngineManager(paths, settings, launcher=fake_launcher, poll_interval=0.05, ready_timeout=20)
    try:
        st = await m.start()
        assert st["state"] == "ready", st
        assert st["active_model_name"] == "Modelo-Q4_K_M.gguf"
        base, key = m.endpoint()
        assert base.startswith("http://127.0.0.1:") and base.endswith("/v1") and len(key) >= 32
        assert m.pid_path.exists()
        assert "-np 2" in m.log_tail(50)
        assert key not in m.log_tail(50)  # a chave não aparece no log
        proc = m.process
    finally:
        await m.stop()
    assert proc.poll() is not None
    assert not m.pid_path.exists()
    assert m.status()["state"] == "stopped"
    assert m.endpoint() is None


async def test_falta_de_memoria_tenta_inicio_mais_leve(paths, settings, monkeypatch):
    monkeypatch.setenv("FAKE_OOM_NP2", "1")
    install_fake_binary(paths)
    add_model(paths)
    settings.update(active_model="autor/Modelo-Q4_K_M.gguf")
    m = EngineManager(paths, settings, launcher=fake_launcher, poll_interval=0.05, ready_timeout=20)
    try:
        st = await m.start()
        assert st["state"] == "ready", st
        assert "-np 1" in " ".join(m.process.args)
        model = str(paths.models_dir / "autor" / "Modelo-Q4_K_M.gguf")
        assert m._fit[(model, 4096, "vulkan")] == (1, "auto")
    finally:
        await m.stop()


async def test_queda_ao_carregar_vira_erro_com_log(paths, settings, monkeypatch):
    monkeypatch.setenv("FAKE_OOM_NP2", "1")
    install_fake_binary(paths, variant="vulkan")
    add_model(paths)
    settings.update(active_model="autor/Modelo-Q4_K_M.gguf")

    def launcher(binary):
        # Sempre pede dois slots: falha em todas as tentativas com -np 2.
        return [sys.executable, "-I", str(FAKE_SERVER), "-np", "2"]

    m = EngineManager(paths, settings, launcher=launcher, poll_interval=0.05, ready_timeout=20)
    st = await m.start()
    assert st["state"] == "error"
    assert "memória de vídeo" in st["message"]
    assert "ErrorOutOfDeviceMemory" in st["log"]
    assert m.process is None


async def test_parada_inesperada_vira_erro(paths, settings):
    install_fake_binary(paths)
    add_model(paths)
    settings.update(active_model="autor/Modelo-Q4_K_M.gguf")
    m = EngineManager(paths, settings, launcher=fake_launcher, poll_interval=0.05, ready_timeout=20)
    try:
        assert (await m.start())["state"] == "ready"
        m.process.kill()
        m.process.wait(10)
        assert m.status()["state"] == "error"
        assert m.endpoint() is None
    finally:
        await m.stop()


async def test_stop_durante_carregamento_cancela(paths, settings, monkeypatch):
    monkeypatch.setenv("FAKE_LOADING", "100000")
    install_fake_binary(paths)
    add_model(paths)
    settings.update(active_model="autor/Modelo-Q4_K_M.gguf")
    m = EngineManager(paths, settings, launcher=fake_launcher, poll_interval=0.05, ready_timeout=60)
    task = m.request_start()
    assert m.state == "starting"
    for _ in range(200):
        if m.process is not None:
            break
        await asyncio.sleep(0.02)
    proc = m.process
    st = await m.stop()
    assert task.done()
    assert st["state"] == "stopped"
    assert proc is not None and proc.poll() is not None


# ---------------------------------------------------- órfão (somente Windows)
@pytest.mark.skipif(os.name != "nt", reason="Job Object é do Windows")
def test_motor_morre_quando_o_servico_e_morto_a_forca(tmp_path):
    """Um 'serviço' inicia o motor falso e é morto com taskkill /F: o motor não pode sobrar."""
    data = tmp_path / "dados"
    script = tmp_path / "servico.py"
    script.write_text(textwrap.dedent(f"""
        import asyncio, sys, time
        sys.path.insert(0, {str(Path(__file__).resolve().parents[1])!r})
        from pathlib import Path
        from henduran.ai.engine import EngineManager
        from henduran.paths import DataPaths
        from henduran.db import open_app_database
        from henduran.settings import SettingsStore
        paths = DataPaths(Path({str(data)!r})).ensure()
        (paths.engine_dir / "llama-server.exe").write_bytes(b"x")
        (paths.models_dir / "m.gguf").write_bytes(b"0")
        s = SettingsStore(open_app_database(paths.database_file)[0])
        s.update(active_model="m.gguf")
        m = EngineManager(paths, s, launcher=lambda b: [sys.executable, "-I", {str(FAKE_SERVER)!r}], poll_interval=0.05)
        async def main():
            st = await m.start()
            print(st["state"], m.process.pid, flush=True)
            await asyncio.sleep(120)
        asyncio.run(main())
    """))
    env = {k: v for k, v in os.environ.items() if not k.startswith("FAKE_")}
    service = subprocess.Popen([sys.executable, "-I", str(script)], stdout=subprocess.PIPE, text=True, env=env)
    try:
        line = service.stdout.readline().split()
        assert line and line[0] == "ready", line
        child_pid = int(line[1])
        assert _alive(child_pid)
        subprocess.run(["taskkill", "/PID", str(service.pid), "/F"], capture_output=True, check=True)
        service.wait(10)
        deadline = time.monotonic() + 10
        while _alive(child_pid) and time.monotonic() < deadline:
            time.sleep(0.1)
        assert not _alive(child_pid), "o motor sobrou depois de o serviço ser morto"
    finally:
        if service.poll() is None:
            service.kill()


def _alive(pid: int) -> bool:
    out = subprocess.run(["tasklist", "/FI", f"PID eq {pid}", "/NH"], capture_output=True, text=True).stdout
    return str(pid) in out


def test_kill_stale_ignora_processo_que_nao_e_do_motor(paths, settings):
    # Um PID registrado que não é do motor (este próprio processo de teste) não pode ser morto.
    paths.logs_dir.mkdir(parents=True, exist_ok=True)
    (paths.logs_dir / eng.PID_NAME).write_text(json.dumps([os.getpid()]))
    EngineManager(paths, settings)._kill_stale()
    assert _alive(os.getpid()) if os.name == "nt" else True
