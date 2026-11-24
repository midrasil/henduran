"""Personagem no banco da Jornada (migrações ``journey/0002_character.sql`` e ``0004``).

``write_character`` grava tudo numa transação já aberta (a do chamador): a ficha,
os 6 Atributos, as 22 Perícias, as 3 Convicções e a Ambição e o Desejo ativos.
``read_character`` e ``character_sheet`` leem de volta, com os valores derivados
(tamanho das trilhas de Vida e Vontade) calculados pelas regras da fatia 1.

A ``0004`` acrescenta os campos opcionais da descrição (``age``, ``height``,
``origin``, ``personality``; sem efeito de regra) e o retrato: o nome do arquivo em
``assets`` e o enquadramento ``{x, y, zoom}``. A ficha expõe
``portrait: {"crop", "url_path"}`` ou ``None``.
"""

from __future__ import annotations

import json
from typing import Any, Protocol

from henduran.rules import fatia1 as R
from henduran.rules.creation import Character
from henduran.storage.errors import StorageError

PORTRAIT_URL_PATH = "/journeys/current/portrait"
# Nomes possíveis do arquivo do retrato em ``assets`` e o ``Content-Type`` de cada um
# (os mesmos de ``services.portrait.FILE_NAMES``; a lista das Jornadas lê sem abrir a Jornada).
PORTRAIT_FILES = {"portrait.png": "image/png", "portrait.jpg": "image/jpeg", "portrait.webp": "image/webp"}


class _Writer(Protocol):
    def execute(self, sql: str, params: Any = ()) -> int: ...
    def executemany(self, sql: str, seq: Any) -> int: ...
    def query_one(self, sql: str, params: Any = ()) -> Any: ...


class _Reader(Protocol):
    def query_one(self, sql: str, params: Any = ()) -> Any: ...
    def query_all(self, sql: str, params: Any = ()) -> list[Any]: ...


def write_character(tx: _Writer, character: Character, now: str) -> None:
    """Grava o personagem (validado) dentro da transação ``tx``. Recusa se já houver um."""
    if not isinstance(character, Character):
        raise TypeError("character deve ser um Character validado")
    if tx.query_one("SELECT 1 FROM character") is not None:
        raise StorageError("personagem_existente", "Esta Jornada já tem um personagem.")
    tx.execute(
        "INSERT INTO character (id, name, concept, appearance, history, creation_profile, created_at, age, height, "
        "origin, personality) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            character.name, character.concept, character.appearance, character.history, character.skill_profile, now,
            character.age, character.height, character.origin, character.personality,
        ),
    )
    tx.executemany(
        "INSERT INTO character_attributes (attribute, value) VALUES (?, ?)",
        [(a, character.attributes[a]) for a in R.ATTRIBUTE_IDS],
    )
    tx.executemany(
        "INSERT INTO character_skills (skill, value) VALUES (?, ?)",
        [(s, character.skills[s]) for s in R.SKILL_IDS],
    )
    tx.executemany(
        "INSERT INTO convictions (position, text, pillar) VALUES (?, ?, ?)",
        [(i, c.text, c.pillar) for i, c in enumerate(character.convictions, start=1)],
    )
    tx.executemany(
        "INSERT INTO objectives (kind, text, status, created_at) VALUES (?, ?, 'ativo', ?)",
        [("ambicao", character.ambition, now), ("desejo", character.desire, now)],
    )


