"""Leitura do cabeçalho ``.gguf`` (só metadados de arquitetura)."""

from __future__ import annotations

from henduran.ai.gguf import read_metadata

from .gguf_file import ARRAY, I32, STRING, U32, llama_like, write_gguf


def test_le_os_metadados_de_arquitetura(tmp_path):
    meta = read_metadata(llama_like(tmp_path / "m.gguf"))
    assert meta == {
        "architecture": "llama", "block_count": 32, "context_length": 8192, "embedding_length": 4096,
        "head_count": 32, "head_count_kv": 8,
    }


def test_head_count_kv_por_camada_vale_a_maior_e_pula_arrays(tmp_path):
    path = write_gguf(tmp_path / "m.gguf", [
        ("general.architecture", STRING, "gemma3"),
        ("tokenizer.ggml.scores", ARRAY, (I32, list(range(10_000)))),
        ("gemma3.block_count", U32, 26),
        ("gemma3.attention.head_count_kv", ARRAY, (I32, [4, 8, 4])),
        ("gemma3.attention.key_length", U32, 256),
    ])
    meta = read_metadata(path)
    assert meta == {"architecture": "gemma3", "block_count": 26, "head_count_kv": 8, "key_length": 256}


def test_chaves_antes_do_nome_da_arquitetura(tmp_path):
    path = write_gguf(tmp_path / "m.gguf", [
        ("qwen2.block_count", U32, 28),
        ("outra.block_count", U32, 99),
        ("general.architecture", STRING, "qwen2"),
    ])
    assert read_metadata(path) == {"architecture": "qwen2", "block_count": 28}


def test_arquivos_invalidos_devolvem_none(tmp_path):
    assert read_metadata(tmp_path / "nao-existe.gguf") is None
    (tmp_path / "lixo.gguf").write_bytes(b"isto nao e gguf")
    assert read_metadata(tmp_path / "lixo.gguf") is None
    good = llama_like(tmp_path / "bom.gguf").read_bytes()
    (tmp_path / "cortado.gguf").write_bytes(good[:60])
    assert read_metadata(tmp_path / "cortado.gguf") is None
    assert read_metadata(write_gguf(tmp_path / "v1.gguf", [], version=1)) is None
    assert read_metadata(write_gguf(tmp_path / "sem-arq.gguf", [("x.block_count", U32, 3)])) is None


def test_tamanho_absurdo_nao_trava(tmp_path):
    import struct

    raw = b"GGUF" + struct.pack("<IQQ", 3, 0, 1) + struct.pack("<Q", 2**62) + b"abc"
    (tmp_path / "grande.gguf").write_bytes(raw)
    assert read_metadata(tmp_path / "grande.gguf") is None
