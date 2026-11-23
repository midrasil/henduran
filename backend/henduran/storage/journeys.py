"""Jornadas: um banco por Jornada em ``journeys\\<id>\\journey.db`` (ADR-075).

Pasta de cada Jornada::

    journeys/<id>/
        journey.db      banco da Jornada (WAL, synchronous=FULL), com journey_meta
        journey.lock    bloqueio do sistema operacional enquanto a Jornada está aberta
        assets/         anexos grandes (ADR-050; estratégia ainda em aberto)
        backups/        cópias feitas antes de migrar (journey-v<versão>-<data>.db, as 5 últimas)

Regras:

- **Uma Jornada aberta por vez** neste processo, e um bloqueio de arquivo do
  sistema operacional (``journey.lock``) contra uma segunda instância do app. O
  bloqueio é liberado pelo sistema se o processo morrer.
- O Mundo fixado (``world_id``, ``world_version``) é anexado **em modo leitura**
  sob o alias ``world``; só o banco da Jornada recebe escrita.
- A lista lê o ``journey_meta`` de cada Jornada em modo somente leitura e sem
  migrar; uma Jornada que não abre aparece com ``status`` e código de erro, e
  nunca derruba a lista.
- Banco danificado **nunca é recriado nem apagado**: vira :class:`JourneyDamaged`.
  :meth:`JourneyStore.restore_backup` é a única forma de trocá-lo, e é explícita.
"""

from __future__ import annotations

import logging
import os
import re
import shutil
import threading
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Any

from henduran.db.connection import SIDE_FILES, Database, DatabaseError, timestamp, utc_now_iso
from henduran.db.migrations import MigrationError, latest_version, list_backup_files, migrate
from henduran.paths import DataPaths, InvalidIdError, new_id, validate_id
from henduran.storage.errors import JourneyDamaged, StorageError, WorldDamaged
from henduran.storage.lock import FileLock, LockBusy
from henduran.storage.snapshot import read_snapshot
from henduran.storage.worlds import NAME_MAX, WorldStore, WorldSummary, checked_id, clean_name

if TYPE_CHECKING:
    from henduran.settings import SettingsStore

log = logging.getLogger("henduran.storage")

JOURNEY_SET = "journey"
JOURNEY_SYNCHRONOUS = "FULL"
WORLD_ALIAS = "world"
BACKUP_PREFIX = "journey"
DAMAGED_SUFFIX = ".danificado-"
_BACKUP_NAME_RE = re.compile(r"^journey-v\d+-\d{8}-\d{6}(?:-\d+)?\.db$")
_DAMAGE_CODES = ("banco_danificado", "banco_ausente", "banco_vazio", "sem_resumo")
_UNSET: Any = object()

# Uma Jornada aberta por vez neste processo (entre todas as instâncias de JourneyStore).
_process_lock = threading.Lock()
_process_open: dict[str, str | None] = {"id": None}


@dataclass
class JourneySummary:
    """Resumo de uma Jornada para a lista.

    ``status``: ``ok``; ``danificada`` (o banco não abre ou não tem resumo);
    ``mais_nova`` (esquema mais novo que o app); ``sem_mundo`` (o Mundo ou a
    versão fixada não existem, ou o Mundo está danificado). Fora de ``ok``,
    ``error_code`` e ``error_message`` explicam.
    """

    id: str
    name: str | None
    character_name: str | None
    location: str | None
    day_period: str | None
    world_id: str | None
    world_version: int | None
    world_name: str | None
    created_at: str | None
    last_saved_at: str | None
    schema_version: int
    status: str
    error_code: str | None = None
    error_message: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class BackupInfo:
    name: str
    schema_version: int
    created: str  # AAAAMMDD-HHMMSS (hora local), do nome do arquivo
    size_bytes: int

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class RestoreResult:
    restored_from: str
    preserved_as: Path | None  # o arquivo anterior, renomeado (nunca apagado)


