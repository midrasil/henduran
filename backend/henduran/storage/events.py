"""Eventos do motor para o Log da Jornada (migração ``journey/0004``; ADR-076, item 14).

Cada evento guarda o tipo, a Cena (quando houver), os textos necessários para exibir
(``data``) e o momento da Jornada quando aconteceu (período e data, lidos do
``journey_meta`` na mesma transação). Só as operações validadas do motor gravam
eventos; o texto do Narrador nunca.
"""

from __future__ import annotations

import json
from typing import Any, Protocol

SCENE_OPENED = "cena_aberta"
SCENE_CLOSED = "cena_encerrada"
PLACE_CHANGED = "lugar"
SCENE_RENAMED = "cena_renomeada"
KINDS = (SCENE_OPENED, SCENE_CLOSED, PLACE_CHANGED, SCENE_RENAMED)

_COLUMNS = "id, kind, scene_id, data, day_period, calendar_year, calendar_month, calendar_day, created_at"


class _Reader(Protocol):
    def query_one(self, sql: str, params: Any = ()) -> Any: ...
    def query_all(self, sql: str, params: Any = ()) -> list[Any]: ...


class _Writer(_Reader, Protocol):
    def execute(self, sql: str, params: Any = ()) -> int: ...


def _dict(row: Any) -> dict[str, Any]:
    data = dict(row)
    data["data"] = json.loads(data["data"])
    return data


def insert_event(tx: _Writer, kind: str, *, scene_id: int | None, data: dict[str, Any], now: str) -> int:
    """Grava um evento com o momento atual da Jornada (período e data do ``journey_meta``)."""
    if kind not in KINDS:
        raise ValueError("tipo de evento desconhecido")
    meta = tx.query_one("SELECT day_period, calendar_year, calendar_month, calendar_day FROM journey_meta")
    moment = (None, None, None, None) if meta is None else tuple(meta)
    tx.execute(
        "INSERT INTO events (kind, scene_id, data, day_period, calendar_year, calendar_month, calendar_day, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (kind, scene_id, json.dumps(data, ensure_ascii=False), *moment, now),
    )
    return int(tx.query_one("SELECT last_insert_rowid()")[0])


def list_events(db: _Reader, scene_id: int | None = None) -> list[dict[str, Any]]:
    """Os eventos, na ordem: todos, ou só os da Cena ``scene_id``."""
    if scene_id is None:
        rows = db.query_all(f"SELECT {_COLUMNS} FROM events ORDER BY id")
    else:
        rows = db.query_all(f"SELECT {_COLUMNS} FROM events WHERE scene_id = ? ORDER BY id", (scene_id,))
    return [_dict(r) for r in rows]


__all__ = [
    "KINDS",
    "PLACE_CHANGED",
    "SCENE_CLOSED",
    "SCENE_OPENED",
    "SCENE_RENAMED",
    "insert_event",
    "list_events",
]
