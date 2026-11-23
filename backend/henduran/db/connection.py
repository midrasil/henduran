"""Conexão com um banco SQLite do Henduran (ADR-050 e ADR-075).

A mesma classe serve ao **banco do app** (preferências e metadados) e aos bancos
de jogo (um por Jornada e um por Mundo, ADR-075), com estas diferenças:

- ``synchronous``: ``NORMAL`` no banco do app; ``FULL`` nos bancos de Jornada e de
  Mundo (uma gravação confirmada sobrevive a uma queda de energia).
- ``recover_corrupt``: só o banco do app é recriado quando está corrompido; nos
  bancos de jogo (``recover_corrupt=False``) a corrupção vira
  ``DatabaseError("banco_danificado")`` e **nada** é renomeado, apagado ou recriado.
- ``create``: com ``False``, um arquivo ausente vira ``DatabaseError("banco_ausente")``
  em vez de um banco novo.
- :meth:`Database.attach` anexa outro banco (o Mundo, em modo leitura) em **todas**
  as conexões: a do escritor e as do conjunto de leitura, inclusive as criadas depois.

PRAGMAs aplicados na abertura (escolhas desta fundação, revisáveis):

- ``journal_mode=WAL``: leitores não bloqueiam o escritor e vice-versa; uma
  queda no meio de uma gravação não corrompe o arquivo principal.
- ``synchronous=NORMAL`` (padrão, banco do app): em WAL, preserva a integridade do banco em queda de
  energia; no pior caso perde as últimas transações confirmadas antes do
  *checkpoint*. É a combinação recomendada pelo SQLite para WAL e evita um
  ``fsync`` por transação. Se algum dado futuro exigir durabilidade máxima,
  troque para ``FULL``.
- ``foreign_keys=ON``: o SQLite vem com a checagem desligada por padrão.
- ``busy_timeout=5000`` (ms): espera em vez de falhar com "database is locked"
  quando outra conexão (outro processo ou o *checkpoint*) segura o arquivo.

Concorrência: **um escritor** (uma conexão protegida por um ``RLock``) e um
pequeno conjunto de conexões só de leitura (``query_only``) reaproveitadas
entre threads. Dentro de :meth:`Database.transaction`, as leituras da mesma
thread usam a conexão do escritor e enxergam o que ainda não foi confirmado.
O código assíncrono usa os métodos ``a*`` (``asyncio.to_thread``).

Banco corrompido: um arquivo existente é conferido primeiro por uma conexão
**só de leitura** (uma conexão de escrita fechada sobre um arquivo inválido faz
o SQLite apagar o ``-wal``). Se o arquivo não abrir como SQLite (``SQLITE_NOTADB``)
ou ``PRAGMA quick_check`` não responder ``ok`` (ou der ``SQLITE_CORRUPT``), nada
é apagado (sem ``recover_corrupt``, para aí com ``banco_danificado``). Outros erros (bloqueio, permissão) não contam como corrupção: viram
``DatabaseError("banco_inacessivel")`` sem mexer no arquivo. Na corrupção, as
conexões são fechadas, o arquivo (com
``-wal`` e ``-shm``) é **renomeado** para ``<nome>.corrompido-<AAAAMMDD-HHMMSS>``
e um banco novo é criado; ``recovered`` fica ``True``. Esta política só é
aceitável porque hoje o banco guarda apenas preferências: deve ser revista
quando houver dados de jogo aqui.
"""

from __future__ import annotations

import asyncio
import logging
import re
import sqlite3
import threading
from collections.abc import Callable, Iterable, Iterator
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, TypeVar

log = logging.getLogger("henduran.db")

BUSY_TIMEOUT_MS = 5000
MAX_IDLE_READERS = 4
CORRUPT_SUFFIX = ".corrompido-"
SIDE_FILES = ("-wal", "-shm")
# SQLITE_CORRUPT e SQLITE_NOTADB: só esses códigos contam como banco corrompido.
CORRUPTION_CODES = (11, 26)
SYNCHRONOUS_MODES = ("NORMAL", "FULL")
_ALIAS_RE = re.compile(r"^[a-z][a-z0-9_]{0,30}$")
_RESERVED_ALIASES = ("main", "temp")

