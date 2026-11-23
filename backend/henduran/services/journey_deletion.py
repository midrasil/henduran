"""Exclusão de uma Jornada com a limpeza do Mundo que ficou sem uso.

Cada Jornada criada pelo passo "Nova Jornada" ganha um Mundo próprio. Excluir a
Jornada sem o Mundo deixaria uma pasta ``worlds\\<id>`` órfã. Aqui, depois de
excluir a Jornada, o Mundo dela também é excluído **somente** se nenhuma outra
Jornada o usar; a regra é a de :meth:`WorldStore.delete_world`, que recusa um
Mundo em uso (``mundo_em_uso``) ou com Jornada ilegível que talvez dependa dele
(``uso_indeterminado``). Uma falha ao excluir o Mundo **não desfaz nem derruba**
a exclusão da Jornada: o Mundo fica, o fato vai para o log e o resultado diz
``world_deleted = False``.
"""

from __future__ import annotations

import logging
from dataclasses import asdict, dataclass
from typing import Any

from henduran.storage.errors import StorageError
from henduran.storage.journeys import JourneyStore

log = logging.getLogger("henduran.services")


@dataclass
class JourneyDeletion:
    """Resultado: Jornada excluída, o Mundo dela (se conhecido) e se o Mundo também foi excluído."""

    deleted: str
    world_id: str | None
    world_deleted: bool
    # Por que o Mundo ficou (código do erro), quando havia Mundo e ele não foi excluído.
    world_kept_reason: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _world_of(store: JourneyStore, journey_id: str) -> str | None:
    """Id do Mundo da Jornada, lido do resumo em modo leitura; ``None`` se ilegível."""
    try:
        world_id = store.get_summary(journey_id).world_id
    except Exception:  # noqa: BLE001 — a exclusão da Jornada decide os erros de verdade
        return None
    return world_id if isinstance(world_id, str) else None


def delete_journey_and_orphan_world(store: JourneyStore, journey_id: str, *, confirm: bool = False) -> JourneyDeletion:
    """Exclui a Jornada (as mesmas regras de :meth:`JourneyStore.delete_journey`) e o Mundo órfão.

    Levanta :class:`StorageError` só pelos erros da exclusão da Jornada.
    """
    world_id = _world_of(store, journey_id) if confirm is True else None
    store.delete_journey(journey_id, confirm=confirm)
    deleted = journey_id.lower()
    if world_id is None:
        return JourneyDeletion(deleted=deleted, world_id=None, world_deleted=False)
    worlds = store.worlds
    try:
        if not worlds.paths.world_dir(world_id).is_dir():
            return JourneyDeletion(deleted, world_id, False, "mundo_nao_encontrado")
        worlds.delete_world(world_id, confirm=True)
    except StorageError as exc:
        if exc.code == "mundo_em_uso":
            log.info("mundo %s mantido: usado por outra Jornada", world_id)
        else:
            log.warning("mundo %s não foi excluído com a Jornada %s (%s): %s", world_id, deleted, exc.code, exc)
        return JourneyDeletion(deleted, world_id, False, exc.code)
    except Exception as exc:  # noqa: BLE001 — a Jornada já foi excluída; o Mundo fica
        log.exception("falha inesperada ao excluir o mundo %s", world_id)
        return JourneyDeletion(deleted, world_id, False, getattr(exc, "code", "exclusao_falhou"))
    return JourneyDeletion(deleted, world_id, True)


__all__ = ["JourneyDeletion", "delete_journey_and_orphan_world"]
