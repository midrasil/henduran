"""Pastas de dados do Henduran.

Por padrão os dados ficam em ``%LOCALAPPDATA%\\Henduran``: fora do repositório e
fora do OneDrive (o motor e os modelos são grandes e não devem ser sincronizados).
A variável ``HENDURAN_DATA_DIR`` troca essa pasta (usada nos testes).

Estrutura::

    <dados>/
        engine/         motor de IA (llama-server) baixado
        models/         modelos .gguf do jogador
        logs/           log do motor
        henduran.db     banco SQLite do app: preferências e metadados (ver ``henduran.db``)
        backups/        cópias do banco feitas antes de cada migração (as 5 últimas)
        settings.json.migrado   arquivo antigo de preferências, já importado para o banco
        journeys/<id>/  uma Jornada (ADR-075): journey.db, journey.lock, assets/, backups/
        worlds/<id>/    um Mundo (ADR-075): world.db, backups/

Os ``<id>`` de Jornadas e Mundos são UUID estritos (ver :func:`validate_id`),
normalizados para minúsculas; qualquer outro texto é recusado antes de virar
caminho, e todo caminho resolvido é conferido como estando dentro da pasta de dados.
"""

from __future__ import annotations

import os
import re
import uuid
from dataclasses import dataclass
from pathlib import Path

DATA_DIR_ENV = "HENDURAN_DATA_DIR"
APP_FOLDER = "Henduran"
_UUID_RE = re.compile(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")


class InvalidIdError(ValueError):
    """Identificador de Jornada ou de Mundo fora do formato UUID."""

    code = "id_invalido"


def validate_id(value: object) -> str:
    """Devolve o UUID em minúsculas (``xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx``) ou levanta :class:`InvalidIdError`.

    Só aceita o formato canônico com hífens (36 caracteres): nada de chaves,
    prefixo ``urn:``, espaços, separadores de pasta, ``..`` ou nomes reservados.
    """
    if not isinstance(value, str) or len(value) != 36 or not _UUID_RE.fullmatch(value):
        raise InvalidIdError("Identificador inválido: deve ser um UUID.")
    try:
        normalized = str(uuid.UUID(value))
    except ValueError as exc:
        raise InvalidIdError("Identificador inválido: deve ser um UUID.") from exc
    if normalized != value.lower():
        raise InvalidIdError("Identificador inválido: deve ser um UUID.")
    return normalized


def new_id() -> str:
    """UUID novo (versão 4), em minúsculas."""
    return str(uuid.uuid4())


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
        """``settings.json`` legado: só lido uma vez, para importar ao banco."""
        return self.root / "settings.json"

    @property
    def database_file(self) -> Path:
        return self.root / "henduran.db"

    @property
    def backups_dir(self) -> Path:
        return self.root / "backups"

    # ------------------------------------------------------- Jornadas e Mundos
    def _inside(self, path: Path) -> Path:
        """Confere que ``path`` resolvido fica dentro da pasta de dados."""
        root = self.root.resolve()
        resolved = path.resolve()
        if resolved != root and not resolved.is_relative_to(root):
            raise InvalidIdError("Caminho fora da pasta de dados.")
        return path

    @property
    def journeys_dir(self) -> Path:
        return self._inside(self.root / "journeys")

    @property
    def worlds_dir(self) -> Path:
        return self._inside(self.root / "worlds")

    def journey_dir(self, journey_id: str) -> Path:
        return self._inside(self.root / "journeys" / validate_id(journey_id))

    def journey_db_file(self, journey_id: str) -> Path:
        return self._inside(self.journey_dir(journey_id) / "journey.db")

    def journey_backups_dir(self, journey_id: str) -> Path:
        return self._inside(self.journey_dir(journey_id) / "backups")

    def journey_assets_dir(self, journey_id: str) -> Path:
        return self._inside(self.journey_dir(journey_id) / "assets")

    def journey_lock_file(self, journey_id: str) -> Path:
        return self._inside(self.journey_dir(journey_id) / "journey.lock")

    def world_dir(self, world_id: str) -> Path:
        return self._inside(self.root / "worlds" / validate_id(world_id))

    def world_db_file(self, world_id: str) -> Path:
        return self._inside(self.world_dir(world_id) / "world.db")

    def world_backups_dir(self, world_id: str) -> Path:
        return self._inside(self.world_dir(world_id) / "backups")

    def ensure(self) -> DataPaths:
        """Cria as pastas que ainda não existem."""
        for folder in (self.root, self.engine_dir, self.models_dir, self.logs_dir):
            folder.mkdir(parents=True, exist_ok=True)
        return self
