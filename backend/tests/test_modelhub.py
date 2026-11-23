"""Gerenciador de modelos do Hugging Face (``henduran.ai.modelhub``), sem rede."""

from __future__ import annotations

import asyncio
import os
import shutil
from collections import namedtuple
from pathlib import Path

import httpx
import pytest

from henduran.ai.engine import EngineManager, folder_prefix, quant_of
from henduran.ai.modelhub import (
    HubClient,
    HubError,
    ModelHub,
    check_url,
    group_gguf_files,
    inside,
    validate_repo,
    validate_repo_file,
)
from henduran.paths import DataPaths

from .conftest import open_settings
from .fake_hub import BLOB, PART1, PART2, FakeHub, sha

REPO = "autor/Repo-GGUF"
Usage = namedtuple("Usage", "total used free")


@pytest.fixture
def paths(tmp_path) -> DataPaths:
    return DataPaths(tmp_path / "dados").ensure()


@pytest.fixture
def fake() -> FakeHub:
    return FakeHub()


def make_hub(paths: DataPaths, fake: FakeHub, free: int = 10**12) -> ModelHub:
    settings = open_settings(paths)
    engine = EngineManager(paths, settings)
    return ModelHub(paths, settings, engine=engine, client=HubClient(fake.transport()),
                    disk_usage=lambda _p: Usage(free * 2, free, free))


@pytest.fixture
def hub(paths, fake) -> ModelHub:
    return make_hub(paths, fake)


async def finish(hub: ModelHub, item) -> None:
    await asyncio.wait_for(item.task, 10)


def model_dir(paths: DataPaths) -> Path:
    return paths.models_dir / "autor" / "Repo-GGUF"


# ------------------------------------------------------------------ busca
async def test_busca_filtra_e_le_licenca(hub, fake):
    results = await hub.search("  qwen 0.5b ")
    assert [r["id"] for r in results] == ["autor/Repo-GGUF", "fechado/Restrito-GGUF"]
    first, gated = results
    assert first == {
        "id": "autor/Repo-GGUF", "author": "autor", "name": "Repo-GGUF", "downloads": 1234, "likes": 5,
        "license": "apache-2.0", "gated": False, "restricted": False, "updated": "2026-01-01T00:00:00.000Z",
    }
    assert gated["license"] is None and gated["restricted"] is True
    params = fake.requests[0].url.params
    assert params["search"] == "qwen 0.5b"
    assert params["filter"] == "gguf" and params["sort"] == "downloads" and params["direction"] == "-1"
    assert "gated" in params.get_list("expand[]")
    assert fake.requests[0].url.host == "huggingface.co"


async def test_busca_vazia_e_limite(hub, fake):
    fake.search_rows = []
    assert await hub.search("", limit=500) == []
    params = fake.requests[0].url.params
    assert "search" not in params and params["limit"] == "50"


async def test_busca_limite_de_requisicoes(hub, fake):
    fake.status_override = 429
    with pytest.raises(HubError) as err:
        await hub.search("x")
    assert err.value.code == "limite_requisicoes"
    assert "120 s" in str(err.value)


async def test_busca_sem_rede(paths):
    def boom(request):
        raise httpx.ConnectError("sem rede")

    hub = ModelHub(paths, open_settings(paths), client=HubClient(httpx.MockTransport(boom)))
    with pytest.raises(HubError) as err:
        await hub.search("x")
    assert err.value.code == "rede"


# ------------------------------------------------------------------ arquivos
@pytest.mark.parametrize("name,quant", [
    ("qwen2.5-0.5b-instruct-q4_k_m.gguf", "Q4_K_M"), ("Modelo.IQ3_XS.gguf", "IQ3_XS"),
    ("x-Q6_K.gguf", "Q6_K"), ("x-BF16.gguf", "BF16"), ("x-f16.gguf", "F16"), ("x-Q8_0-00001-of-00003.gguf", "Q8_0"),
    ("sem-quant.gguf", None),
])
def test_quantizacao_pelo_nome(name, quant):
    assert quant_of(name) == quant