def _optional_text(value: Any, field_name: str) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str) or len(value.strip()) > NAME_MAX or "\x00" in value:
        raise StorageError("nome_invalido", f"{field_name} deve ser texto de até {NAME_MAX} caracteres ou nulo.")
    return value.strip() or None


class OpenJourney:
    """Jornada aberta: banco da Jornada com o Mundo anexado em leitura (alias ``world``).

    Use como *context manager*; ``close()`` fecha o banco e libera o bloqueio.
    """

    def __init__(self, journey_id: str, db: Database, lock: FileLock, world_id: str, world_version: int) -> None:
        self.id = journey_id
        self.db = db
        self.world_id = world_id
        self.world_version = world_version
        self._lock = lock
        self._closed = False

    @property
    def closed(self) -> bool:
        return self._closed

    def summary(self) -> dict[str, Any]:
        row = self.db.query_one(
            "SELECT id, name, character_name, location, day_period, world_id, world_version, created_at, last_saved_at "
            "FROM journey_meta"
        )
        return dict(row) if row is not None else {}

    def world_content(self) -> Any:
        """Conteúdo (JSON decodificado) da versão fixada do Mundo, lido pelo anexo."""
        import json

        row = self.db.query_one(
            f"SELECT content FROM {WORLD_ALIAS}.world_versions WHERE version = ?", (self.world_version,)
        )
        return None if row is None else json.loads(row["content"])

    def update_summary(
        self,
        *,
        name: Any = _UNSET,
        character_name: Any = _UNSET,
        location: Any = _UNSET,
        day_period: Any = _UNSET,
    ) -> dict[str, Any]:
        """Atualiza campos do resumo numa transação. ``None`` limpa os campos opcionais."""
        changes: dict[str, Any] = {}
        if name is not _UNSET:
            changes["name"] = clean_name(name)
        for key, value in (("character_name", character_name), ("location", location), ("day_period", day_period)):
            if value is not _UNSET:
                changes[key] = _optional_text(value, key)
        if changes:
            assignments = ", ".join(f"{key} = ?" for key in changes)  # chaves fixas acima
            with self.db.transaction() as tx:
                tx.execute(f"UPDATE journey_meta SET {assignments}", tuple(changes.values()))
        return self.summary()

    def touch_saved(self) -> str:
        """Grava ``last_saved_at`` (UTC, ISO 8601) numa transação e devolve o valor."""
        now = utc_now_iso()
        with self.db.transaction() as tx:
            tx.execute("UPDATE journey_meta SET last_saved_at = ?", (now,))
        return now

    def close(self) -> None:
        if self._closed:
            return
        self._closed = True
        try:
            self.db.close()
        finally:
            self._lock.release()
            with _process_lock:
                if _process_open["id"] == self.id:
                    _process_open["id"] = None

    def __enter__(self) -> OpenJourney:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()


