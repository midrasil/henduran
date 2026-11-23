"""Propostas de Cena do Aduran (migração ``journey/0004``; ADR-076, itens 12 e 17).

Uma proposta validada pelo motor é gravada como ``pendente`` (no máximo uma), para o
cartão sobreviver a reabrir o app. O jogador aceita (``aceita``, com a Cena aberta),
pede outra (a anterior vira ``substituida``) ou recusa (``recusada``).
"""

from __future__ import annotations

import json
from typing import Any, Protocol

from henduran.storage.errors import StorageError

PENDING = "pendente"
ACCEPTED = "aceita"
DECLINED = "recusada"
REPLACED = "substituida"

_COLUMNS = (
    "id, status, title, place_id, new_place_name, new_place_type, new_place_description, motive, participants, "
    "scene_id, created_at, decided_at"
)


class _Reader(Protocol):
    def query_one(self, sql: str, params: Any = ()) -> Any: ...
    def query_all(self, sql: str, params: Any = ()) -> list[Any]: ...


class _Writer(_Reader, Protocol):
    def execute(self, sql: str, params: Any = ()) -> int: ...


def _dict(row: Any) -> dict[str, Any]:
    data = dict(row)
    data["participants"] = json.loads(data["participants"])
    return data


def pending_proposal(db: _Reader) -> dict[str, Any] | None:
    row = db.query_one(f"SELECT {_COLUMNS} FROM scene_proposals WHERE status = 'pendente'")
    return None if row is None else _dict(row)


def get_proposal(db: _Reader, proposal_id: int) -> dict[str, Any] | None:
    row = db.query_one(f"SELECT {_COLUMNS} FROM scene_proposals WHERE id = ?", (proposal_id,))
    return None if row is None else _dict(row)


def insert_pending(
    tx: _Writer,
    *,
    title: str,
    place_id: str | None,
    new_place: tuple[str, str, str] | None,
    motive: str,
    participants: list[str],
    now: str,
) -> int:
    """Grava uma proposta pendente; a pendente anterior (se houver) vira ``substituida``."""
    tx.execute("UPDATE scene_proposals SET status = 'substituida', decided_at = ? WHERE status = 'pendente'", (now,))
    name, type_, description = new_place if new_place is not None else (None, None, None)
    tx.execute(
        "INSERT INTO scene_proposals (status, title, place_id, new_place_name, new_place_type, new_place_description, "
        "motive, participants, created_at) VALUES ('pendente', ?, ?, ?, ?, ?, ?, ?, ?)",
        (title, place_id, name, type_, description, motive, json.dumps(participants, ensure_ascii=False), now),
    )
    return int(tx.query_one("SELECT last_insert_rowid()")[0])


def decide(tx: _Writer, proposal_id: int, status: str, now: str, scene_id: int | None = None) -> None:
    """Fecha a proposta pendente ``proposal_id`` (``aceita``, ``recusada`` ou ``substituida``)."""
    if status not in (ACCEPTED, DECLINED, REPLACED):
        raise ValueError("estado de proposta desconhecido")
    changed = tx.execute(
        "UPDATE scene_proposals SET status = ?, decided_at = ?, scene_id = ? WHERE id = ? AND status = 'pendente'",
        (status, now, scene_id, proposal_id),
    )
    if not changed:
        raise StorageError("sem_proposta_pendente", "Não há proposta de Cena pendente.")


__all__ = [
    "ACCEPTED",
    "DECLINED",
    "PENDING",
    "REPLACED",
    "decide",
    "get_proposal",
    "insert_pending",
    "pending_proposal",
]