def test_agrupa_partes_e_ignora_mmproj():
    tree = [
        {"type": "file", "path": "a/M-Q8_0-00002-of-00002.gguf", "size": 2, "lfs": {"oid": "b" * 64, "size": 2}},
        {"type": "file", "path": "a/M-Q8_0-00001-of-00002.gguf", "size": 3, "lfs": {"oid": "a" * 64, "size": 3}},
        {"type": "file", "path": "Solo-Q4_K_M.gguf", "size": 1, "lfs": {"oid": "*" * 64, "size": 1}},
        {"type": "file", "path": "mmproj-model-f16.gguf", "size": 9},
        {"type": "file", "path": "Falta-00002-of-00003.gguf", "size": 9},
        {"type": "file", "path": "../fora.gguf", "size": 9},
        {"type": "file", "path": "leia.md", "size": 9},
    ]
    files = group_gguf_files(tree)
    names = [f["name"] for f in files]
    assert names == ["Solo-Q4_K_M.gguf", "M-Q8_0.gguf", "Falta.gguf"]
    solo, split, missing = files
    assert solo["verifiable"] is False and solo["parts"][0]["sha256"] is None  # hash mascarado
    assert split["size_bytes"] == 5 and split["file"] == "a/M-Q8_0-00001-of-00002.gguf"
    assert [p["path"] for p in split["parts"]] == ["a/M-Q8_0-00001-of-00002.gguf", "a/M-Q8_0-00002-of-00002.gguf"]
    assert split["quant"] == "Q8_0" and split["verifiable"] is True and split["complete"] is True
    assert missing["complete"] is False


async def test_arquivos_do_repositorio(hub, fake):
    detail = await hub.repo_files(REPO)
    assert detail["license"] == "apache-2.0" and detail["restricted"] is False
    assert detail["revision"] == "a" * 40
    assert [f["name"] for f in detail["files"]] == ["Grande-Q8_0.gguf", "Modelo-Q4_K_M.gguf"]
    assert detail["files"][0]["size_bytes"] == len(PART1) + len(PART2)
    tree_req = [r for r in fake.requests if "/tree/" in r.url.path][0]
    assert tree_req.url.path.endswith("/tree/" + "a" * 40)


async def test_arvore_paginada_pelo_link(hub, fake):
    fake.tree_page_size = 2
    detail = await hub.repo_files(REPO)
    assert len(detail["files"]) == 2
    assert sum(1 for r in fake.requests if "/tree/" in r.url.path) == 3  # 6 entradas, 2 por página


async def test_repositorio_privado_ou_inexistente(hub, fake):
    fake.private = True
    with pytest.raises(HubError) as err:
        await hub.repo_files(REPO)
    assert err.value.code == "restrito"


# ------------------------------------------------------------------ validação
@pytest.mark.parametrize("repo", [
    "../x", "a/b/c", "a", "a/..", "a/CON", "nul/b", "a\\b/c", "a/ b", ".a/b", "a/b.", "a/b..c", "", None, "a/" + "b" * 97,
])
def test_repo_malicioso(repo):
    with pytest.raises(HubError) as err:
        validate_repo(repo)
    assert err.value.code == "repo_invalido"


@pytest.mark.parametrize("name", [
    "../x.gguf", "x.exe", "a\\b.gguf", "CON.gguf", "nul.gguf", "com1.Q4.gguf", "x/../y.gguf", "/abs.gguf",
    "C:x.gguf", "a/b/c/d/e.gguf", "x.gguf.part", "", "x .gguf", "x.gguf ",
])
def test_arquivo_malicioso(name):
    with pytest.raises(HubError) as err:
        validate_repo_file(name)
    assert err.value.code == "arquivo_invalido"


def test_arquivo_valido_devolve_nome_local():
    assert validate_repo_file("Q8_0/M-Q8_0-00001-of-00002.gguf") == "M-Q8_0-00001-of-00002.gguf"


