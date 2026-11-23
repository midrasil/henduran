"""Personagem no banco da Jornada (migração ``journey/0002_character.sql``).

``write_character`` grava tudo numa transação já aberta (a do chamador): a ficha,
os 6 Atributos, as 22 Perícias, as 3 Convicções e a Ambição e o Desejo ativos.
``read_character`` e ``character_sheet`` leem de volta, com os valores derivados
(tamanho das trilhas de Vida e Vontade) calculados pelas regras da fatia 1.
"""

from __future__ import annotations

from typing import Any, Protocol

from henduran.rules import fatia1 as R
from henduran.rules.creation import Character
from henduran.storage.errors import StorageError


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
        "INSERT INTO character (id, name, concept, appearance, history, creation_profile, created_at) "
        "VALUES (1, ?, ?, ?, ?, ?, ?)",
        (character.name, character.concept, character.appearance, character.history, character.skill_profile, now),
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
        "vontade_superficial, vontade_agravada, created_at FROM character WHERE id = 1"
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


__all__ = ["character_sheet", "read_character", "write_character"]
