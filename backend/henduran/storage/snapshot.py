"""Leitura **somente leitura e sem migrar** dos bancos de Jornada e de Mundo.

Usada pelas listas (Jornadas, Mundos) e antes de abrir um banco para escrita.
Nunca cria, altera, migra nem apaga arquivos; uma conexão de escrita nunca é
aberta aqui (fechar uma conexão de escrita sobre um arquivo inválido faria o
SQLite apagar o ``-wal``, ADR-074).
"""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from henduran.db.connection import Database, DatabaseError, connect_readonly, is_corruption

# Tabelas de resumo conhecidas (nomes fixos; nunca vêm de fora).
META_TABLES = ("journey_meta", "world_meta")


@dataclass
class DbSnapshot:
    """Resultado da leitura somente leitura de um banco de jogo."""

    version: int = 0
    meta: dict[str, Any] | None = None
    meta_rows: int = 0
    world_versions: list[int] = field(default_factory=list)
    problem: str | None = None  # código do problema, se houver
    detail: str | None = None


def read_snapshot(path: Path, meta_table: str, *, integrity: bool = False) -> DbSnapshot:
    """Lê versão do esquema e a linha de resumo de ``meta_table`` sem alterar nada.

    ``problem`` recebe: ``banco_ausente``, ``banco_vazio``, ``banco_danificado``
    (corrupção ou não é SQLite), ``banco_inacessivel`` (bloqueio, permissão) ou
    ``sem_resumo`` (sem esquema ou sem a linha de resumo). Com ``integrity``,
    roda também ``PRAGMA quick_check`` (custa proporcional ao tamanho do banco).
    """
    if meta_table not in META_TABLES:
        raise ValueError("tabela de resumo desconhecida")
    path = Path(path)
    snap = DbSnapshot()
    if not path.is_file():
        snap.problem, snap.detail = "banco_ausente", f"O arquivo {path.name} não existe."
        return snap
    if path.stat().st_size == 0:
        snap.problem, snap.detail = "banco_vazio", f"O arquivo {path.name} está vazio."
        return snap
    try:
        conn = connect_readonly(path)
    except sqlite3.Error as exc:
        snap.problem = "banco_danificado" if is_corruption(exc) else "banco_inacessivel"
        snap.detail = str(exc)
        return snap
    try:
        if integrity:
            try:
                bad = Database._quick_check(conn)
            except DatabaseError as exc:
                snap.problem, snap.detail = "banco_inacessivel", str(exc)
                return snap
            if bad is not None:
                snap.problem, snap.detail = "banco_danificado", bad
                return snap
        names = {
            r[0]
            for r in conn.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('schema_migrations', ?, 'world_versions')",
                (meta_table,),
            ).fetchall()
        }
        if "schema_migrations" in names:
            snap.version = int(conn.execute("SELECT COALESCE(MAX(version), 0) FROM schema_migrations").fetchone()[0])
        if meta_table in names:
            rows = conn.execute(f"SELECT * FROM {meta_table} LIMIT 2").fetchall()  # nome fixo, validado acima
            snap.meta_rows = len(rows)
            if rows:
                snap.meta = {k: rows[0][k] for k in rows[0].keys()}
        if "world_versions" in names and meta_table == "world_meta":
            snap.world_versions = [int(r[0]) for r in conn.execute("SELECT version FROM world_versions ORDER BY version")]
    except sqlite3.Error as exc:
        snap.problem = "banco_danificado" if is_corruption(exc) else "banco_inacessivel"
        snap.detail = str(exc)
        return snap
    finally:
        conn.close()
    if snap.version == 0 or snap.meta is None:
        snap.problem, snap.detail = "sem_resumo", f"O banco {path.name} não tem o resumo esperado ({meta_table})."
    return snap
