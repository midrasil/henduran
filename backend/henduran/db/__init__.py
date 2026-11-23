"""Persistência SQLite do serviço (ADR-050 e ADR-075): conexão, migrações por conjunto e backups."""

from henduran.db.connection import Database, DatabaseError, Transaction
from henduran.db.migrations import (
    MIGRATION_SETS,
    MigrationError,
    MigrationResult,
    latest_version,
    load_migration_set,
    migrate,
    schema_version,
)


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
    "MIGRATION_SETS",
    "Database",
    "DatabaseError",
    "MigrationError",
    "MigrationResult",
    "Transaction",
    "latest_version",
    "load_migration_set",
    "migrate",
    "open_app_database",
    "schema_version",
]
