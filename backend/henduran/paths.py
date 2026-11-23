"""Pastas de dados do Henduran.

Por padrão os dados ficam em ``%LOCALAPPDATA%\\Henduran``: fora do repositório e
fora do OneDrive (o motor e os modelos são grandes e não devem ser sincronizados).
A variável ``HENDURAN_DATA_DIR`` troca essa pasta (usada nos testes).

Estrutura::

    <dados>/
        engine/         motor de IA (llama-server) baixado
        models/         modelos .gguf do jogador
        logs/           log do motor
        settings.json   preferências provisórias (ver ``henduran.settings``)
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

DATA_DIR_ENV = "HENDURAN_DATA_DIR"
APP_FOLDER = "Henduran"


def default_data_dir() -> Path:
    """``HENDURAN_DATA_DIR`` se definida; senão ``%LOCALAPPDATA%\\Henduran``."""
    override = os.environ.get(DATA_DIR_ENV, "").strip()
    if override:
        return Path(override).expanduser()
    local = os.environ.get("LOCALAPPDATA", "").strip()
    base = Path(local) if local else Path.home() / "AppData" / "Local"
    return base / APP_FOLDER


@dataclass(frozen=True)
class DataPaths:
    root: Path

    @classmethod
    def from_env(cls) -> DataPaths:
        return cls(default_data_dir())

    @property
    def engine_dir(self) -> Path:
        return self.root / "engine"

    @property
    def models_dir(self) -> Path:
        return self.root / "models"

    @property
    def logs_dir(self) -> Path:
        return self.root / "logs"

    @property
    def settings_file(self) -> Path:
        return self.root / "settings.json"

    def ensure(self) -> DataPaths:
        """Cria as pastas que ainda não existem."""
        for folder in (self.root, self.engine_dir, self.models_dir, self.logs_dir):
            folder.mkdir(parents=True, exist_ok=True)
        return self
