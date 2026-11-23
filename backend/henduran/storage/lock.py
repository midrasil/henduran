"""Bloqueio de arquivo do sistema operacional, liberado automaticamente se o processo morrer.

No Windows usa ``msvcrt.locking`` (``LockFile`` sobre o primeiro byte do arquivo);
nos demais sistemas, ``fcntl.flock``. O bloqueio pertence ao *handle* aberto: ao
fechar o arquivo, ou quando o processo termina (inclusive por ``taskkill /F``), o
sistema o libera. O arquivo de bloqueio fica no disco (vazio) e não guarda dados.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path


class LockBusy(Exception):
    """Outro processo (ou outro *handle*) já segura o bloqueio."""


class FileLock:
    """Bloqueio exclusivo, não bloqueante, sobre ``path``."""

    def __init__(self, path: Path) -> None:
        self.path = Path(path)
        self._fd: int | None = None

    @property
    def held(self) -> bool:
        return self._fd is not None

    def acquire(self) -> None:
        if self._fd is not None:
            raise RuntimeError("bloqueio já adquirido por este objeto")
        flags = os.O_RDWR | os.O_CREAT | getattr(os, "O_BINARY", 0) | getattr(os, "O_NOINHERIT", 0)
        fd = os.open(self.path, flags, 0o600)
        try:
            if sys.platform == "win32":
                import msvcrt

                os.lseek(fd, 0, os.SEEK_SET)
                msvcrt.locking(fd, msvcrt.LK_NBLCK, 1)
            else:
                import fcntl

                fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError as exc:
            os.close(fd)
            raise LockBusy(str(exc)) from exc
        self._fd = fd

    def release(self) -> None:
        fd, self._fd = self._fd, None
        if fd is None:
            return
        try:
            if sys.platform == "win32":
                import msvcrt

                os.lseek(fd, 0, os.SEEK_SET)
                msvcrt.locking(fd, msvcrt.LK_UNLCK, 1)
            else:
                import fcntl

                fcntl.flock(fd, fcntl.LOCK_UN)
        except OSError:
            pass  # fechar o handle libera de qualquer forma
        finally:
            os.close(fd)

    def __enter__(self) -> FileLock:
        self.acquire()
        return self

    def __exit__(self, *exc: object) -> None:
        self.release()


def is_locked(path: Path) -> bool:
    """``True`` se outro *handle* segura o bloqueio de ``path`` agora."""
    if not Path(path).exists():
        return False
    probe = FileLock(path)
    try:
        probe.acquire()
    except LockBusy:
        return True
    probe.release()
    return False
