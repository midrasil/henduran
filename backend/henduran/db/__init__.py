"""Persistência SQLite do serviço (ADR-050): conexão, migrações e backups."""

from henduran.db.connection import Database, DatabaseError, Transaction
from henduran.db.migrations import MigrationError, MigrationResult, migrate, schema_version


def open_app_database(path) -> tuple[Database, MigrationResult]:
    """Abre o banco do app e aplica as migrações. Em falha, fecha o banco e propaga o erro."""
    db = Database(path)
    try:
        result = migrate(db)
    except BaseException:
        db.close()
        raise
    return db, result


__all__ = [
    "Database",
    "DatabaseError",
    "MigrationError",
    "MigrationResult",
    "Transaction",
    "migrate",
    "open_app_database",
    "schema_version",
]
