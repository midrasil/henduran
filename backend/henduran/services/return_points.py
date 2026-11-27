"""Pontos de retorno locais. O catálogo fica fora do estado restaurável."""
from __future__ import annotations

import json
import logging
import os
import sqlite3
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from henduran.db.connection import Database, DatabaseError
from henduran.db.migrations import MigrationError, migrate, schema_version
from henduran.storage.character import PORTRAIT_FILES
from henduran.storage.errors import StorageError
from henduran.storage.journeys import JourneyStore, OpenJourney
from henduran.storage.snapshot import read_snapshot
from henduran.storage.worlds import checked_id

MANUAL_LIMIT = 20
AUTO_LIMIT = 5
log = logging.getLogger(__name__)


def _name(value: Any, default: str | None = None) -> str:
    if value is None and default is not None:
        return default
    if not isinstance(value, str) or not 1 <= len(value.strip()) <= 60:
        raise StorageError("ponto_nome_invalido", "Informe um nome de 1 a 60 caracteres.")
    return value.strip()


class ReturnPoints:
    def __init__(self, store: JourneyStore, journey_id: str) -> None:
        self.store = store
        self.id = checked_id(journey_id)
        self.folder = store.paths.journey_dir(self.id) / "return-points"
        self.index = self.folder / "index.json"

    def list(self) -> list[dict]:
        if not self.folder.parent.is_dir():
            raise StorageError("jornada_nao_encontrada", "Jornada não encontrada.")
        try:
            items = json.loads(self.index.read_text(encoding="utf-8"))
            required = {"id", "file", "name", "kind", "location", "message_count", "created_at"}
            if not isinstance(items, list) or any(not isinstance(p, dict) or not required <= p.keys()
                                                 or p["kind"] not in ("manual", "automatic") for p in items):
                raise ValueError("catálogo inválido")
            return items
        except FileNotFoundError:
            return []
        except (ValueError, OSError) as exc:
            raise StorageError("ponto_falhou", "Não foi possível ler o catálogo de pontos.") from exc

    def _publish(self, items: list[dict]) -> None:
        temp = self.folder / f".{uuid4().hex}.tmp"
        try:
            with temp.open("w", encoding="utf-8") as fd:
                json.dump(items, fd, ensure_ascii=False)
                fd.flush()
                os.fsync(fd.fileno())
            os.replace(temp, self.index)
        finally:
            temp.unlink(missing_ok=True)

    def _gc(self, items: list[dict]) -> None:
        keep = {f"{p['file']}.db" for p in items}
        for path in self.folder.glob("*.db"):
            if path.name not in keep:
                try:
                    path.unlink()
                except OSError:
                    log.warning("Não foi possível remover a cópia %s", path.name)

    @staticmethod
    def _find(items: list[dict], point_id: str, *, manual: bool = False) -> dict:
        point = next((p for p in items if p["id"] == point_id), None)
        if point is None:
            raise StorageError("ponto_ausente", "Ponto de retorno não encontrado.")
        if manual and point["kind"] != "manual":
            raise StorageError("ponto_automatico", "Pontos automáticos não podem ser alterados.")
        return point

    def save(self, db: Database, name: Any = None, *, automatic: bool = False,
             replace: str | None = None, prune: bool = True) -> dict:
        items = self.list()
        previous = self._find(items, replace, manual=True) if replace is not None else None
        if previous is None and not automatic and sum(p["kind"] == "manual" for p in items) >= MANUAL_LIMIT:
            raise StorageError("ponto_limite", "Limite de 20 pontos manuais. Exclua ou salve por cima de um ponto existente.")
        label = _name(name, previous["name"] if previous else "Ponto manual")
        self.folder.mkdir(exist_ok=True)
        file_id = str(uuid4())
        path = self.folder / f"{file_id}.db"
        try:
            db.backup_to(path)
            with closing(sqlite3.connect(path)) as conn, conn:
                conn.execute("PRAGMA journal_mode=DELETE")
                row = conn.execute("SELECT portrait_file, portrait_snapshot FROM character WHERE id = 1").fetchone()
                if row and row[0] in PORTRAIT_FILES and row[1] is None:
                    try:
                        data = (self.store.paths.journey_assets_dir(self.id) / row[0]).read_bytes()
                    except FileNotFoundError:
                        # Retrato ausente no estado vivo também deve estar ausente no ponto.
                        conn.execute("UPDATE character SET portrait_file=NULL, portrait_crop=NULL WHERE id=1")
                    else:
                        conn.execute("UPDATE character SET portrait_snapshot=? WHERE id=1", (data,))
                location = conn.execute("SELECT location FROM journey_meta").fetchone()[0]
                count = conn.execute("SELECT COUNT(*) FROM messages").fetchone()[0]
            point = {
                "id": previous["id"] if previous else file_id, "file": file_id, "name": label,
                "kind": "automatic" if automatic else "manual", "location": location, "message_count": count,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            updated = [point, *(p for p in items if p is not previous)]
            # A imagem e o estado já estão duráveis antes de publicar o catálogo.
            with path.open("r+b") as fh:
                os.fsync(fh.fileno())
            self._publish(self._retained(updated))
        except (OSError, sqlite3.Error) as exc:
            path.unlink(missing_ok=True)
            raise StorageError("ponto_falhou", "Não foi possível gravar o ponto de retorno.") from exc
        if prune:
            self._gc(self._retained(updated))
        return point

    @staticmethod
    def _retained(items: list[dict]) -> list[dict]:
        automatic = [p["id"] for p in items if p["kind"] == "automatic"][:AUTO_LIMIT]
        return [p for p in items if p["kind"] == "manual" or p["id"] in automatic]

    def rename(self, point_id: str, name: Any) -> dict:
        items = self.list()
        point = self._find(items, point_id, manual=True)
        point["name"] = _name(name)
        self._publish(items)
        return point

    def delete(self, point_id: str) -> None:
        items = self.list()
        target = self._find(items, point_id, manual=True)
        items.remove(target)
        self._publish(items)
        self._gc(items)

    def load(self, journey: OpenJourney, point_id: str) -> None:
        items = self.list()
        target = self._find(items, point_id)
        path = self.folder / f"{checked_id(target['file'])}.db"
        snap = read_snapshot(path, "journey_meta", integrity=True)
        meta = snap.meta or {}
        if snap.problem or meta.get("id") != journey.id:
            raise StorageError("ponto_danificado", "O ponto está danificado ou não pertence a esta Jornada.")
        if (meta.get("world_id"), meta.get("world_version")) != (journey.world_id, journey.world_version):
            raise StorageError("ponto_mundo_divergente", "O ponto não corresponde ao Mundo fixado na Jornada.")
        current_version = schema_version(journey.db)
        if snap.version > current_version:
            raise StorageError("ponto_danificado", "O ponto exige uma versão mais recente do Henduran.")
        stage = self.folder / f".{uuid4().hex}.load"
        try:
            with closing(sqlite3.connect(path.resolve().as_uri() + "?mode=ro", uri=True)) as src:
                with closing(sqlite3.connect(stage)) as dst:
                    src.backup(dst)
            with Database(stage, recover_corrupt=False, create=False) as staged:
                migrate(staged, migration_set="journey")
                staged.execute("UPDATE journey_meta SET last_saved_at=?", (datetime.now(timezone.utc).isoformat(),))
            self.save(journey.db, "Antes de carregar", automatic=True, prune=False)
            # SQLite publica main em uma só transação; o banco do Mundo permanece anexado em leitura.
            journey.db.restore_from(stage)
        except (OSError, sqlite3.Error, DatabaseError, MigrationError) as exc:
            raise StorageError("ponto_falhou", "Não foi possível carregar o ponto de retorno.") from exc
        finally:
            stage.unlink(missing_ok=True)
        self._gc(self.list())


def auto_save(store: JourneyStore, journey_id: str, db: Database, name: str) -> None:
    try:
        ReturnPoints(store, journey_id).save(db, name, automatic=True)
    except (StorageError, DatabaseError, OSError, sqlite3.Error):
        log.exception("Falha ao criar ponto automático da Jornada %s", journey_id)
