"""Leitura mínima do cabeçalho de um arquivo ``.gguf``: só os metadados de arquitetura.

Serve à estimativa de memória de vídeo da tela Modelos (número de camadas e
tamanho do cache de contexto). Lê apenas o cabeçalho (chave/valor), nunca os
tensores, e para assim que encontra o que precisa. Formato do GGUF (versões 2 e
3): ``GGUF``, versão ``uint32``, número de tensores e de pares ``uint64``, e os
pares ``chave`` (texto) + tipo ``uint32`` + valor. Arquivo inválido, truncado ou
com tamanhos absurdos devolve ``None`` (nunca levanta).
"""

from __future__ import annotations

import logging
import struct
from pathlib import Path
from typing import Any, BinaryIO

log = logging.getLogger("henduran.gguf")

MAGIC = b"GGUF"
MAX_KV = 100_000
MAX_STRING = 1 << 20  # chaves e textos lidos; textos maiores são pulados
MAX_ARRAY_READ = 4096  # arrays numéricos lidos (por exemplo ``head_count_kv`` por camada)
MAX_HEADER_BYTES = 256 * 2**20

# tipo -> (formato struct, tamanho)
_SCALARS = {
    0: ("<B", 1), 1: ("<b", 1), 2: ("<H", 2), 3: ("<h", 2), 4: ("<I", 4), 5: ("<i", 4),
    6: ("<f", 4), 7: ("<?", 1), 10: ("<Q", 8), 11: ("<q", 8), 12: ("<d", 8),
}
_STRING = 8
_ARRAY = 9

ARCH_KEYS = (
    "block_count", "context_length", "embedding_length",
    "attention.head_count", "attention.head_count_kv",
    "attention.key_length", "attention.value_length",
)


class _Bad(Exception):
    pass


def _read(fh: BinaryIO, n: int) -> bytes:
    data = fh.read(n)
    if len(data) != n:
        raise _Bad("arquivo truncado")
    if fh.tell() > MAX_HEADER_BYTES:
        raise _Bad("cabeçalho grande demais")
    return data


def _u32(fh: BinaryIO) -> int:
    return struct.unpack("<I", _read(fh, 4))[0]


def _u64(fh: BinaryIO) -> int:
    return struct.unpack("<Q", _read(fh, 8))[0]


def _string(fh: BinaryIO, keep: bool = True) -> str | None:
    size = _u64(fh)
    if size > MAX_STRING:
        if size > MAX_HEADER_BYTES:
            raise _Bad("texto grande demais")
        fh.seek(size, 1)
        return None
    raw = _read(fh, size)
    return raw.decode("utf-8", "replace") if keep else None


def _value(fh: BinaryIO, kind: int, keep: bool) -> Any:
    if kind in _SCALARS:
        fmt, size = _SCALARS[kind]
        raw = _read(fh, size)
        return struct.unpack(fmt, raw)[0] if keep else None
    if kind == _STRING:
        return _string(fh, keep)
    if kind == _ARRAY:
        item = _u32(fh)
        count = _u64(fh)
        if item in _SCALARS:
            size = _SCALARS[item][1]
            if keep and count <= MAX_ARRAY_READ:
                return [struct.unpack(_SCALARS[item][0], _read(fh, size))[0] for _ in range(count)]
            if count * size > MAX_HEADER_BYTES:
                raise _Bad("array grande demais")
            fh.seek(count * size, 1)
            _read(fh, 0)
            return None
        if item == _STRING:
            for _ in range(count):
                _string(fh, keep=False)
            return None
        raise _Bad(f"array de tipo {item} não suportado")
    raise _Bad(f"tipo {kind} desconhecido")


def read_metadata(path: str | Path) -> dict[str, Any] | None:
    """Metadados de arquitetura do ``.gguf``: ``architecture`` e as chaves de ``ARCH_KEYS``.

    Devolve ``{"architecture": str, "block_count": int, "head_count": int, ...}``
    (nomes sem o prefixo ``attention.``) com as chaves encontradas, ou ``None`` se
    o arquivo não for um GGUF legível.
    """
    try:
        with open(path, "rb") as fh:
            if _read(fh, 4) != MAGIC:
                return None
            version = _u32(fh)
            if version < 2:
                return None  # GGUF v1 (contagens em 32 bits) não é mais gerado
            _u64(fh)  # número de tensores
            kv_count = _u64(fh)
            if kv_count > MAX_KV:
                return None
            arch: str | None = None
            found: dict[str, Any] = {}
            for _ in range(kv_count):
                key = _string(fh) or ""
                kind = _u32(fh)
                wanted = key == "general.architecture" or (
                    arch is not None and key.startswith(arch + ".") and key[len(arch) + 1:] in ARCH_KEYS
                ) or (arch is None and "." in key and key.split(".", 1)[1] in ARCH_KEYS)
                value = _value(fh, kind, keep=wanted)
                if not wanted:
                    continue
                if key == "general.architecture":
                    arch = value if isinstance(value, str) else None
                    # chaves de arquitetura lidas antes do nome (ordem incomum): filtra pelo prefixo
                    found = {k: v for k, v in found.items() if arch and k.startswith(arch + ".")}
                    continue
                found[key] = value
                if arch and all(f"{arch}.{k}" in found for k in ARCH_KEYS):
                    break
    except (OSError, _Bad, struct.error, OverflowError, ValueError) as exc:
        log.info("cabeçalho GGUF ilegível em %s: %s", path, exc)
        return None
    if not arch:
        return None
    out: dict[str, Any] = {"architecture": arch}
    for name in ARCH_KEYS:
        value = found.get(f"{arch}.{name}")
        if isinstance(value, list):
            # alguns modelos guardam ``head_count_kv`` por camada: vale a maior
            numbers = [v for v in value if isinstance(v, int) and not isinstance(v, bool)]
            value = max(numbers) if numbers else None
        if isinstance(value, int) and not isinstance(value, bool) and value > 0:
            out[name.rsplit(".", 1)[-1]] = value  # ``attention.head_count`` vira ``head_count``
    return out


__all__ = ["read_metadata", "ARCH_KEYS"]
