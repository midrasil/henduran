"""Preferências mínimas do serviço em ``settings.json``.

**Provisório:** existe só até a persistência SQLite do projeto (ADR-050) ser
implementada; depois estes valores migram para o banco.

Guarda apenas:

- ``active_model``: id do modelo ``.gguf`` escolhido pelo jogador (ou ``None``);
- ``context_size``: tamanho de contexto por conversa, em tokens (padrão 4096);
- ``engine_variant``: variante do motor baixado (``vulkan`` ou ``cpu``).

A leitura tolera arquivo ausente ou corrompido (volta aos padrões) e a escrita
é atômica: grava num arquivo temporário na mesma pasta e troca pelo nome final.
"""

from __future__ import annotations

import json
import logging
import os
import tempfile
import threading
from pathlib import Path
from typing import Any

log = logging.getLogger("henduran.settings")

ENGINE_VARIANTS = ("vulkan", "cpu")
DEFAULTS: dict[str, Any] = {
    "active_model": None,
    "context_size": 4096,
    "engine_variant": "vulkan",
}
CONTEXT_MIN = 512
CONTEXT_MAX = 131072


def _validate(key: str, value: Any) -> Any:
    if key == "active_model":
        if value is None or (isinstance(value, str) and value.strip()):
            return value
        raise ValueError("active_model deve ser texto não vazio ou nulo")
    if key == "context_size":
        if isinstance(value, bool) or not isinstance(value, int):
            raise ValueError("context_size deve ser inteiro")
        if not CONTEXT_MIN <= value <= CONTEXT_MAX:
            raise ValueError(f"context_size fora do intervalo {CONTEXT_MIN}–{CONTEXT_MAX}")
        return value
    if key == "engine_variant":
        if value not in ENGINE_VARIANTS:
            raise ValueError(f"engine_variant deve ser um de {ENGINE_VARIANTS}")
        return value
    raise KeyError(f"preferência desconhecida: {key}")


def atomic_write_text(path: Path, text: str) -> None:
    """Grava ``text`` em ``path`` de forma atômica (temporário + rename)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(text)
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(tmp_name, path)
    except BaseException:
        try:
            os.unlink(tmp_name)
        except OSError:
            pass
        raise


class SettingsStore:
    """Leitura e escrita de ``settings.json``, seguras entre threads."""

    def __init__(self, path: Path) -> None:
        self.path = path
        self._lock = threading.Lock()
        self._data = self._load()

    def _load(self) -> dict[str, Any]:
        data = dict(DEFAULTS)
        try:
            raw = json.loads(self.path.read_text(encoding="utf-8"))
        except FileNotFoundError:
            return data
        except (OSError, ValueError) as exc:
            log.warning("settings.json ilegível (%s); usando os padrões", exc)
            return data
        if not isinstance(raw, dict):
            log.warning("settings.json não contém um objeto; usando os padrões")
            return data
        for key in DEFAULTS:
            if key in raw:
                try:
                    data[key] = _validate(key, raw[key])
                except (ValueError, KeyError):
                    log.warning("valor inválido para %s em settings.json; usando o padrão", key)
        return data

    def all(self) -> dict[str, Any]:
        with self._lock:
            return dict(self._data)

    def get(self, key: str) -> Any:
        with self._lock:
            return self._data[key]

    def update(self, **changes: Any) -> dict[str, Any]:
        """Valida, aplica e grava. Valor inválido levanta ``ValueError``/``KeyError``."""
        with self._lock:
            new = dict(self._data)
            for key, value in changes.items():
                new[key] = _validate(key, value)
            atomic_write_text(self.path, json.dumps(new, ensure_ascii=False, indent=2) + "\n")
            self._data = new
            return dict(new)
