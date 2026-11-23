"""Armazenamento de jogo (ADR-075): um banco por Jornada e um banco por Mundo.

Só a infraestrutura: pastas, bancos, migrações por conjunto, bloqueio, anexo do
Mundo em leitura, backups e tratamento de dano. O esquema de jogo (eventos,
estado, personagem, memória, salvamentos, ramificações) vem com cada funcionalidade.
"""

from henduran.storage.errors import DamagedError, JourneyDamaged, StorageError, WorldDamaged
from henduran.storage.journeys import BackupInfo, JourneyStore, JourneySummary, OpenJourney, RestoreResult
from henduran.storage.worlds import WorldStore, WorldSummary

__all__ = [
    "BackupInfo",
    "DamagedError",
    "JourneyDamaged",
    "JourneyStore",
    "JourneySummary",
    "OpenJourney",
    "RestoreResult",
    "StorageError",
    "WorldDamaged",
    "WorldStore",
    "WorldSummary",
]