@pytest.mark.parametrize("url,api,ok", [
    ("https://huggingface.co/api/models", True, True),
    ("https://cdn-lfs.hf.co/x", True, False),
    ("https://cdn-lfs.hf.co/x", False, True),
    ("https://us.aws.cdn.hf.co/x", False, True),
    ("https://cas-bridge.xethub.hf.co/x", False, True),
    ("http://cdn-lfs.hf.co/x", False, False),
    ("https://evil.example/x", False, False),
    ("https://huggingface.co.evil.com/x", False, False),
    ("https://hf.co.evil.com/x", False, False),
    ("https://user:senha@huggingface.co/x", False, False),
    ("https://huggingface.co:8443/x", False, False),
])
def test_check_url(url, api, ok):
    if ok:
        check_url(httpx.URL(url), api=api)
    else:
        with pytest.raises(HubError):
            check_url(httpx.URL(url), api=api)


# ------------------------------------------------------------------ download
async def test_download_completo_com_sha256(hub, paths, fake):
    item = await hub.start(REPO, "Modelo-Q4_K_M.gguf")
    await finish(hub, item)
    assert item.state == "done", item.error_message
    final = model_dir(paths) / "Modelo-Q4_K_M.gguf"
    assert final.read_bytes() == BLOB
    assert not (model_dir(paths) / "Modelo-Q4_K_M.gguf.part").exists()
    assert item.verified is True and item.warning is None
    assert item.model_id == "autor/Repo-GGUF/Modelo-Q4_K_M.gguf"
    assert item.done_bytes == item.total_bytes == len(BLOB)
    assert [m["id"] for m in hub.engine.models()] == [item.model_id]
    resolve = [r for r in fake.requests if "/resolve/" in r.url.path][0]
    assert resolve.url.path == f"/{REPO}/resolve/{'a' * 40}/Modelo-Q4_K_M.gguf"
    log = (paths.logs_dir / "models.log").read_text(encoding="utf-8")
    assert "SHA-256 conferido" in log
    assert hub.list_downloads()[0]["state"] == "done"


async def test_download_dividido_e_remocao_de_todas_as_partes(hub, paths):
    item = await hub.start(REPO, "big/Grande-Q8_0-00001-of-00002.gguf")
    await finish(hub, item)
    assert item.state == "done", item.error_message
    folder = model_dir(paths)
    assert (folder / "Grande-Q8_0-00001-of-00002.gguf").read_bytes() == PART1
    assert (folder / "Grande-Q8_0-00002-of-00002.gguf").read_bytes() == PART2
    models = hub.engine.models()
    assert len(models) == 1 and models[0]["parts"] == 2 and models[0]["complete"]
    hub.settings.update(active_model=models[0]["id"])
    out = await hub.remove_model(models[0]["id"])
    assert out["files"] == 2
    assert not (paths.models_dir / "autor").exists()  # pastas vazias arrumadas
    assert paths.models_dir.is_dir()
    assert hub.settings.get("active_model") is None


async def test_hash_divergente_descarta(hub, paths, fake):
    fake.published_sha["Modelo-Q4_K_M.gguf"] = sha(b"outro conteudo")
    item = await hub.start(REPO, "Modelo-Q4_K_M.gguf")
    await finish(hub, item)
    assert item.state == "error" and item.error_code == "hash_divergente"
    assert not (model_dir(paths) / "Modelo-Q4_K_M.gguf").exists()
    assert not (model_dir(paths) / "Modelo-Q4_K_M.gguf.part").exists()
    assert "divergente" in (paths.logs_dir / "models.log").read_text(encoding="utf-8")


