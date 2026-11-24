"""Preferências mínimas do serviço, guardadas na tabela ``settings`` do banco do app.

Guarda apenas:

- ``active_model``: id do modelo ``.gguf`` escolhido pelo jogador (ou ``None``);
- ``context_size``: tamanho de contexto por conversa, em tokens (padrão 4096);
- ``engine_variant``: variante do motor baixado (``vulkan`` ou ``cpu``);
- ``model_folders``: pastas extras onde o jogador já tem modelos (por exemplo a
  do LM Studio), varridas junto com a pasta do app. Caminhos absolutos; o app
  nunca copia nem move arquivos dessas pastas;
- ``last_journey_id``: UUID da última Jornada jogada (ou ``None``), usado por
  "Continuar" e pelo céu do menu (ADR-075). O banco do app não guarda catálogo
  de Jornadas; a Jornada em si mora em ``journeys/<id>/journey.db``;
- ``hidden_models``: ids dos modelos que o jogador ocultou da lista (tela
  Modelos); ocultar não apaga nem move nada;
- ``model_options``: ajustes por modelo usados ao carregar o ``llama-server``:
  ``{id: {"context_size": 4096..32768, "gpu_layers": "auto" ou 0..1024}}``.

Cada preferência é uma linha (``key``, ``value`` em JSON, ``updated_at``). Valor
inválido no banco é ignorado com aviso (vale o padrão). As leituras saem de uma
cópia em memória; cada ``update`` grava numa transação e só então troca a cópia.

**Importação única do ``settings.json`` legado:** se o arquivo existir, a tabela
estiver vazia e a importação ainda não tiver sido feita, os valores válidos são
gravados numa transação (os inválidos são descartados com aviso) e o arquivo é
renomeado para ``settings.json.migrado`` (nunca apagado). JSON ausente ou
corrompido não impede o serviço de subir.
"""

from __future__ import annotations

import json
import logging
import os
import tempfile
import threading
from pathlib import Path
from typing import Any

from henduran.db.connection import Database, utc_now_iso
from henduran.paths import InvalidIdError, validate_id

log = logging.getLogger("henduran.settings")

ENGINE_VARIANTS = ("vulkan", "cpu")
DEFAULTS: dict[str, Any] = {
    "active_model": None,
    "context_size": 4096,
    "engine_variant": "vulkan",
    "model_folders": [],
    "last_journey_id": None,
    "hidden_models": [],
    "model_options": {},
}
# Chaves que podem vir do settings.json antigo (anterior ao banco).
LEGACY_KEYS = ("active_model", "context_size", "engine_variant", "model_folders")
MAX_MODEL_FOLDERS = 20
CONTEXT_MIN = 512
CONTEXT_MAX = 131072
# Ajustes por modelo (docs/ui-ux/14-modelos.md: contexto de 4.096 a 32.768 tokens).
MODEL_CONTEXT_MIN = 4096
MODEL_CONTEXT_MAX = 32768
GPU_LAYERS_MAX = 1024
MAX_MODEL_ENTRIES = 1000
MODEL_ID_MAX = 1024
LEGACY_IMPORTED_KEY = "settings_json_imported_at"
MIGRATED_SUFFIX = ".migrado"


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
    if key == "model_folders":
        if not isinstance(value, list) or len(value) > MAX_MODEL_FOLDERS:
            raise ValueError(f"model_folders deve ser uma lista de até {MAX_MODEL_FOLDERS} caminhos")
        out: list[str] = []
        for item in value:
            if not isinstance(item, str) or not item.strip() or "\x00" in item or len(item) > 1024:
                raise ValueError("model_folders deve conter caminhos em texto")
            out.append(item)
        return out
    if key == "last_journey_id":
        if value is None:
            return None
        try:
            return validate_id(value)
        except InvalidIdError as exc:
            raise ValueError("last_journey_id deve ser um UUID ou nulo") from exc
    if key == "hidden_models":
        if not isinstance(value, list) or len(value) > MAX_MODEL_ENTRIES:
            raise ValueError(f"hidden_models deve ser uma lista de até {MAX_MODEL_ENTRIES} ids")
        out_ids: list[str] = []
        for item in value:
            if _model_id(item) not in out_ids:
                out_ids.append(item)
        return out_ids
    if key == "model_options":
        if not isinstance(value, dict) or len(value) > MAX_MODEL_ENTRIES:
            raise ValueError(f"model_options deve ser um objeto com até {MAX_MODEL_ENTRIES} modelos")
        return {_model_id(k): validate_model_options(v) for k, v in value.items()}
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


def _copy(value: Any) -> Any:
    if isinstance(value, list):
        return list(value)
    if isinstance(value, dict):
        return {k: dict(v) if isinstance(v, dict) else v for k, v in value.items()}
    return value


def _model_id(value: Any) -> str:
    if not isinstance(value, str) or not value.strip() or "\x00" in value or len(value) > MODEL_ID_MAX:
        raise ValueError("id de modelo inválido")
    return value


