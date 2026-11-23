"""Lugares descobertos na Jornada (migração ``journey/0004``; ADR-076, item 13).

Os lugares do Mundo ficam só no ``world.db`` (leitura); os novos, propostos pelo Aduran
e aceitos pelo jogador, ficam aqui. O id tem o formato dos ids do Mundo e começa com
``j-``; :func:`next_place_id` evita colidir com os ids do Mundo fixado.
"""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any, Protocol

PLACE_ID_PREFIX = "j-"
NAME_MAX = 100
TYPE_MAX = 40
DESCRIPTION_MAX = 1000

_COLUMNS = "id, name, type, description, scene_id, created_at"


class _Reader(Protocol):
    def query_one(self, sql: str, params: Any = ()) -> Any: ...
    def query_all(self, sql: str, params: Any = ()) -> list[Any]: ...


class _Writer(_Reader, Protocol):
    def execute(self, sql: str, params: Any = ()) -> int: ...


def journey_places(db: _Reader) -> list[dict[str, Any]]:
    """Os lugares da Jornada, na ordem em que foram descobertos."""
    return [dict(r) for r in db.query_all(f"SELECT {_COLUMNS} FROM places ORDER BY rowid")]


def next_place_id(db: _Reader, taken: Iterable[str]) -> str:
    """O próximo id livre ``j-<n>`` (sem colidir com ``taken``, os ids do Mundo, nem com os da Jornada)."""
    used = set(taken) | {r["id"] for r in db.query_all("SELECT id FROM places")}
    n = int(db.query_one("SELECT COUNT(*) FROM places")[0]) + 1
    while f"{PLACE_ID_PREFIX}{n}" in used:
        n += 1
    return f"{PLACE_ID_PREFIX}{n}"


def insert_place(
    tx: _Writer, *, place_id: str, name: str, type_: str, description: str, scene_id: int | None, now: str
) -> None:
    tx.execute(
        "INSERT INTO places (id, name, type, description, scene_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (place_id, name, type_, description, scene_id, now),
    )


def set_place_scene(tx: _Writer, place_id: str, scene_id: int) -> None:
    tx.execute("UPDATE places SET scene_id = ? WHERE id = ?", (scene_id, place_id))


__all__ = [
    "DESCRIPTION_MAX",
    "NAME_MAX",
    "PLACE_ID_PREFIX",
    "TYPE_MAX",
    "insert_place",
    "journey_places",
    "next_place_id",
    "set_place_scene",
]
