"""Migrações dos bancos SQLite, só para frente, em **conjuntos** separados (ADR-075).

Conjuntos: ``app`` (banco do app), ``journey`` (um banco por Jornada) e ``world``
(um banco por Mundo). Cada conjunto tem sua pasta ``henduran/db/migrations/<conjunto>/``
e sua numeração própria.

Formato: arquivos ``NNNN_nome.sql``, numerados de 1 em diante, sem lacunas. Cada arquivo é dividido em comandos
(``sqlite3.complete_statement``) e executado **numa única transação** junto
com o registro em ``schema_migrations``; falha no meio desfaz tudo. Os
arquivos não podem controlar a transação (``BEGIN``, ``COMMIT``, ``ROLLBACK``,
``SAVEPOINT``, ``RELEASE``, ``END``, ``VACUUM`` são recusados).

Proteções:

- o SHA-256 de cada migração aplicada é conferido; arquivo alterado depois de
  aplicado é erro (``checksum_divergente``). O SHA-256 é calculado com os finais
  de linha normalizados para LF, para não divergir entre máquinas por causa
  do ``core.autocrlf`` do Git; um registro antigo feito sobre o arquivo em CRLF
  continua aceito (mesmo conteúdo lógico);
- banco com versão maior que a última conhecida pelo app é recusado
  (``banco_mais_novo``), para que uma versão antiga do app não o estrague;
- antes de aplicar migrações pendentes num banco que já tem conteúdo, é feita
  uma cópia com a API de backup do SQLite em
  ``<pasta do banco>/backups/<prefixo>-v<versão>-<AAAAMMDD-HHMMSS>.db``
  (prefixo ``henduran``, ``journey`` ou ``world``, conforme o conjunto),
  mantendo só as ``BACKUP_KEEP`` mais recentes daquele prefixo.
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

MIGRATIONS_ROOT = Path(__file__).with_name("migrations")
MIGRATION_SETS = ("app", "journey", "world")
MIGRATIONS_DIR = MIGRATIONS_ROOT / "app"
BACKUP_KEEP = 5
BACKUP_PREFIX = "henduran"
# Prefixo dos backups pré-migração de cada conjunto.
BACKUP_PREFIXES = {"app": "henduran", "journey": "journey", "world": "world"}
_FILE_RE = re.compile(r"^(\d{4})_([a-z0-9_]+)\.sql$")
_PREFIX_RE = re.compile(r"^[a-z][a-z0-9_]*$")
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
    # Outros SHA-256 do mesmo conteúdo lógico (o arquivo com finais de linha CRLF),
    # aceitos ao conferir registros antigos. Ver :func:`checksum_variants`.
    accepted_checksums: tuple[str, ...] = ()

    def matches(self, checksum: str) -> bool:
        return checksum == self.checksum or checksum in self.accepted_checksums


@dataclass
class MigrationResult:
    version: int
    applied: list[int] = field(default_factory=list)
    backup: Path | None = None


def normalize_newlines(data: bytes) -> bytes:
    """Finais de linha ``\\r\\n`` e ``\\r`` viram ``\\n``."""
    return data.replace(b"\r\n", b"\n").replace(b"\r", b"\n")


def migration_checksum(data: bytes) -> str:
    """SHA-256 do arquivo de migração com os finais de linha normalizados para ``\\n``."""
    return hashlib.sha256(normalize_newlines(data)).hexdigest()


def checksum_variants(data: bytes) -> tuple[str, ...]:
    """SHA-256 aceitos além do normalizado: o do arquivo em CRLF.

    Antes da normalização o SHA-256 era calculado sobre os bytes crus; num clone
    com ``core.autocrlf=true`` o arquivo estava em CRLF e esse valor pode estar
    gravado em bancos já criados. É o mesmo conteúdo lógico, então continua aceito.
    """
    lf = normalize_newlines(data)
    crlf = hashlib.sha256(lf.replace(b"\n", b"\r\n")).hexdigest()
    return () if crlf == hashlib.sha256(lf).hexdigest() else (crlf,)


def migrations_dir(migration_set: str) -> Path:
    if migration_set not in MIGRATION_SETS:
        raise MigrationError("conjunto_desconhecido", f"Conjunto de migrações desconhecido: {migration_set!r}.")
    return MIGRATIONS_ROOT / migration_set


def load_migration_set(migration_set: str) -> list[Migration]:
    """Migrações de um conjunto (``app``, ``journey`` ou ``world``)."""
    return load_migrations(migrations_dir(migration_set))


def latest_version(migration_set: str) -> int:
    known = load_migration_set(migration_set)
    return known[-1].version if known else 0


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
                sql=normalize_newlines(data).decode("utf-8"),
                checksum=migration_checksum(data),
                accepted_checksums=checksum_variants(data),
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


def _backup_re(prefix: str) -> re.Pattern[str]:
    if not _PREFIX_RE.match(prefix):
        raise ValueError("prefixo de backup inválido")
    return re.compile(rf"^{re.escape(prefix)}-v(\d+)-(\d{{8}}-\d{{6}})(?:-(\d+))?\.db$")


def backup_database(
    db: Database,
    backups_dir: Path,
    version: int,
    *,
    keep: int = BACKUP_KEEP,
    now: datetime | None = None,
    prefix: str = BACKUP_PREFIX,
) -> Path:
    """Copia o banco para ``backups_dir`` e apaga os backups além dos ``keep`` mais recentes."""
    _backup_re(prefix)
    backups_dir.mkdir(parents=True, exist_ok=True)
    stamp = timestamp(now)
    target = backups_dir / f"{prefix}-v{version}-{stamp}.db"
    n = 1
    while target.exists():
        target = backups_dir / f"{prefix}-v{version}-{stamp}-{n}.db"
        n += 1
    db.backup_to(target)
    log.info("backup do banco criado: %s", target.name)
    rotate_backups(backups_dir, keep, prefix=prefix)
    return target


def list_backup_files(backups_dir: Path, prefix: str = BACKUP_PREFIX) -> list[tuple[str, int, int, Path]]:
    """Backups de ``prefix`` em ``backups_dir``: ``(data, sequência, versão, caminho)``, do mais antigo ao mais novo."""
    pattern = _backup_re(prefix)
    found: list[tuple[str, int, int, Path]] = []
    if not backups_dir.is_dir():
        return found
    for path in backups_dir.iterdir():
        m = pattern.match(path.name)
        if m and path.is_file():
            found.append((m.group(2), int(m.group(3) or 0), int(m.group(1)), path))
    found.sort(key=lambda item: (item[0], item[1]))
    return found


def rotate_backups(backups_dir: Path, keep: int = BACKUP_KEEP, *, prefix: str = BACKUP_PREFIX) -> list[Path]:
    """Mantém os ``keep`` backups mais recentes (pela data no nome). Devolve os removidos."""
    found = list_backup_files(backups_dir, prefix)
    removed: list[Path] = []
    for _, _, _, path in found[: max(0, len(found) - keep)]:
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
    migration_set: str = "app",
    backups_dir: Path | None = None,
    keep_backups: int = BACKUP_KEEP,
    backup_prefix: str | None = None,
) -> MigrationResult:
    """Confere e aplica as migrações pendentes. Levanta :class:`MigrationError`.

    ``migration_set`` escolhe o conjunto (``app``, ``journey`` ou ``world``) e o
    prefixo dos backups; ``migrations`` substitui a lista (testes).
    """
    if migration_set not in MIGRATION_SETS:
        raise MigrationError("conjunto_desconhecido", f"Conjunto de migrações desconhecido: {migration_set!r}.")
    known = load_migration_set(migration_set) if migrations is None else migrations
    prefix = backup_prefix or BACKUP_PREFIXES[migration_set]
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
        if not mig.matches(row["checksum"]):
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
        result.backup = backup_database(db, folder, current, keep=keep_backups, prefix=prefix)

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
