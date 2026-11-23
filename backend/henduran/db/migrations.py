"""Migrações do banco do app, só para frente.

Formato: arquivos ``NNNN_nome.sql`` em ``henduran/db/migrations/``, numerados
de 1 em diante, sem lacunas. Cada arquivo é dividido em comandos
(``sqlite3.complete_statement``) e executado **numa única transação** junto
com o registro em ``schema_migrations``; falha no meio desfaz tudo. Os
arquivos não podem controlar a transação (``BEGIN``, ``COMMIT``, ``ROLLBACK``,
``SAVEPOINT``, ``RELEASE``, ``END``, ``VACUUM`` são recusados).

Proteções:

- o SHA-256 de cada migração aplicada é conferido; arquivo alterado depois de
  aplicado é erro (``checksum_divergente``);
- banco com versão maior que a última conhecida pelo app é recusado
  (``banco_mais_novo``), para que uma versão antiga do app não o estrague;
- antes de aplicar migrações pendentes num banco que já tem conteúdo, é feita
  uma cópia com a API de backup do SQLite em
  ``<pasta do banco>/backups/henduran-v<versão>-<AAAAMMDD-HHMMSS>.db``,
  mantendo só as ``BACKUP_KEEP`` mais recentes.
"""

from __future__ import annotations

import hashlib
import logging
import re
import sqlite3
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

from henduran.db.connection import Database, DatabaseError, timestamp, utc_now_iso

log = logging.getLogger("henduran.db")

MIGRATIONS_DIR = Path(__file__).with_name("migrations")
BACKUP_KEEP = 5
BACKUP_PREFIX = "henduran"
_FILE_RE = re.compile(r"^(\d{4})_([a-z0-9_]+)\.sql$")
_BACKUP_RE = re.compile(rf"^{BACKUP_PREFIX}-v(\d+)-(\d{{8}}-\d{{6}})(?:-(\d+))?\.db$")
_FORBIDDEN = ("BEGIN", "COMMIT", "END", "ROLLBACK", "SAVEPOINT", "RELEASE", "VACUUM")

SCHEMA_MIGRATIONS_SQL = """
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    checksum TEXT NOT NULL,
    applied_at TEXT NOT NULL
)
"""


class MigrationError(DatabaseError):
    """Falha de migração; ``code`` estável e mensagem em português."""


@dataclass(frozen=True)
class Migration:
    version: int
    name: str
    sql: str
    checksum: str


@dataclass
class MigrationResult:
    version: int
    applied: list[int] = field(default_factory=list)
    backup: Path | None = None


def load_migrations(folder: Path = MIGRATIONS_DIR) -> list[Migration]:
    """Lê e valida os arquivos de migração (numeração contínua a partir de 1)."""
    items: list[Migration] = []
    for path in sorted(folder.glob("*.sql")):
        m = _FILE_RE.match(path.name)
        if not m:
            raise MigrationError("migracoes_invalidas", f"Nome de migração fora do padrão NNNN_nome.sql: {path.name}")
        data = path.read_bytes()
        items.append(
            Migration(
                version=int(m.group(1)),
                name=m.group(2),
                sql=data.decode("utf-8"),
                checksum=hashlib.sha256(data).hexdigest(),
            )
        )
    for expected, mig in enumerate(items, start=1):
        if mig.version != expected:
            raise MigrationError(
                "migracoes_invalidas",
                f"As migrações devem ser numeradas em sequência a partir de 0001; falta a {expected:04d}.",
            )
    return items


def split_statements(sql: str) -> list[str]:
    """Divide um script em comandos completos, respeitando textos e comentários."""
    statements: list[str] = []
    buffer = ""
    for line in sql.splitlines(keepends=True):
        buffer += line
        if sqlite3.complete_statement(buffer):
            stmt = buffer.strip()
            buffer = ""
            if _strip_comments(stmt).strip().rstrip(";").strip():
                statements.append(stmt)
    if _strip_comments(buffer).strip():
        raise MigrationError("migracao_invalida", "A migração termina com um comando incompleto (falta ';').")
    return statements


def _strip_comments(sql: str) -> str:
    return "\n".join(line.split("--", 1)[0] for line in sql.splitlines())


def _first_word(stmt: str) -> str:
    words = _strip_comments(stmt).split()
    return words[0].upper().rstrip(";") if words else ""


def applied_migrations(db: Database) -> dict[int, sqlite3.Row]:
    db.execute(SCHEMA_MIGRATIONS_SQL)
    rows = db.query_all("SELECT version, name, checksum, applied_at FROM schema_migrations ORDER BY version")
    return {int(r["version"]): r for r in rows}


