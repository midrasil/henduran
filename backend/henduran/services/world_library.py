"""Mundos salvos fora da Nova Jornada (tela de Mundos do menu inicial; modelo provisório).

- :func:`save_world` grava um Mundo novo **sem Jornada**: o conteúdo passa pela mesma
  validação e normalização da Nova Jornada (:func:`validate_world_content`) e a semente
  segue :func:`world_seed_for` (só fica quando reproduz exatamente o conteúdo; senão o
  Mundo é personalizado, ``seed`` nula).
- :func:`delete_saved_world` exclui um Mundo salvo pelas regras de
  :meth:`WorldStore.delete_world` (confirmação explícita, ``mundo_em_uso`` se alguma
  Jornada o usa, ``uso_indeterminado`` se há Jornada ilegível; exclusão atômica).
"""

from __future__ import annotations

from typing import Any

from henduran.rules.creation import FieldError
from henduran.services.journey_creation import world_seed_for
from henduran.storage.worlds import WorldStore, WorldSummary
from henduran.worldgen.schema import validate_world_content


class WorldInvalid(Exception):
    """Conteúdo do Mundo inválido; ``errors`` traz todos os erros por campo (``content.<caminho>``)."""

    code = "mundo_invalido"

    def __init__(self, errors: list[FieldError]) -> None:
        super().__init__("O Mundo tem erros; nada foi salvo.")
        self.errors = errors

    def error_dicts(self) -> list[dict[str, str]]:
        return [e.to_dict() for e in self.errors]


def save_world(worlds: WorldStore, content: Any, seed: Any = None) -> WorldSummary:
    """Valida e grava o Mundo (versão 1). Devolve o resumo, como na lista de Mundos."""
    checked = validate_world_content(content)
    if checked.errors or checked.content is None:
        errors = [FieldError(f"content.{e.field}" if e.field else "content", e.code, e.message) for e in checked.errors]
        raise WorldInvalid(errors or [FieldError("content", "mundo_invalido", "O Mundo é inválido.")])
    world_id = worlds.create_world(checked.content["name"], checked.content, seed=world_seed_for(checked.content, seed))
    summary = worlds.inspect_world(world_id)
    summary.journey_count = 0
    summary.era = checked.content["era"]["name"]
    summary.tone = checked.content["tone"]["name"]
    return summary


def delete_saved_world(worlds: WorldStore, world_id: str, *, confirm: bool = False) -> dict[str, str]:
    """Exclui o Mundo salvo. Levanta :class:`StorageError` (as regras de :meth:`WorldStore.delete_world`)."""
    worlds.delete_world(world_id, confirm=confirm)
    return {"deleted": world_id.lower()}


__all__ = ["WorldInvalid", "delete_saved_world", "save_world"]
