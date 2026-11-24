"""Exclusão de uma Jornada **sem** excluir o Mundo dela.

Decisão do responsável em 2026-11-24 (tela de Mundos do menu inicial): o Mundo é
um dado do jogador, salvo e reutilizável. Excluir a última Jornada que usa um Mundo
não o apaga mais (antes, ``delete_journey_and_orphan_world`` o removia junto). O
Mundo continua na lista de Mundos e só é excluído pela tela de Mundos
(``DELETE /worlds/{id}``, que recusa um Mundo em uso). Um Mundo sem Jornadas não é
inconsistente: é um Mundo salvo, como um criado pela tela de Mundos.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any

from henduran.storage.journeys import JourneyStore


@dataclass
class JourneyDeletion:
    """Resultado: a Jornada excluída e o Mundo dela (se conhecido), que fica salvo."""

    deleted: str
    world_id: str | None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _world_of(store: JourneyStore, journey_id: str) -> str | None:
    """Id do Mundo da Jornada, lido do resumo em modo leitura; ``None`` se ilegível."""
    try:
        world_id = store.get_summary(journey_id).world_id
    except Exception:  # noqa: BLE001 — a exclusão da Jornada decide os erros de verdade
        return None
    return world_id if isinstance(world_id, str) else None


def delete_journey(store: JourneyStore, journey_id: str, *, confirm: bool = False) -> JourneyDeletion:
    """Exclui a Jornada (as regras de :meth:`JourneyStore.delete_journey`); o Mundo fica.

    Levanta :class:`StorageError` pelos erros da exclusão da Jornada.
    """
    world_id = _world_of(store, journey_id) if confirm is True else None
    store.delete_journey(journey_id, confirm=confirm)
    return JourneyDeletion(deleted=journey_id.lower(), world_id=world_id)


__all__ = ["JourneyDeletion", "delete_journey"]