async def test_sem_hash_avisa_e_nao_finge_verificacao(hub, paths, fake):
    fake.published_sha["Modelo-Q4_K_M.gguf"] = None
    item = await hub.start(REPO, "Modelo-Q4_K_M.gguf")
    await finish(hub, item)
    assert item.state == "done"
    assert item.verified is False and "SHA-256" in item.warning
    assert hub.list_downloads()[0]["verified"] is False
    assert "NÃO verificado" in (paths.logs_dir / "models.log").read_text(encoding="utf-8")


async def test_retoma_com_range_apos_queda(hub, paths, fake):
    fake.fail_after["Modelo-Q4_K_M.gguf"] = 4000
    item = await hub.start(REPO, "Modelo-Q4_K_M.gguf")
    await finish(hub, item)
    assert item.state == "error" and item.error_code == "rede"
    part = model_dir(paths) / "Modelo-Q4_K_M.gguf.part"
    assert part.stat().st_size == 4000
    again = await hub.retry(item.id)
    assert again.id == item.id
    await finish(hub, again)
    assert again.state == "done", again.error_message
    assert (model_dir(paths) / "Modelo-Q4_K_M.gguf").read_bytes() == BLOB
    assert fake.range_headers() == [None, "bytes=4000-"]


async def test_servidor_sem_range_recomeca(hub, paths, fake):
    folder = model_dir(paths)
    folder.mkdir(parents=True)
    (folder / "Modelo-Q4_K_M.gguf.part").write_bytes(b"lixo" * 100)
    fake.ignore_range = True
    item = await hub.start(REPO, "Modelo-Q4_K_M.gguf")
    await finish(hub, item)
    assert item.state == "done", item.error_message
    assert (folder / "Modelo-Q4_K_M.gguf").read_bytes() == BLOB


async def test_part_de_execucao_anterior_reaparece_e_retoma(paths, fake):
    folder = model_dir(paths)
    folder.mkdir(parents=True)
    (folder / "Modelo-Q4_K_M.gguf.part").write_bytes(BLOB[:3000])
    hub = make_hub(paths, fake)  # como se o app tivesse sido reaberto
    listed = hub.list_downloads()
    assert len(listed) == 1
    assert listed[0]["state"] == "interrupted" and listed[0]["done_bytes"] == 3000
    assert listed[0]["repo"] == REPO and listed[0]["file"] == "Modelo-Q4_K_M.gguf"
    item = await hub.retry(listed[0]["id"])
    await finish(hub, item)
    assert item.state == "done", item.error_message
    assert fake.range_headers() == ["bytes=3000-"]
    assert len(hub.list_downloads()) == 1


async def test_cancelar_e_limpar(hub, paths, fake):
    fake.slow = True
    item = await hub.start(REPO, "Modelo-Q4_K_M.gguf")
    for _ in range(100):
        if item.done_bytes:
            break
        await asyncio.sleep(0.02)
    assert item.state == "downloading" and item.done_bytes > 0
    with pytest.raises(HubError) as err:
        hub.forget(item.id)
    assert err.value.code == "ocupado"
    await hub.cancel(item.id)
    assert item.state == "cancelled"
    part = model_dir(paths) / "Modelo-Q4_K_M.gguf.part"
    assert part.exists()
    hub.forget(item.id)
    assert not part.exists()
    assert hub.list_downloads() == []


async def test_um_download_por_vez(hub, fake):
    fake.slow = True
    item = await hub.start(REPO, "Modelo-Q4_K_M.gguf")
    assert (await hub.start(REPO, "Modelo-Q4_K_M.gguf")) is item
    with pytest.raises(HubError) as err:
        await hub.start(REPO, "big/Grande-Q8_0-00001-of-00002.gguf")
    assert err.value.code == "ocupado"
    await hub.cancel(item.id)


async def test_sem_espaco(paths, fake):
    hub = make_hub(paths, fake, free=1000)
    with pytest.raises(HubError) as err:
        await hub.start(REPO, "Modelo-Q4_K_M.gguf")
    assert err.value.code == "sem_espaco" and "GB" in str(err.value)
    assert hub.list_downloads() == []


