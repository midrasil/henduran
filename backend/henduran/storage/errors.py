"""Erros do armazenamento de Jornadas e Mundos, com ``code`` estável (mensagem em português)."""

from __future__ import annotations

from pathlib import Path


class StorageError(Exception):
    """Falha numa operação sobre Jornadas ou Mundos.

    Códigos usados: ``id_invalido``, ``nome_invalido``, ``conteudo_invalido``,
    ``jornada_nao_encontrada``, ``jornada_ja_aberta``, ``jornada_aberta``,
    ``jornada_bloqueada``, ``mundo_nao_encontrado``, ``mundo_ausente``,
    ``versao_ausente``, ``versao_invalida``, ``mundo_em_uso``,
    ``uso_indeterminado``, ``mundo_mais_novo``, ``confirmacao_necessaria``,
    ``backup_invalido``, ``backup_nao_encontrado``, ``restauracao_falhou``,
    ``exclusao_falhou``, ``criacao_falhou``, ``banco_inacessivel``.
    """

    def __init__(self, code: str, message: str, *, path: Path | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.path = path


class DamagedError(StorageError):
    """Banco de jogo danificado. O arquivo é **preservado**: nada é recriado nem apagado."""

    def __init__(self, code: str, path: Path, message: str | None = None) -> None:
        super().__init__(code, message or f"O banco {Path(path).name} está danificado ({code}).", path=Path(path))


class JourneyDamaged(DamagedError):
    """O banco da Jornada não abre. Códigos: ``banco_danificado``, ``banco_ausente``,
    ``banco_vazio``, ``sem_resumo``, ``id_divergente``.

    A Jornada pode ser restaurada de um backup com
    :meth:`henduran.storage.journeys.JourneyStore.restore_backup` (operação explícita).
    """


class WorldDamaged(DamagedError):
    """O banco do Mundo não abre. Códigos: ``mundo_danificado``, ``sem_resumo``."""
