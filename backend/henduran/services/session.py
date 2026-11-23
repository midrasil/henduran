"""Jornada aberta no serviço: no máximo uma por vez (ADR-075, item 8).

Política: abrir uma Jornada com **outra** já aberta é recusado com
``jornada_ja_aberta`` (a interface fecha a atual antes, de forma explícita);
abrir de novo a **mesma** Jornada devolve a que já está aberta. O serviço chama
:meth:`JourneySession.close` ao encerrar.
"""

from __future__ import annotations

import logging
import threading
from typing import Any

from henduran.services.narration import chat_view, journey_view
from henduran.storage.errors import StorageError
from henduran.storage.journeys import JourneyStore, OpenJourney
from henduran.storage.worlds import checked_id

log = logging.getLogger("henduran.services")


class JourneySession:
    """Gerencia a Jornada aberta. Seguro entre threads (as rotas chamam via ``asyncio.to_thread``)."""

    def __init__(self, journeys: JourneyStore) -> None:
        self.journeys = journeys
        self._lock = threading.Lock()
        self._current: OpenJourney | None = None

    @property
    def current_id(self) -> str | None:
        with self._lock:
            return None if self._current is None else self._current.id

    def open(self, journey_id: str) -> OpenJourney:
        jid = checked_id(journey_id)
        with self._lock:
            if self._current is not None and not self._current.closed:
                if self._current.id == jid:
                    return self._current
                raise StorageError(
                    "jornada_ja_aberta",
                    "Outra Jornada está aberta. Feche-a antes de abrir esta.",
                )
            journey = self.journeys.open_journey(jid)
            self._current = journey
        if self.journeys.settings is not None:
            try:
                self.journeys.set_last_played(jid)
            except Exception:  # noqa: BLE001 — a preferência não impede o jogo
                log.exception("não foi possível gravar a última Jornada jogada")
        return journey

    def require(self) -> OpenJourney:
        """A Jornada aberta; levanta ``nenhuma_jornada_aberta`` se não houver."""
        with self._lock:
            journey = self._current
        if journey is None or journey.closed:
            raise StorageError("nenhuma_jornada_aberta", "Nenhuma Jornada está aberta.")
        return journey

    def close(self) -> str | None:
        """Fecha a Jornada aberta (se houver) e devolve o id dela."""
        with self._lock:
            journey, self._current = self._current, None
        if journey is None:
            return None
        journey.close()
        return journey.id

    def snapshot(self) -> dict[str, Any] | None:
        """Resumo, personagem, Mundo, ``mode``/``scene``/``proposal``, ``current_place`` e ``calendar`` (ou ``None``)."""
        with self._lock:
            journey = self._current
            if journey is None or journey.closed:
                return None
            summary = journey.summary()
            return {
                "journey": summary,
                "character": journey.character_sheet(),
                "world": {
                    "id": journey.world_id,
                    "version": journey.world_version,
                    "content": journey.world_content(),
                },
                **chat_view(journey),
                **journey_view(journey),
            }


__all__ = ["JourneySession"]