async def test_repositorio_restrito_recusado(hub, fake):
    fake.gated = "auto"
    with pytest.raises(HubError) as err:
        await hub.start(REPO, "Modelo-Q4_K_M.gguf")
    assert err.value.code == "restrito"
    assert not any("/resolve/" in r.url.path for r in fake.requests)


async def test_arquivo_ausente_no_repositorio(hub):
    with pytest.raises(HubError) as err:
        await hub.start(REPO, "Outro-Q2_K.gguf")
    assert err.value.code == "arquivo_nao_encontrado"


@pytest.mark.parametrize("location", [
    "http://cdn-lfs.hf.co/blob/Modelo-Q4_K_M.gguf",
    "https://evil.example/blob/Modelo-Q4_K_M.gguf",
    "https://huggingface.co.evil.com/blob/Modelo-Q4_K_M.gguf",
])
async def test_redirecionamento_inesperado_recusado(hub, paths, fake, location):
    fake.resolve_location = location
    item = await hub.start(REPO, "Modelo-Q4_K_M.gguf")
    await finish(hub, item)
    assert item.state == "error" and item.error_code == "destino_inesperado"
    assert not any(r.url.host != "huggingface.co" for r in fake.requests)
    assert not (model_dir(paths) / "Modelo-Q4_K_M.gguf").exists()


async def test_arquivo_existente_diferente_e_conflito(hub, paths):
    folder = model_dir(paths)
    folder.mkdir(parents=True)
    (folder / "Modelo-Q4_K_M.gguf").write_bytes(b"outro")
    with pytest.raises(HubError) as err:
        await hub.start(REPO, "Modelo-Q4_K_M.gguf")
    assert err.value.code == "conflito"


def _junction(target: Path, link: Path) -> None:
    if os.name != "nt":
        pytest.skip("junções só existem no Windows")
    import _winapi  # noqa: PLC0415

    link.parent.mkdir(parents=True, exist_ok=True)
    _winapi.CreateJunction(str(target), str(link))


async def test_juncao_que_escapa_e_recusada(hub, paths, tmp_path):
    outside = tmp_path / "fora"
    outside.mkdir()
    _junction(outside, paths.models_dir / "autor" / "Repo-GGUF")
    with pytest.raises(HubError) as err:
        await hub.start(REPO, "Modelo-Q4_K_M.gguf")
    assert err.value.code == "fora_das_pastas"
    assert list(outside.iterdir()) == []


async def test_juncao_dentro_da_pasta_tambem_e_recusada(hub, paths):
    real = paths.models_dir / "real"
    real.mkdir()
    _junction(real, paths.models_dir / "autor" / "Repo-GGUF")
    assert not inside(paths.models_dir / "autor" / "Repo-GGUF" / "x.gguf", paths.models_dir)
    with pytest.raises(HubError) as err:
        await hub.start(REPO, "Modelo-Q4_K_M.gguf")
    assert err.value.code == "fora_das_pastas"


def test_link_simbolico_fora_e_recusado(paths, tmp_path):
    target = tmp_path / "alvo.gguf"
    target.write_bytes(b"x")
    link = paths.models_dir / "link.gguf"
    try:
        os.symlink(target, link)
    except OSError:
        pytest.skip("sem permissão para criar links simbólicos neste Windows")
    assert not inside(link, paths.models_dir)


# ------------------------------------------------------------------ remoção
async def test_remover_modelo_inexistente(hub):
    with pytest.raises(HubError) as err:
        await hub.remove_model("autor/nada.gguf")
    assert err.value.code == "model_not_found"


async def test_remocao_recusa_arquivo_por_juncao(hub, paths, tmp_path):
    outside = tmp_path / "fora"
    outside.mkdir()
    (outside / "Vitima-Q4_K_M.gguf").write_bytes(b"importante")
    _junction(outside, paths.models_dir / "atalho")
    # a varredura já ignora o que resolve para fora; a remoção também não alcança
    assert hub.engine.models() == []
    with pytest.raises(HubError):
        await hub.remove_model("atalho/Vitima-Q4_K_M.gguf")
    assert (outside / "Vitima-Q4_K_M.gguf").exists()