T = TypeVar("T")


class DatabaseError(Exception):
    """Erro do banco com ``code`` estável (mensagem em português)."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


def timestamp(now: datetime | None = None) -> str:
    """``AAAAMMDD-HHMMSS`` (hora local), usado em nomes de arquivo."""
    return (now or datetime.now()).strftime("%Y%m%d-%H%M%S")


def utc_now_iso() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def is_corruption(exc: BaseException) -> bool:
    """``True`` se o erro do SQLite é ``SQLITE_CORRUPT`` ou ``SQLITE_NOTADB``."""
    return ((getattr(exc, "sqlite_errorcode", None) or 0) & 0xFF) in CORRUPTION_CODES


def readonly_uri(path: Path) -> str:
    """URI ``file:...?mode=ro`` de um arquivo (caminhos com espaços e acentos são codificados)."""
    return f"{Path(path).resolve().as_uri()}?mode=ro"


def connect_readonly(path: Path) -> sqlite3.Connection:
    """Conexão **só de leitura** a um arquivo existente (não cria o banco, não apaga ``-wal``)."""
    conn = sqlite3.connect(readonly_uri(path), uri=True, timeout=BUSY_TIMEOUT_MS / 1000)
    conn.row_factory = sqlite3.Row
    return conn


class Transaction:
    """Operações dentro de uma transação aberta por :meth:`Database.transaction`."""

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn

    def execute(self, sql: str, params: Iterable[Any] | dict[str, Any] = ()) -> int:
        """Executa um comando e devolve ``rowcount``."""
        return self._conn.execute(sql, params).rowcount

    def executemany(self, sql: str, seq: Iterable[Iterable[Any]]) -> int:
        return self._conn.executemany(sql, seq).rowcount

    def query_all(self, sql: str, params: Iterable[Any] | dict[str, Any] = ()) -> list[sqlite3.Row]:
        return self._conn.execute(sql, params).fetchall()

    def query_one(self, sql: str, params: Iterable[Any] | dict[str, Any] = ()) -> sqlite3.Row | None:
        return self._conn.execute(sql, params).fetchone()


class Database:
    """Banco SQLite (do app, de uma Jornada ou de um Mundo). Seguro entre threads; ver o docstring do módulo."""

    def __init__(
        self,
        path: Path,
        *,
        synchronous: str = "NORMAL",
        recover_corrupt: bool = True,
        create: bool = True,
    ) -> None:
        mode = str(synchronous).upper()
        if mode not in SYNCHRONOUS_MODES:
            raise ValueError(f"synchronous deve ser um de {SYNCHRONOUS_MODES}")
        self.path = Path(path)
        self.synchronous = mode
        self.recover_corrupt = recover_corrupt
        self.recovered = False
        self.recovered_from: Path | None = None
        self._lock = threading.RLock()
        self._owner: int | None = None  # thread com transação aberta
        self._depth = 0
        self._readers: list[sqlite3.Connection] = []
        self._all_readers: list[sqlite3.Connection] = []
        self._readers_lock = threading.Lock()
        self._closed = False
        # Bancos anexados: alias -> URI. Cada conexão guarda o que já anexou.
        self._attachments: dict[str, str] = {}
        self._attach_lock = threading.Lock()
        self._attached: dict[int, set[str]] = {}
        if not create and not self.path.is_file():
            raise DatabaseError("banco_ausente", f"O arquivo do banco não existe: {self.path.name}")
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._writer = self._open_checked()
        self._attached[id(self._writer)] = set()

    # ---------------------------------------------------------------- abertura
    def _connect(self, *, readonly: bool = False) -> sqlite3.Connection:
        conn = sqlite3.connect(
            str(self.path),
            uri=True,  # permite ATTACH com URI (file:...?mode=ro); um caminho comum continua valendo
            isolation_level=None,  # transações explícitas (BEGIN IMMEDIATE)
            check_same_thread=False,  # o acesso é serializado aqui
            timeout=BUSY_TIMEOUT_MS / 1000,
        )
        conn.row_factory = sqlite3.Row
        try:
            conn.execute(f"PRAGMA busy_timeout = {BUSY_TIMEOUT_MS}")
            conn.execute("PRAGMA foreign_keys = ON")
            if readonly:
                conn.execute("PRAGMA query_only = ON")
        except BaseException:
            conn.close()
            raise
        return conn

    def _configure_writer(self, conn: sqlite3.Connection) -> None:
        mode = conn.execute("PRAGMA journal_mode = WAL").fetchone()[0]
        if str(mode).lower() != "wal":
            raise DatabaseError("wal_indisponivel", f"O banco não aceitou o modo WAL (ficou em {mode}).")
        conn.execute(f"PRAGMA synchronous = {self.synchronous}")

    @staticmethod
    def _quick_check(conn: sqlite3.Connection) -> str | None:
        """``None`` se ``quick_check`` respondeu ``ok``; senão a descrição do problema.

        Erros que não são de corrupção viram :class:`DatabaseError` ``banco_inacessivel``.
        """
        try:
            result = [str(r[0]) for r in conn.execute("PRAGMA quick_check").fetchall()]
        except sqlite3.DatabaseError as exc:
            if ((getattr(exc, "sqlite_errorcode", None) or 0) & 0xFF) not in CORRUPTION_CODES:
                # Bloqueado, sem permissão, disco cheio...: não é corrupção; não mexe no arquivo.
                raise DatabaseError("banco_inacessivel", f"Não foi possível abrir o banco de dados: {exc}") from exc
            return str(exc)
        return None if result == ["ok"] else "; ".join(result[:5])

    def _probe(self) -> str | None:
        """Confere um arquivo existente com uma conexão **só de leitura**.

        Uma conexão de escrita fechada sobre um arquivo inválido faz o SQLite
        apagar o ``-wal`` ao lado; a de leitura não toca em nada.
        """
        try:
            conn = connect_readonly(self.path)
        except sqlite3.DatabaseError as exc:
            if is_corruption(exc):
                return str(exc)
            raise DatabaseError("banco_inacessivel", f"Não foi possível abrir o banco de dados: {exc}") from exc
        try:
            return self._quick_check(conn)
        finally:
            conn.close()

    def _open_checked(self) -> sqlite3.Connection:
        if self.path.is_dir():
            raise DatabaseError("banco_inacessivel", f"O caminho do banco é uma pasta: {self.path.name}")
        # Sem recuperação (bancos de jogo), todo arquivo existente é conferido, mesmo vazio.
        probed = self.path.is_file() and (self.path.stat().st_size > 0 or not self.recover_corrupt)
        problem = self._probe() if probed else None
        if problem is None:
            try:
                conn = self._connect()
            except sqlite3.DatabaseError as exc:
                raise DatabaseError("banco_inacessivel", f"Não foi possível abrir o banco de dados: {exc}") from exc
            try:
                # O arquivo existente já foi conferido; um arquivo novo é conferido aqui.
                problem = None if probed else self._quick_check(conn)
                if problem is None:
                    self._configure_writer(conn)
                    return conn
            except BaseException:
                conn.close()
                raise
            conn.close()
        if not self.recover_corrupt:
            log.error("banco %s danificado (%s); nada foi alterado", self.path.name, problem)
            raise DatabaseError("banco_danificado", f"O banco {self.path.name} está danificado: {problem}")
        self._quarantine(problem)
        conn = self._connect()
        self._configure_writer(conn)
        return conn

    def _quarantine(self, problem: str) -> None:
        stamp = timestamp()
        target = self.path.with_name(f"{self.path.name}{CORRUPT_SUFFIX}{stamp}")
        n = 1
        while target.exists():
            target = self.path.with_name(f"{self.path.name}{CORRUPT_SUFFIX}{stamp}-{n}")
            n += 1
        self.path.replace(target)
        for side in SIDE_FILES:
            src = self.path.with_name(self.path.name + side)
            if src.exists():
                src.replace(target.with_name(target.name + side))
        self.recovered = True
        self.recovered_from = target
        log.error(
            "banco %s corrompido (%s); arquivo preservado como %s e um banco novo foi criado",
            self.path.name,
            problem,
            target.name,
        )

    # ------------------------------------------------------------ transações
    def _check_open(self) -> None:
        if self._closed:
            raise DatabaseError("banco_fechado", "O banco de dados já foi fechado.")

    @contextmanager
    def transaction(self) -> Iterator[Transaction]:
        """Transação de escrita (``BEGIN IMMEDIATE``); confirma no fim, desfaz em exceção.

        Aninhar na mesma thread usa ``SAVEPOINT``: a exceção interna desfaz só o
        trecho interno se for tratada; se propagar, a transação externa é desfeita.
        """
        with self._lock:
            self._check_open()
            conn = self._writer
            if self._depth:
                name = f"sp{self._depth}"
                conn.execute(f"SAVEPOINT {name}")
                self._depth += 1
                try:
                    yield Transaction(conn)
                except BaseException:
                    conn.execute(f"ROLLBACK TO {name}")
                    conn.execute(f"RELEASE {name}")
                    raise
                else:
                    conn.execute(f"RELEASE {name}")
                finally:
                    self._depth -= 1
                return
            conn.execute("BEGIN IMMEDIATE")
            self._owner = threading.get_ident()
            self._depth = 1
            try:
                yield Transaction(conn)
            except BaseException:
                if conn.in_transaction:
                    conn.execute("ROLLBACK")
                raise
            else:
                conn.execute("COMMIT")
            finally:
                self._depth = 0
                self._owner = None

    def execute(self, sql: str, params: Iterable[Any] | dict[str, Any] = ()) -> int:
        """Comando de escrita isolado (em sua própria transação, ou na aberta pela thread)."""
        with self.transaction() as tx:
            return tx.execute(sql, params)

    def executemany(self, sql: str, seq: Iterable[Iterable[Any]]) -> int:
        with self.transaction() as tx:
            return tx.executemany(sql, seq)

    # --------------------------------------------------------------- leitura
    @contextmanager
    def _reader(self) -> Iterator[sqlite3.Connection]:
        if self._owner == threading.get_ident():
            yield self._writer  # enxerga a transação aberta por esta thread
            return
        self._check_open()
        with self._readers_lock:
            conn = self._readers.pop() if self._readers else None
        if conn is None:
            conn = self._connect(readonly=True)
            with self._readers_lock:
                self._all_readers.append(conn)
                self._attached[id(conn)] = set()
        try:
            self._sync_attachments(conn)  # anexos novos chegam aqui, antes do uso
        except BaseException:
            self._discard_reader(conn)
            raise
        try:
            yield conn
        finally:
            with self._readers_lock:
                if self._closed:
                    pass
                elif len(self._readers) < MAX_IDLE_READERS:
                    self._readers.append(conn)
                else:
                    self._all_readers.remove(conn)
                    self._attached.pop(id(conn), None)
                    conn.close()

    def _discard_reader(self, conn: sqlite3.Connection) -> None:
        with self._readers_lock:
            if conn in self._readers:
                self._readers.remove(conn)
            if conn in self._all_readers:
                self._all_readers.remove(conn)
            self._attached.pop(id(conn), None)
        try:
            conn.close()
        except sqlite3.Error:
            pass

    def query_all(self, sql: str, params: Iterable[Any] | dict[str, Any] = ()) -> list[sqlite3.Row]:
        with self._reader() as conn:
            return conn.execute(sql, params).fetchall()

    def query_one(self, sql: str, params: Iterable[Any] | dict[str, Any] = ()) -> sqlite3.Row | None:
        with self._reader() as conn:
            return conn.execute(sql, params).fetchone()

    # ---------------------------------------------------------------- anexos
    def attach(self, path: Path, alias: str, *, read_only: bool = True) -> None:
        """Anexa outro banco sob ``alias`` em todas as conexões (as atuais e as futuras).

        Com ``read_only`` (padrão), o anexo usa a URI ``file:...?mode=ro``: qualquer
        escrita por ``alias.tabela`` falha com "attempt to write a readonly database",
        inclusive na conexão do escritor. O arquivo precisa existir. Cada conexão de
        leitura recebe o anexo na thread que a usa, antes do próximo uso (nunca
        enquanto outra thread a usa).
        """
        if not isinstance(alias, str) or not _ALIAS_RE.match(alias) or alias in _RESERVED_ALIASES:
            raise ValueError("alias de banco anexado inválido")
        target = Path(path)
        if not target.is_file():
            raise DatabaseError("banco_ausente", f"O banco a anexar não existe: {target.name}")
        uri = readonly_uri(target) if read_only else target.resolve().as_uri()
        with self._lock:
            self._check_open()
            if self._depth:
                raise DatabaseError("anexo_em_transacao", "Não é possível anexar um banco dentro de uma transação.")
            if alias in self._attachments:
                raise DatabaseError("alias_em_uso", f"Já existe um banco anexado como {alias}.")
            with self._attach_lock:
                self._attachments[alias] = uri
            try:
                self._sync_attachments(self._writer)
            except BaseException:
                with self._attach_lock:
                    del self._attachments[alias]
                raise

    def attached(self) -> dict[str, str]:
        """Alias -> URI dos bancos anexados."""
        with self._attach_lock:
            return dict(self._attachments)

    def _sync_attachments(self, conn: sqlite3.Connection) -> None:
        done = self._attached.setdefault(id(conn), set())
        with self._attach_lock:
            wanted = list(self._attachments.items())
        for alias, uri in wanted:
            if alias in done:
                continue
            try:
                conn.execute(f"ATTACH DATABASE ? AS {alias}", (uri,))
            except sqlite3.Error as exc:
                raise DatabaseError("anexo_falhou", f"Não foi possível anexar o banco {alias}: {exc}") from exc
            done.add(alias)

    # ---------------------------------------------------------- diagnóstico
    def pragma(self, name: str) -> Any:
        """Valor de um PRAGMA na conexão do escritor (diagnóstico e testes)."""
        if not name.replace("_", "").isalnum():
            raise ValueError("nome de PRAGMA inválido")
        with self._lock:
            self._check_open()
            row = self._writer.execute(f"PRAGMA {name}").fetchone()
            return None if row is None else row[0]

    def backup_to(self, dest: Path) -> None:
        """Cópia consistente com a API de backup do SQLite (não copia o arquivo cru)."""
        with self._lock:
            self._check_open()
            target = sqlite3.connect(str(dest))
            try:
                self._writer.backup(target)
            finally:
                target.close()

    # ------------------------------------------------------------ fechamento
    @property
    def closed(self) -> bool:
        return self._closed

    def close(self) -> None:
        """Faz *checkpoint* do WAL e fecha todas as conexões (libera o arquivo no Windows)."""
        with self._lock:
            if self._closed:
                return
            self._closed = True
            with self._readers_lock:
                readers = list(self._all_readers)
                self._readers.clear()
                self._all_readers.clear()
            for conn in readers:
                try:
                    conn.close()
                except sqlite3.Error:
                    pass
            self._attached.clear()
            try:
                self._writer.execute("PRAGMA main.wal_checkpoint(TRUNCATE)")  # só o banco principal
            except sqlite3.Error as exc:
                log.warning("checkpoint do WAL falhou ao fechar: %s", exc)
            self._writer.close()

    def __enter__(self) -> Database:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    # ------------------------------------------------------ fachada assíncrona
    async def run(self, fn: Callable[..., T], *args: Any) -> T:
        """Roda ``fn(*args)`` numa thread (não bloqueia o laço de eventos)."""
        return await asyncio.to_thread(fn, *args)

    async def arun_transaction(self, fn: Callable[[Transaction], T]) -> T:
        """Roda ``fn(tx)`` dentro de uma transação, numa thread."""

        def work() -> T:
            with self.transaction() as tx:
                return fn(tx)

        return await asyncio.to_thread(work)

    async def aexecute(self, sql: str, params: Iterable[Any] | dict[str, Any] = ()) -> int:
        return await asyncio.to_thread(self.execute, sql, params)

    async def aquery_all(self, sql: str, params: Iterable[Any] | dict[str, Any] = ()) -> list[sqlite3.Row]:
        return await asyncio.to_thread(self.query_all, sql, params)

    async def aquery_one(self, sql: str, params: Iterable[Any] | dict[str, Any] = ()) -> sqlite3.Row | None:
        return await asyncio.to_thread(self.query_one, sql, params)