def validate_model_options(value: Any) -> dict[str, Any]:
    """``{"context_size": int, "gpu_layers": "auto" | int}`` de um modelo; levanta ``ValueError``."""
    if not isinstance(value, dict) or set(value) - {"context_size", "gpu_layers"}:
        raise ValueError("ajustes do modelo devem ter só context_size e gpu_layers")
    out: dict[str, Any] = {}
    if "context_size" in value:
        ctx = value["context_size"]
        if isinstance(ctx, bool) or not isinstance(ctx, int) or not MODEL_CONTEXT_MIN <= ctx <= MODEL_CONTEXT_MAX:
            raise ValueError(f"context_size deve ser inteiro de {MODEL_CONTEXT_MIN} a {MODEL_CONTEXT_MAX}")
        out["context_size"] = ctx
    if "gpu_layers" in value:
        layers = value["gpu_layers"]
        if layers != "auto" and (
            isinstance(layers, bool) or not isinstance(layers, int) or not 0 <= layers <= GPU_LAYERS_MAX
        ):
            raise ValueError(f'gpu_layers deve ser "auto" ou inteiro de 0 a {GPU_LAYERS_MAX}')
        out["gpu_layers"] = layers
    return out


def _read_legacy(path: Path) -> dict[str, Any] | None:
    """Conteúdo do ``settings.json`` antigo, ou ``None`` se ausente/ilegível."""
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return None
    except (OSError, ValueError) as exc:
        log.warning("settings.json legado ilegível (%s); nada importado", exc)
        return {}
    if not isinstance(raw, dict):
        log.warning("settings.json legado não contém um objeto; nada importado")
        return {}
    return raw


class SettingsStore:
    """Preferências sobre o banco do app, seguras entre threads."""

    def __init__(self, db: Database, *, legacy_file: Path | None = None) -> None:
        self.db = db
        self.legacy_file = legacy_file
        self._lock = threading.Lock()
        if legacy_file is not None:
            self._import_legacy(legacy_file)
        self._data = self._load()

    # ------------------------------------------------------------- legado
    def _import_legacy(self, path: Path) -> None:
        if not path.is_file():
            return
        if self.db.query_one("SELECT 1 FROM app_meta WHERE key = ?", (LEGACY_IMPORTED_KEY,)):
            return
        if self.db.query_one("SELECT 1 FROM settings LIMIT 1"):
            return
        raw = _read_legacy(path)
        if raw is None:
            return
        valid: dict[str, Any] = {}
        for key, value in raw.items():
            if key not in LEGACY_KEYS:
                log.warning("preferência desconhecida %r no settings.json legado; descartada", key)
                continue
            try:
                valid[key] = _validate(key, value)
            except (ValueError, KeyError):
                log.warning("valor inválido para %s no settings.json legado; descartado", key)
        try:
            now = utc_now_iso()
            with self.db.transaction() as tx:
                for key, value in valid.items():
                    tx.execute(
                        "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)",
                        (key, json.dumps(value, ensure_ascii=False), now),
                    )
                tx.execute(
                    "INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)",
                    (LEGACY_IMPORTED_KEY, now),
                )
        except Exception:  # noqa: BLE001 — o legado nunca derruba o serviço
            log.exception("falha ao importar o settings.json legado; usando os padrões")
            return
        log.info("settings.json legado importado para o banco (%d preferências)", len(valid))
        target = path.with_name(path.name + MIGRATED_SUFFIX)
        n = 1
        while target.exists():
            target = path.with_name(f"{path.name}{MIGRATED_SUFFIX}-{n}")
            n += 1
        try:
            path.replace(target)
        except OSError as exc:
            log.warning("não foi possível renomear o settings.json legado: %s", exc)

    # ------------------------------------------------------------- leitura
    def _load(self) -> dict[str, Any]:
        data = {k: _copy(v) for k, v in DEFAULTS.items()}
        for row in self.db.query_all("SELECT key, value FROM settings"):
            key = row["key"]
            if key not in DEFAULTS:
                continue
            try:
                data[key] = _validate(key, json.loads(row["value"]))
            except (ValueError, KeyError):
                log.warning("valor inválido para %s no banco; usando o padrão", key)
        return data

    def all(self) -> dict[str, Any]:
        with self._lock:
            return {k: _copy(v) for k, v in self._data.items()}

    def get(self, key: str) -> Any:
        with self._lock:
            return _copy(self._data[key])

    # ------------------------------------------------------------- escrita
    def update(self, **changes: Any) -> dict[str, Any]:
        """Valida, grava numa transação e aplica. Valor inválido levanta ``ValueError``/``KeyError``."""
        with self._lock:
            validated = {key: _validate(key, value) for key, value in changes.items()}
            now = utc_now_iso()
            with self.db.transaction() as tx:
                for key, value in validated.items():
                    tx.execute(
                        "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) "
                        "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
                        (key, json.dumps(value, ensure_ascii=False), now),
                    )
            new = dict(self._data)
            new.update(validated)
            self._data = new
            return {k: _copy(v) for k, v in new.items()}