# ------------------------------------------------------------------ pastas extras
def test_pastas_extras(hub, paths, tmp_path):
    other = tmp_path / "lmstudio" / "models"
    (other / "pub").mkdir(parents=True)
    (other / "pub" / "Externo-Q5_K_M.gguf").write_bytes(b"x" * 50)
    assert hub.engine.models() == []
    added = hub.add_folder(f'"{other}"')
    assert added == {"path": str(other.resolve()), "kind": "extra", "exists": True}
    models = hub.engine.models()
    assert [m["name"] for m in models] == ["Externo-Q5_K_M.gguf"]
    assert models[0]["source"] == "extra"
    assert models[0]["id"] == folder_prefix(str(other.resolve())) + "pub/Externo-Q5_K_M.gguf"
    assert not any(paths.models_dir.rglob("*.gguf"))  # nada copiado
    assert [f["kind"] for f in hub.folders()] == ["app", "extra"]
    assert open_settings(paths).get("model_folders") == [str(other.resolve())]
    with pytest.raises(HubError) as err:
        hub.add_folder(str(other))
    assert err.value.code == "pasta_sobreposta"
    with pytest.raises(HubError) as err:
        hub.add_folder(str(other / "pub"))
    assert err.value.code == "pasta_sobreposta"


async def test_remover_de_pasta_extra_e_recusado(hub, tmp_path):
    other = tmp_path / "ext"
    other.mkdir()
    (other / "E-Q4_K_M.gguf").write_bytes(b"x")
    hub.add_folder(str(other))
    model = hub.engine.models()[0]
    with pytest.raises(HubError) as err:
        await hub.remove_model(model["id"])
    assert err.value.code == "pasta_externa"
    assert (other / "E-Q4_K_M.gguf").exists()


async def test_tirar_pasta_da_lista_nao_apaga_nada(hub, tmp_path):
    other = tmp_path / "ext"
    other.mkdir()
    (other / "E-Q4_K_M.gguf").write_bytes(b"x")
    hub.add_folder(str(other))
    hub.settings.update(active_model=hub.engine.models()[0]["id"])
    await hub.remove_folder(str(other))
    assert hub.engine.models() == []
    assert (other / "E-Q4_K_M.gguf").exists()
    assert hub.settings.get("active_model") is None
    with pytest.raises(HubError) as err:
        await hub.remove_folder(str(other))
    assert err.value.code == "pasta_desconhecida"


@pytest.mark.parametrize("value,code", [
    ("", "pasta_invalida"), ("relativa\\pasta", "pasta_invalida"), ("C:\\", "pasta_invalida"),
])
def test_pastas_invalidas(hub, value, code):
    with pytest.raises(HubError) as err:
        hub.add_folder(value)
    assert err.value.code == code


def test_pasta_inexistente_arquivo_e_sobreposta(hub, paths, tmp_path):
    with pytest.raises(HubError) as err:
        hub.add_folder(str(tmp_path / "nao-existe"))
    assert err.value.code == "pasta_inexistente"
    f = tmp_path / "arquivo.txt"
    f.write_text("x")
    with pytest.raises(HubError) as err:
        hub.add_folder(str(f))
    assert err.value.code == "pasta_invalida"
    with pytest.raises(HubError) as err:
        hub.add_folder(str(paths.models_dir))
    assert err.value.code == "pasta_sobreposta"
    with pytest.raises(HubError) as err:
        hub.add_folder(str(Path.home()))
    assert err.value.code == "pasta_invalida"


def test_pasta_extra_apagada_some_sem_erro(hub, tmp_path):
    other = tmp_path / "ext"
    other.mkdir()
    hub.add_folder(str(other))
    shutil.rmtree(other)
    assert hub.engine.models() == []
    assert hub.folders()[1]["exists"] is False