def schema_version(db: Database) -> int:
    row = db.query_one(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'"
    )
    if row is None:
        return 0
    row = db.query_one("SELECT COALESCE(MAX(version), 0) AS v FROM schema_migrations")
    return int(row["v"]) if row else 0


def _has_content(db: Database) -> bool:
    row = db.query_one(
        "SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
    )
    return bool(row and row["n"])


def backup_database(
    db: Database,
    backups_dir: Path,
    version: int,
    *,
    keep: int = BACKUP_KEEP,
    now: datetime | None = None,
) -> Path:
    """Copia o banco para ``backups_dir`` e apaga os backups além dos ``keep`` mais recentes."""
    backups_dir.mkdir(parents=True, exist_ok=True)
    stamp = timestamp(now)
    target = backups_dir / f"{BACKUP_PREFIX}-v{version}-{stamp}.db"
    n = 1
    while target.exists():
        target = backups_dir / f"{BACKUP_PREFIX}-v{version}-{stamp}-{n}.db"
        n += 1
    db.backup_to(target)
    log.info("backup do banco criado: %s", target.name)
    rotate_backups(backups_dir, keep)
    return target


def rotate_backups(backups_dir: Path, keep: int = BACKUP_KEEP) -> list[Path]:
    """Mantém os ``keep`` backups mais recentes (pela data no nome). Devolve os removidos."""
    found: list[tuple[str, int, Path]] = []
    for path in backups_dir.iterdir():
        m = _BACKUP_RE.match(path.name)
        if m and path.is_file():
            found.append((m.group(2), int(m.group(3) or 0), path))
    found.sort()
    removed: list[Path] = []
    for _, _, path in found[: max(0, len(found) - keep)]:
        try:
            path.unlink()
            removed.append(path)
        except OSError as exc:
            log.warning("não foi possível apagar o backup antigo %s: %s", path.name, exc)
    return removed


def migrate(
    db: Database,
    *,
    migrations: list[Migration] | None = None,
    backups_dir: Path | None = None,
    keep_backups: int = BACKUP_KEEP,
) -> MigrationResult:
    """Confere e aplica as migrações pendentes. Levanta :class:`MigrationError`."""
    known = load_migrations() if migrations is None else migrations
    latest = known[-1].version if known else 0
    by_version = {m.version: m for m in known}
    had_content = _has_content(db)
    applied = applied_migrations(db)
    current = max(applied, default=0)

    if current > latest:
        raise MigrationError(
            "banco_mais_novo",
            f"O banco de dados está na versão {current}, mais nova que a versão {latest} que este app conhece. "
            "Atualize o Henduran; o banco não foi alterado.",
        )
    for version, row in applied.items():
        mig = by_version.get(version)
        if mig is None:
            raise MigrationError("migracao_desconhecida", f"A migração {version:04d} aplicada no banco não existe no app.")
        if row["checksum"] != mig.checksum:
            raise MigrationError(
                "checksum_divergente",
                f"A migração {version:04d}_{mig.name} foi alterada depois de aplicada (SHA-256 diferente). "
                "Migrações aplicadas não podem mudar; crie uma nova.",
            )

    pending = [m for m in known if m.version not in applied]
    result = MigrationResult(version=current)
    if not pending:
        return result

    if had_content:
        folder = backups_dir if backups_dir is not None else db.path.parent / "backups"
        result.backup = backup_database(db, folder, current, keep=keep_backups)

    for mig in pending:
        statements = split_statements(mig.sql)
        for stmt in statements:
            if _first_word(stmt) in _FORBIDDEN:
                raise MigrationError(
                    "migracao_invalida",
                    f"A migração {mig.version:04d}_{mig.name} não pode controlar a transação ({_first_word(stmt)}).",
                )
        try:
            with db.transaction() as tx:
                for stmt in statements:
                    tx.execute(stmt)
                tx.execute(
                    "INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES (?, ?, ?, ?)",
                    (mig.version, mig.name, mig.checksum, utc_now_iso()),
                )
        except sqlite3.Error as exc:
            raise MigrationError(
                "migracao_falhou",
                f"A migração {mig.version:04d}_{mig.name} falhou e foi desfeita: {exc}",
            ) from exc
        log.info("migração aplicada: %04d_%s", mig.version, mig.name)
        result.applied.append(mig.version)
        result.version = mig.version
    return result