def read_character(db: _Reader) -> dict[str, Any] | None:
    """O personagem como gravado (ou ``None`` se a Jornada ainda não tem personagem)."""
    row = db.query_one(
        "SELECT name, concept, appearance, history, creation_profile, vida_superficial, vida_agravada, "
        "vontade_superficial, vontade_agravada, created_at, age, height, origin, personality, portrait_file, "
        "portrait_crop FROM character WHERE id = 1"
    )
    if row is None:
        return None
    attrs = {r["attribute"]: r["value"] for r in db.query_all("SELECT attribute, value FROM character_attributes")}
    skills = {r["skill"]: r["value"] for r in db.query_all("SELECT skill, value FROM character_skills")}
    convictions = [
        {"position": r["position"], "text": r["text"], "pillar": r["pillar"], "fractures": r["fractures"]}
        for r in db.query_all("SELECT position, text, pillar, fractures FROM convictions ORDER BY position")
    ]
    active = {
        r["kind"]: {"id": r["id"], "text": r["text"], "created_at": r["created_at"]}
        for r in db.query_all(
            "SELECT id, kind, text, created_at FROM objectives WHERE status = 'ativo' ORDER BY id"
        )
    }
    return {
        "name": row["name"],
        "concept": row["concept"],
        "appearance": row["appearance"],
        "history": row["history"],
        "age": row["age"],
        "height": row["height"],
        "origin": row["origin"],
        "personality": row["personality"],
        "portrait": portrait_view(row["portrait_file"], row["portrait_crop"]),
        "skill_profile": row["creation_profile"],
        "created_at": row["created_at"],
        # Ordem fixa das regras; ids gravados e desconhecidos pela versão atual vêm ao fim.
        "attributes": {a: attrs[a] for a in R.ATTRIBUTE_IDS if a in attrs}
        | {a: v for a, v in attrs.items() if a not in R.ATTRIBUTES_BY_ID},
        "skills": {s: skills[s] for s in R.SKILL_IDS if s in skills}
        | {s: v for s, v in skills.items() if s not in R.SKILLS_BY_ID},
        "convictions": convictions,
        "ambition": active.get("ambicao"),
        "desire": active.get("desejo"),
        "damage": {
            "vida": {"superficial": row["vida_superficial"], "agravada": row["vida_agravada"]},
            "vontade": {"superficial": row["vontade_superficial"], "agravada": row["vontade_agravada"]},
        },
    }


def character_sheet(db: _Reader) -> dict[str, Any] | None:
    """Personagem completo com os derivados: ``tracks`` (tamanho e dano de Vida e Vontade)."""
    data = read_character(db)
    if data is None:
        return None
    meta = db.query_one("SELECT rules_version FROM journey_meta")
    tracks: dict[str, Any] = {}
    for d in R.DERIVED:
        value = data["attributes"].get(d.attribute)
        size = d.base + value if isinstance(value, int) else None
        tracks[d.id] = {"size": size, **data["damage"][d.id]}
    data["tracks"] = tracks
    data["derived"] = {k: v["size"] for k, v in tracks.items()}
    data["rules_version"] = meta["rules_version"] if meta is not None else None
    del data["damage"]
    return data


def portrait_view(portrait_file: str | None, crop: str | None) -> dict[str, Any] | None:
    if not portrait_file or not crop:
        return None
    return {"crop": json.loads(crop), "url_path": PORTRAIT_URL_PATH}


def portrait_file(db: _Reader) -> str | None:
    """O nome do arquivo do retrato em ``assets`` (ou ``None``)."""
    row = db.query_one("SELECT portrait_file FROM character WHERE id = 1")
    if row is None:
        raise StorageError("personagem_ausente", "A Jornada ainda não tem personagem.")
    return row["portrait_file"]


def set_portrait(tx: _Writer, file_name: str | None, crop: dict[str, float] | None) -> None:
    """Grava (ou limpa, com ``None``) o retrato: nome do arquivo e enquadramento validados."""
    payload = None if crop is None else json.dumps(crop)
    changed = tx.execute(
        "UPDATE character SET portrait_file = ?, portrait_crop = ? WHERE id = 1", (file_name, payload)
    )
    if not changed:
        raise StorageError("personagem_ausente", "A Jornada ainda não tem personagem.")


__all__ = [
    "PORTRAIT_FILES",
    "PORTRAIT_URL_PATH",
    "character_sheet",
    "portrait_file",
    "portrait_view",
    "read_character",
    "set_portrait",
    "write_character",
]