class JourneyStore:
    """Criação, listagem, abertura, restauração e exclusão de Jornadas."""

    def __init__(self, paths: DataPaths, worlds: WorldStore, settings: SettingsStore | None = None) -> None:
        self.paths = paths
        self.worlds = worlds
        self.settings = settings

    # ------------------------------------------------------------- última jogada
    @property
    def last_journey_id(self) -> str | None:
        return None if self.settings is None else self.settings.get("last_journey_id")

    def set_last_played(self, journey_id: str | None) -> None:
        """Grava a última Jornada jogada nas preferências do app (``None`` limpa)."""
        if self.settings is None:
            raise StorageError("sem_preferencias", "As preferências do app não estão disponíveis.")
        value = None if journey_id is None else checked_id(journey_id)
        self.settings.update(last_journey_id=value)

    @property
    def open_journey_id(self) -> str | None:
        """Jornada aberta neste processo (ou ``None``)."""
        with _process_lock:
            return _process_open["id"]

    # ------------------------------------------------------------- criação
    def create_journey(self, name: str, world_id: str, world_version: int = 1) -> str:
        """Cria a Jornada vinculada a ``(world_id, world_version)``. Devolve o id."""
        name = clean_name(name)
        wid = checked_id(world_id)
        self.worlds.require_version(wid, world_version)
        journey_id = new_id()
        folder = self.paths.journey_dir(journey_id)
        folder.mkdir(parents=True, exist_ok=False)
        db: Database | None = None
        try:
            self.paths.journey_assets_dir(journey_id).mkdir()
            self.paths.journey_backups_dir(journey_id).mkdir()
            db = Database(self.paths.journey_db_file(journey_id), synchronous=JOURNEY_SYNCHRONOUS, recover_corrupt=False)
            migrate(db, migration_set=JOURNEY_SET, backups_dir=self.paths.journey_backups_dir(journey_id))
            with db.transaction() as tx:
                tx.execute(
                    "INSERT INTO journey_meta (id, name, world_id, world_version, created_at) VALUES (?, ?, ?, ?, ?)",
                    (journey_id, name, wid, world_version, utc_now_iso()),
                )
        except BaseException:
            if db is not None:
                db.close()
                db = None
            shutil.rmtree(folder, ignore_errors=True)  # pasta recém-criada por esta chamada
            raise
        finally:
            if db is not None:
                db.close()
        log.info("jornada criada: %s (mundo %s v%d)", journey_id, wid, world_version)
        return journey_id

    # ------------------------------------------------------------- lista
    def journey_ids(self) -> list[str]:
        root = self.paths.journeys_dir
        if not root.is_dir():
            return []
        ids: list[str] = []
        for entry in root.iterdir():
            try:
                jid = validate_id(entry.name)
            except InvalidIdError:
                continue  # pastas estranhas são ignoradas
            if entry.is_dir() and jid == entry.name:
                ids.append(jid)
        return ids

    def _summarize(self, journey_id: str, worlds: dict[str, WorldSummary], latest: int) -> JourneySummary:
        snap = read_snapshot(self.paths.journey_db_file(journey_id), "journey_meta")
        meta = snap.meta or {}
        world_id = meta.get("world_id")
        world_version = meta.get("world_version")
        world = worlds.get(world_id) if isinstance(world_id, str) else None
        summary = JourneySummary(
            id=journey_id,
            name=meta.get("name"),
            character_name=meta.get("character_name"),
            location=meta.get("location"),
            day_period=meta.get("day_period"),
            world_id=world_id,
            world_version=world_version,
            world_name=world.name if world is not None else None,
            created_at=meta.get("created_at"),
            last_saved_at=meta.get("last_saved_at"),
            schema_version=snap.version,
            status="ok",
        )

        def mark(status: str, code: str, message: str | None) -> JourneySummary:
            summary.status, summary.error_code, summary.error_message = status, code, message
            return summary

        if snap.problem is not None:
            return mark("danificada", snap.problem, snap.detail)
        if snap.version > latest:
            return mark(
                "mais_nova",
                "banco_mais_novo",
                f"A Jornada está na versão de esquema {snap.version}; este app conhece até a {latest}. Atualize o Henduran.",
            )
        if meta.get("id") != journey_id:
            return mark("danificada", "id_divergente", "O identificador gravado na Jornada não corresponde à pasta.")
        if world is None:
            return mark("sem_mundo", "mundo_ausente", "O Mundo desta Jornada não existe mais.")
        if world.status == "mais_novo":
            return mark("sem_mundo", "mundo_mais_novo", world.error_message)
        if world.status != "ok":
            return mark("sem_mundo", "mundo_danificado", world.error_message or "O Mundo desta Jornada não pode ser lido.")
        if world_version not in world.versions:
            return mark("sem_mundo", "versao_ausente", f"O Mundo não tem a versão {world_version} usada pela Jornada.")
        return summary

    def list_journeys(self) -> list[JourneySummary]:
        """Resumo de todas as Jornadas, do último salvamento mais recente ao mais antigo.

        Lê em modo somente leitura e sem migrar. Sem salvamento, vale a data de criação;
        Jornadas sem datas (danificadas) vão para o fim.
        """
        worlds = {w.id: w for w in self.worlds.list_worlds()}
        latest = latest_version(JOURNEY_SET)
        out = []
        for jid in self.journey_ids():
            try:
                out.append(self._summarize(jid, worlds, latest))
            except Exception as exc:  # noqa: BLE001 — uma Jornada nunca derruba a lista
                log.exception("falha inesperada ao ler a jornada %s", jid)
                out.append(
                    JourneySummary(
                        id=jid, name=None, character_name=None, location=None, day_period=None, world_id=None,
                        world_version=None, world_name=None, created_at=None, last_saved_at=None, schema_version=0,
                        status="danificada", error_code="erro_inesperado", error_message=str(exc),
                    )
                )
        out.sort(key=lambda s: (str(s.last_saved_at or s.created_at or ""), s.id), reverse=True)
        return out

    def get_summary(self, journey_id: str) -> JourneySummary:
        jid = checked_id(journey_id)
        if not self.paths.journey_dir(jid).is_dir():
            raise StorageError("jornada_nao_encontrada", "Jornada não encontrada.")
        worlds = {w.id: w for w in self.worlds.list_worlds()}
        return self._summarize(jid, worlds, latest_version(JOURNEY_SET))

    # ------------------------------------------------------------- abertura
    def _claim_process_slot(self, journey_id: str) -> None:
        with _process_lock:
            current = _process_open["id"]
            if current is not None:
                if current == journey_id:
                    raise StorageError("jornada_ja_aberta", "Esta Jornada já está aberta.")
                raise StorageError("jornada_ja_aberta", "Outra Jornada já está aberta; feche-a antes.")
            _process_open["id"] = journey_id

    @staticmethod
    def _release_process_slot(journey_id: str) -> None:
        with _process_lock:
            if _process_open["id"] == journey_id:
                _process_open["id"] = None

    def _lock_for(self, journey_id: str) -> FileLock:
        lock = FileLock(self.paths.journey_lock_file(journey_id))
        try:
            lock.acquire()
        except LockBusy as exc:
            raise StorageError(
                "jornada_bloqueada",
                "A Jornada está aberta em outra instância do Henduran. Feche-a lá antes de abrir aqui.",
                path=lock.path,
            ) from exc
        return lock

    def _open_db(self, journey_id: str) -> Database:
        """Confere em leitura, abre para escrita e migra. Nada é recriado em caso de dano."""
        path = self.paths.journey_db_file(journey_id)
        snap = read_snapshot(path, "journey_meta")
        if snap.problem in _DAMAGE_CODES:
            raise JourneyDamaged(snap.problem, path, snap.detail)
        if snap.problem == "banco_inacessivel":
            raise StorageError("banco_inacessivel", snap.detail or "O banco da Jornada não pôde ser lido.", path=path)
        latest = latest_version(JOURNEY_SET)
        if snap.version > latest:
            raise MigrationError(
                "banco_mais_novo",
                f"A Jornada está na versão de esquema {snap.version}, mais nova que a versão {latest} que este app "
                "conhece. Atualize o Henduran; a Jornada não foi alterada.",
            )
        if (snap.meta or {}).get("id") != journey_id:
            raise JourneyDamaged("id_divergente", path, "O identificador gravado na Jornada não corresponde à pasta.")
        try:
            db = Database(path, synchronous=JOURNEY_SYNCHRONOUS, recover_corrupt=False, create=False)
        except DatabaseError as exc:
            if exc.code in ("banco_danificado", "banco_ausente"):
                raise JourneyDamaged(exc.code, path, str(exc)) from exc
            raise
        try:
            migrate(db, migration_set=JOURNEY_SET, backups_dir=self.paths.journey_backups_dir(journey_id))
        except BaseException:
            db.close()
            raise
        return db

    def open_journey(self, journey_id: str) -> OpenJourney:
        """Abre a Jornada (só uma por vez), migra o banco e anexa o Mundo fixado em leitura.

        Levanta :class:`StorageError` (``jornada_nao_encontrada``, ``jornada_ja_aberta``,
        ``jornada_bloqueada``, ``mundo_ausente``, ``versao_ausente``, ``mundo_mais_novo``),
        :class:`JourneyDamaged`, :class:`WorldDamaged` ou ``MigrationError``.
        """
        jid = checked_id(journey_id)
        if not self.paths.journey_dir(jid).is_dir():
            raise StorageError("jornada_nao_encontrada", "Jornada não encontrada.")
        self._claim_process_slot(jid)
        lock: FileLock | None = None
        db: Database | None = None
        try:
            lock = self._lock_for(jid)
            db = self._open_db(jid)
            row = db.query_one("SELECT world_id, world_version FROM journey_meta")
            world_id, world_version = row["world_id"], row["world_version"]
            try:
                world_id = validate_id(world_id)
            except InvalidIdError as exc:
                raise JourneyDamaged("sem_resumo", db.path, "O Mundo gravado na Jornada é inválido.") from exc
            world_path = self.worlds.prepare_for_attach(world_id)
            db.attach(world_path, WORLD_ALIAS, read_only=True)
            found = db.query_one(
                f"SELECT 1 FROM {WORLD_ALIAS}.world_versions WHERE version = ?", (world_version,)
            )
            if found is None:
                raise StorageError("versao_ausente", f"O Mundo não tem a versão {world_version} usada pela Jornada.")
            return OpenJourney(jid, db, lock, world_id, int(world_version))
        except BaseException:
            if db is not None:
                db.close()
            if lock is not None:
                lock.release()
            self._release_process_slot(jid)
            raise

    # ------------------------------------------------------------- backups
    def list_backups(self, journey_id: str) -> list[BackupInfo]:
        """Backups da Jornada (os feitos antes de migrar), do mais novo ao mais antigo."""
        jid = checked_id(journey_id)
        found = list_backup_files(self.paths.journey_backups_dir(jid), BACKUP_PREFIX)
        out = []
        for stamp, _seq, version, path in reversed(found):
            try:
                size = path.stat().st_size
            except OSError:
                continue
            out.append(BackupInfo(name=path.name, schema_version=version, created=stamp, size_bytes=size))
        return out

    def restore_backup(self, journey_id: str, backup_name: str) -> RestoreResult:
        """Troca o ``journey.db`` por uma cópia do backup escolhido (operação explícita).

        O arquivo atual (com ``-wal``/``-shm``) é **renomeado** para
        ``journey.db.danificado-<AAAAMMDD-HHMMSS>``, nunca apagado. O backup é conferido
        antes (integridade e id) e a cópia é conferida depois; se a conferência final
        falhar, o arquivo anterior volta para o lugar.
        """
        jid = checked_id(journey_id)
        if not isinstance(backup_name, str) or not _BACKUP_NAME_RE.match(backup_name):
            raise StorageError("backup_invalido", "Nome de backup inválido.")
        folder = self.paths.journey_dir(jid)
        if not folder.is_dir():
            raise StorageError("jornada_nao_encontrada", "Jornada não encontrada.")
        source = self.paths.journey_backups_dir(jid) / backup_name
        if not source.is_file():
            raise StorageError("backup_nao_encontrado", "Backup não encontrado.")
        with _process_lock:
            if _process_open["id"] == jid:
                raise StorageError("jornada_aberta", "Feche a Jornada antes de restaurar um backup.")
        lock = self._lock_for(jid)
        try:
            self._check_restorable(source, jid, "backup_invalido")
            target = self.paths.journey_db_file(jid)
            preserved = self._set_aside(target)
            staging = target.with_name(target.name + ".restaurando")
            try:
                shutil.copyfile(source, staging)
                os.replace(staging, target)
                self._check_restorable(target, jid, "restauracao_falhou")
            except BaseException:
                for leftover in (staging, target):
                    try:
                        leftover.unlink()
                    except FileNotFoundError:
                        pass
                if preserved is not None:
                    self._put_back(preserved, target)
                raise
        finally:
            lock.release()
        log.warning(
            "jornada %s restaurada do backup %s; anterior preservado como %s",
            jid, backup_name, preserved.name if preserved else "(nenhum)",
        )
        return RestoreResult(restored_from=backup_name, preserved_as=preserved)

    @staticmethod
    def _check_restorable(path: Path, journey_id: str, code: str) -> None:
        snap = read_snapshot(path, "journey_meta", integrity=True)
        if snap.problem is not None:
            raise StorageError(code, f"O arquivo {path.name} não é um banco de Jornada íntegro: {snap.detail}", path=path)
        if (snap.meta or {}).get("id") != journey_id:
            raise StorageError(code, f"O arquivo {path.name} pertence a outra Jornada.", path=path)

    @staticmethod
    def _set_aside(target: Path) -> Path | None:
        """Renomeia ``journey.db`` (e ``-wal``/``-shm``) para ``journey.db.danificado-<data>``."""
        if not target.exists():
            for side in SIDE_FILES:  # restos sem o arquivo principal não valem para o banco restaurado
                extra = target.with_name(target.name + side)
                if extra.exists():
                    stamp = timestamp()
                    extra.replace(target.with_name(f"{target.name}{DAMAGED_SUFFIX}{stamp}{side}"))
            return None
        stamp = timestamp()
        aside = target.with_name(f"{target.name}{DAMAGED_SUFFIX}{stamp}")
        n = 1
        while aside.exists():
            aside = target.with_name(f"{target.name}{DAMAGED_SUFFIX}{stamp}-{n}")
            n += 1
        target.replace(aside)
        for side in SIDE_FILES:
            extra = target.with_name(target.name + side)
            if extra.exists():
                extra.replace(aside.with_name(aside.name + side))
        return aside

    @staticmethod
    def _put_back(aside: Path, target: Path) -> None:
        aside.replace(target)
        for side in SIDE_FILES:
            extra = aside.with_name(aside.name + side)
            if extra.exists():
                extra.replace(target.with_name(target.name + side))

    # ------------------------------------------------------------- exclusão
    def delete_journey(self, journey_id: str, *, confirm: bool = False) -> None:
        """Remove a pasta da Jornada. Exige ``confirm=True``; recusa se estiver aberta ou bloqueada."""
        jid = checked_id(journey_id)
        if confirm is not True:
            raise StorageError("confirmacao_necessaria", "Excluir uma Jornada exige confirmação explícita.")
        folder = self.paths.journey_dir(jid)
        if not folder.is_dir():
            raise StorageError("jornada_nao_encontrada", "Jornada não encontrada.")
        with _process_lock:
            if _process_open["id"] == jid:
                raise StorageError("jornada_aberta", "Feche a Jornada antes de excluí-la.")
        lock = self._lock_for(jid)
        lock_file = lock.path
        try:
            for entry in folder.iterdir():
                if entry == lock_file:
                    continue
                if entry.is_dir() and not entry.is_symlink():
                    shutil.rmtree(entry)
                else:
                    entry.unlink()
        except OSError as exc:
            lock.release()
            raise StorageError("exclusao_falhou", f"Não foi possível excluir a Jornada: {exc}", path=folder) from exc
        lock.release()
        try:
            lock_file.unlink(missing_ok=True)
            folder.rmdir()
        except OSError as exc:
            raise StorageError("exclusao_falhou", f"Não foi possível remover a pasta da Jornada: {exc}", path=folder) from exc
        if self.settings is not None and self.last_journey_id == jid:
            self.settings.update(last_journey_id=None)
        log.info("jornada excluída: %s", jid)


__all__ = [
    "BackupInfo",
    "JourneyDamaged",
    "JourneyStore",
    "JourneySummary",
    "OpenJourney",
    "RestoreResult",
    "WorldDamaged",
]
