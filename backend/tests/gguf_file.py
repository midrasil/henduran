"""Gera cabeçalhos ``.gguf`` mínimos para os testes (só metadados, sem tensores)."""

from __future__ import annotations

import struct
from pathlib import Path
from typing import Any

U32, I32, F32, BOOL, STRING, ARRAY, U64 = 4, 5, 6, 7, 8, 9, 10


def _string(text: str) -> bytes:
    raw = text.encode("utf-8")
    return struct.pack("<Q", len(raw)) + raw


def _value(kind: int, value: Any) -> bytes:
    if kind == U32:
        return struct.pack("<I", value)
    if kind == I32:
        return struct.pack("<i", value)
    if kind == F32:
        return struct.pack("<f", value)
    if kind == BOOL:
        return struct.pack("<?", value)
    if kind == U64:
        return struct.pack("<Q", value)
    if kind == STRING:
        return _string(value)
    if kind == ARRAY:
        item, items = value
        return struct.pack("<IQ", item, len(items)) + b"".join(_value(item, v) for v in items)
    raise ValueError(kind)


def write_gguf(path: Path, pairs: list[tuple[str, int, Any]], *, version: int = 3, tail: bytes = b"") -> Path:
    body = b"".join(_string(k) + struct.pack("<I", t) + _value(t, v) for k, t, v in pairs)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b"GGUF" + struct.pack("<IQQ", version, 0, len(pairs)) + body + tail)
    return path


def llama_like(path: Path, *, blocks: int = 32, embd: int = 4096, heads: int = 32, heads_kv: int = 8,
               size: int = 0) -> Path:
    """Cabeçalho parecido com o de um Llama 8B (com um vocabulário de strings para pular)."""
    write_gguf(path, [
        ("general.architecture", STRING, "llama"),
        ("general.name", STRING, "Teste"),
        ("llama.context_length", U32, 8192),
        ("llama.embedding_length", U32, embd),
        ("llama.block_count", U32, blocks),
        ("llama.attention.head_count", U32, heads),
        ("llama.attention.head_count_kv", U32, heads_kv),
        ("tokenizer.ggml.tokens", ARRAY, (STRING, [f"tok{i}" for i in range(50)])),
    ])
    if size:
        with open(path, "ab") as fh:
            fh.write(b"\0" * max(0, size - path.stat().st_size))
    return path
