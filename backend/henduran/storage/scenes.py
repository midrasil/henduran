"""Cenas e mensagens do chat no banco da Jornada (migração ``journey/0003_scenes_messages.sql``).

Funções de baixo nível: as de escrita recebem uma transação já aberta (a do
chamador); as de leitura aceitam o banco ou uma transação. Quem decide **quando**
abrir ou encerrar uma Cena é o motor (``henduran.narrative.scene``); o texto do
Narrador nunca chega aqui sem passar por ele (ADR-076, item 7).
"""

from __future__ import annotations

import json
from typing import Any, Protocol

from henduran.storage.errors import StorageError

CHANNEL_OUT = "fora_de_cena"
CHANNEL_SCENE = "cena"
CHANNELS = (CHANNEL_OUT, CHANNEL_SCENE)
ROLE_NARRATOR = "narrador"
ROLE_PLAYER = "jogador"
ROLES = (ROLE_NARRATOR, ROLE_PLAYER)
STATUS_DONE = "concluida"
STATUS_CANCELLED = "cancelada"
MESSAGE_STATUSES = (STATUS_DONE, STATUS_CANCELLED)
MODE_OUT = "fora_de_cena"
MODE_SCENE = "em_cena"
MESSAGE_MAX = 20000  # limite do banco para o texto de uma mensagem

_SCENE_COLUMNS = (
    "id, status, opening_tone, place_id, day_period, motive, participants, summary, opened_at, closed_at"
)
_MESSAGE_COLUMNS = "id, channel, scene_id, role, content, status, created_at"


class _Reader(Protocol):
    def query_one(self, sql: str, params: Any = ()) -> Any: ...
    def query_all(self, sql: str, params: Any = ()) -> list[Any]: ...


class _Writer(_Reader, Protocol):
    def execute(self, sql: str, params: Any = ()) -> int: ...


def _scene_dict(row: Any) -> dict[str, Any]:
    data = dict(row)
    data["participants"] = json.loads(data["participants"])
    return data


def _message_dict(row: Any) -> dict[str, Any]:
    return dict(row)


# ------------------------------------------------------------------ leitura
def open_scene(db: _Reader) -> dict[str, Any] | None:
    """A Cena aberta (no máximo uma), ou ``None``."""
    row = db.query_one(f"SELECT {_SCENE_COLUMNS} FROM scenes WHERE status = 'aberta'")
    return None if row is None else _scene_dict(row)


def get_scene(db: _Reader, scene_id: int) -> dict[str, Any] | None:
    row = db.query_one(f"SELECT {_SCENE_COLUMNS} FROM scenes WHERE id = ?", (scene_id,))
    return None if row is None else _scene_dict(row)


def closed_scenes(db: _Reader, limit: int) -> list[dict[str, Any]]:
    """As ``limit`` Cenas encerradas mais recentes, da mais antiga para a mais nova."""
    rows = db.query_all(
        f"SELECT {_SCENE_COLUMNS} FROM scenes WHERE status = 'encerrada' ORDER BY id DESC LIMIT ?", (limit,)
    )
    return [_scene_dict(r) for r in reversed(rows)]


def get_message(db: _Reader, message_id: int) -> dict[str, Any] | None:
    row = db.query_one(f"SELECT {_MESSAGE_COLUMNS} FROM messages WHERE id = ?", (message_id,))
    return None if row is None else _message_dict(row)


def has_history(db: _Reader) -> bool:
    """Se a Jornada já tem alguma mensagem ou Cena (então a abertura já aconteceu)."""
    row = db.query_one("SELECT EXISTS (SELECT 1 FROM messages) OR EXISTS (SELECT 1 FROM scenes)")
    return bool(row[0])


def all_messages(db: _Reader) -> list[dict[str, Any]]:
    """Todas as mensagens, na ordem, inclusive as canceladas."""
    return [_message_dict(r) for r in db.query_all(f"SELECT {_MESSAGE_COLUMNS} FROM messages ORDER BY id")]


def recent_messages(db: _Reader, channel: str, scene_id: int | None, limit: int) -> list[dict[str, Any]]:
    """As ``limit`` últimas mensagens **concluídas** do canal (e da Cena, no canal ``cena``), em ordem."""
    if channel == CHANNEL_SCENE:
        rows = db.query_all(
            f"SELECT {_MESSAGE_COLUMNS} FROM messages WHERE channel = 'cena' AND scene_id = ? "
            "AND status = 'concluida' ORDER BY id DESC LIMIT ?",
            (scene_id, limit),
        )
    else:
        rows = db.query_all(
            f"SELECT {_MESSAGE_COLUMNS} FROM messages WHERE channel = 'fora_de_cena' "
            "AND status = 'concluida' ORDER BY id DESC LIMIT ?",
            (limit,),
        )
    return [_message_dict(r) for r in reversed(rows)]


# ------------------------------------------------------------------ escrita
def insert_scene(
    tx: _Writer,
    *,
    place_id: str,
    day_period: str,
    motive: str,
    participants: list[str],
    opening_tone: str | None,
    now: str,
) -> int:
    """Grava uma Cena aberta. Recusa (``cena_ja_aberta``) se já houver uma."""
    if open_scene(tx) is not None:
        raise StorageError("cena_ja_aberta", "Já existe uma Cena aberta nesta Jornada.")
    tx.execute(
        "INSERT INTO scenes (status, opening_tone, place_id, day_period, motive, participants, opened_at) "
        "VALUES ('aberta', ?, ?, ?, ?, ?, ?)",
        (opening_tone, place_id, day_period, motive, json.dumps(participants, ensure_ascii=False), now),
    )
    return int(tx.query_one("SELECT last_insert_rowid()")[0])


def close_scene(tx: _Writer, summary: str, now: str) -> int:
    """Encerra a Cena aberta com o resumo. Recusa (``sem_cena_aberta``) se não houver."""
    scene = open_scene(tx)
    if scene is None:
        raise StorageError("sem_cena_aberta", "Não há Cena aberta para encerrar.")
    tx.execute(
        "UPDATE scenes SET status = 'encerrada', summary = ?, closed_at = ? WHERE id = ?",
        (summary, now, scene["id"]),
    )
    return int(scene["id"])


def insert_message(
    tx: _Writer,
    *,
    channel: str,
    scene_id: int | None,
    role: str,
    content: str,
    status: str,
    now: str,
) -> int:
    if channel not in CHANNELS or role not in ROLES or status not in MESSAGE_STATUSES:
        raise ValueError("canal, papel ou estado de mensagem desconhecido")
    tx.execute(
        "INSERT INTO messages (channel, scene_id, role, content, status, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (channel, scene_id, role, content, status, now),
    )
    return int(tx.query_one("SELECT last_insert_rowid()")[0])


__all__ = [
    "CHANNELS",
    "CHANNEL_OUT",
    "CHANNEL_SCENE",
    "MESSAGE_MAX",
    "MODE_OUT",
    "MODE_SCENE",
    "ROLE_NARRATOR",
    "ROLE_PLAYER",
    "STATUS_CANCELLED",
    "STATUS_DONE",
    "all_messages",
    "close_scene",
    "closed_scenes",
    "get_message",
    "get_scene",
    "has_history",
    "insert_message",
    "insert_scene",
    "open_scene",
    "recent_messages",
]
