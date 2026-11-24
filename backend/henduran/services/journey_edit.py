"""Editar o nome e a descrição da Jornada aberta (menu ⚙ da tela da Jornada; decisão de 2026-11-24).

As regras são as da criação (``services/journey_creation.py``, ADR-077, item 4):

- **nome**: opcional; em branco (ou nulo), volta ao padrão "A Jornada de <nome do
  personagem>"; senão, texto de uma linha com até 200 caracteres.
- **descrição**: opcional; em branco (ou nula), é apagada; senão, até 2.000 caracteres.

Campo ausente do pedido não muda. Os dois são gravados em ``journey_meta`` numa única
transação do ``journey.db`` (``synchronous=FULL``). O Narrador lê a descrição nova no
próximo contexto.
"""

from __future__ import annotations

from typing import Any

from henduran.rules.creation import FieldError, check_optional_text, check_text, clean_text
from henduran.services.journey_creation import JOURNEY_DESCRIPTION_MAX, JOURNEY_NAME_MAX, default_journey_name
from henduran.storage.journeys import OpenJourney

EDIT_FIELDS = ("name", "description")


class JourneyEditInvalid(Exception):
    """Pedido inválido; ``errors`` traz todos os erros por campo."""

    code = "resumo_invalido"

    def __init__(self, errors: list[FieldError]) -> None:
        super().__init__("O nome ou a descrição da Jornada têm erros; nada mudou.")
        self.errors = errors

    def error_dicts(self) -> list[dict[str, str]]:
        return [e.to_dict() for e in self.errors]


def _blank(value: Any) -> bool:
    return value is None or (isinstance(value, str) and len(value) <= 10_000 and not clean_text(value))


def edit_journey_summary(journey: OpenJourney, body: dict[str, Any]) -> dict[str, Any]:
    """Valida e grava o nome e/ou a descrição. Devolve o resumo (``journey_meta``) atualizado."""
    errors: list[FieldError] = []
    changes: dict[str, Any] = {}
    if "name" in body:
        if _blank(body["name"]):
            character = journey.db.query_one("SELECT name FROM character WHERE id = 1")
            owner = character["name"] if character is not None else journey.summary().get("character_name")
            changes["name"] = default_journey_name(owner or "seu personagem")
        else:
            name = check_text(errors, "name", body["name"], JOURNEY_NAME_MAX, "O nome da Jornada", single_line=True)
            if name is not None:
                changes["name"] = name
    if "description" in body:
        description = check_optional_text(
            errors, "description", body["description"], JOURNEY_DESCRIPTION_MAX, "A descrição da Jornada"
        )
        if not errors or all(e.field != "description" for e in errors):
            changes["description"] = description
    if errors:
        raise JourneyEditInvalid(errors)
    if changes:
        assignments = ", ".join(f"{key} = ?" for key in changes)  # chaves fixas: EDIT_FIELDS
        with journey.db.transaction() as tx:
            tx.execute(f"UPDATE journey_meta SET {assignments}", tuple(changes.values()))
    return journey.summary()


__all__ = ["EDIT_FIELDS", "JourneyEditInvalid", "edit_journey_summary"]
