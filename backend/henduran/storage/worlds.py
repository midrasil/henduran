"""Mundos: um banco por Mundo em ``worlds\\<id>\\world.db`` (ADR-075).

Cada Mundo tem ``world_meta`` (uma linha) e ``world_versions`` (as versões, com o
conteúdo em JSON, ainda sem esquema). O Mundo é **somente leitura para a
Jornada**: a Jornada anexa o ``world.db`` em modo leitura; nenhuma operação grava
no Mundo e na Jornada ao mesmo tempo.

Banco de Mundo danificado **nunca é recriado**: vira :class:`WorldDamaged` e o
arquivo fica como está.

A migração ``world/0002`` acrescenta ``world_meta.seed`` (ADR-077, item 5): a semente do
gerador num Mundo gerado e não editado. Um Mundo editado à mão, criado do zero ou duplicado
é um **Mundo personalizado** e fica com a semente nula (decisão de 2026-11-24; o comentário
da 0002 fala em "semente nova", mas a migração não pode mudar depois de aplicada e a coluna já
aceita nulo). Nula também em Mundos criados antes.

:meth:`WorldStore.catalog` é a lista de Mundos salvos da Nova Jornada: além do resumo,
nome da era e do tom da última versão, a semente e quantas Jornadas usam cada Mundo,
tudo lido em modo somente leitura e sem migrar.
"""

from __future__ import annotations

import json
import logging
import shutil
import sqlite3
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

from henduran.db.connection import Database, DatabaseError, connect_readonly, utc_now_iso
from henduran.db.migrations import latest_version, migrate
from henduran.paths import DataPaths, InvalidIdError, new_id, validate_id
from henduran.storage.errors import StorageError, WorldDamaged
from henduran.storage.snapshot import DbSnapshot, read_snapshot

log = logging.getLogger("henduran.storage")

WORLD_SET = "world"
WORLD_SYNCHRONOUS = "FULL"
NAME_MAX = 200
LABEL_MAX = 200


def clean_name(value: Any, *, field_name: str = "name") -> str:
    if not isinstance(value, str) or not value.strip() or len(value.strip()) > NAME_MAX or "\x00" in value:
        raise StorageError("nome_invalido", f"{field_name} deve ser um texto de 1 a {NAME_MAX} caracteres.")
    return value.strip()


def checked_id(value: Any) -> str:
    try:
        return validate_id(value)
    except InvalidIdError as exc:
        raise StorageError("id_invalido", str(exc)) from exc


@dataclass
class WorldSummary:
    """Resumo de um Mundo para listas. ``status``: ``ok``, ``danificado`` ou ``mais_novo``."""

    id: str
    name: str | None
    created_at: str | None
    versions: list[int] = field(default_factory=list)
    schema_version: int = 0
    status: str = "ok"
    error_code: str | None = None
    error_message: str | None = None
    seed: int | None = None  # world/0002; None em Mundos antigos ou sem semente
    # Só em :meth:`WorldStore.catalog` (None nas outras listas):
    era: str | None = None  # nome da era da última versão
    tone: str | None = None  # nome do tom da última versão
    journey_count: int | None = None  # Jornadas legíveis que usam o Mundo

    def to_dict(self) -> dict[str, Any]:
        out = asdict(self)
        out["latest_version"] = self.versions[-1] if self.versions else None
        return out


def _summary_from(world_id: str, snap: DbSnapshot, latest: int) -> WorldSummary:
    meta = snap.meta or {}
    summary = WorldSummary(
        id=world_id,
        name=meta.get("name"),
        created_at=meta.get("created_at"),
        versions=list(snap.world_versions),
        schema_version=snap.version,
        seed=meta.get("seed") if isinstance(meta.get("seed"), int) else None,
    )
    if snap.problem is not None:
        summary.status = "danificado"
        summary.error_code = snap.problem
        summary.error_message = snap.detail
    elif snap.version > latest:
        summary.status = "mais_novo"
        summary.error_code = "banco_mais_novo"
        summary.error_message = f"O Mundo está na versão de esquema {snap.version}; este app conhece até a {latest}."
    elif meta.get("id") != world_id:
        summary.status = "danificado"
        summary.error_code = "id_divergente"
        summary.error_message = "O identificador gravado no Mundo não corresponde à pasta."
    return summary


# Prefixo das pastas de Mundos excluídos que ainda não foram apagadas (a lista as ignora).
TRASH_PREFIX = ".excluindo-"


class WorldStore:
    """Criação, listagem, abertura e exclusão de Mundos."""

    def __init__(self, paths: DataPaths) -> None:
        self.paths = paths

    # ------------------------------------------------------------- criação
    def create_world(
        self, name: str, content: Any = None, *, label: str | None = None, seed: int | None = None
    ) -> str:
        """Cria o Mundo com a versão 1 (``content`` em JSON; padrão ``{}``) e a ``seed``. Devolve o id."""
        name = clean_name(name)
        if seed is not None and (isinstance(seed, bool) or not isinstance(seed, int) or not 0 <= seed <= 2**53 - 1):
            raise StorageError("semente_invalida", "A semente do Mundo deve ser um inteiro entre 0 e 2^53 - 1.")
        if label is not None:
            label = clean_name(label, field_name="label")[:LABEL_MAX]
        try:
            payload = json.dumps({} if content is None else content, ensure_ascii=False, allow_nan=False)
        except (TypeError, ValueError) as exc:
            raise StorageError("conteudo_invalido", f"O conteúdo do Mundo deve ser serializável em JSON: {exc}") from exc
        world_id = new_id()
        folder = self.paths.world_dir(world_id)
        folder.mkdir(parents=True, exist_ok=False)
        db: Database | None = None
        try:
            self.paths.world_backups_dir(world_id).mkdir()
            db = Database(self.paths.world_db_file(world_id), synchronous=WORLD_SYNCHRONOUS, recover_corrupt=False)
            migrate(db, migration_set=WORLD_SET, backups_dir=self.paths.world_backups_dir(world_id))
            now = utc_now_iso()
            with db.transaction() as tx:
                tx.execute(
                    "INSERT INTO world_meta (id, name, created_at, seed) VALUES (?, ?, ?, ?)", (world_id, name, now, seed)
                )
                tx.execute(
                    "INSERT INTO world_versions (version, label, created_at, content) VALUES (1, ?, ?, ?)",
                    (label, now, payload),
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
        log.info("mundo criado: %s", world_id)
        return world_id

    # ------------------------------------------------------------- leitura
    def world_ids(self) -> list[str]:
        root = self.paths.worlds_dir
        if not root.is_dir():
            return []
        ids: list[str] = []
        for entry in root.iterdir():
            try:
                wid = validate_id(entry.name)
            except InvalidIdError:
                continue  # pastas estranhas são ignoradas
            if entry.is_dir() and wid == entry.name:
                ids.append(wid)
        return sorted(ids)

    def world_exists(self, world_id: str) -> bool:
        return self.paths.world_db_file(checked_id(world_id)).is_file()

    def inspect_world(self, world_id: str, *, integrity: bool = False) -> WorldSummary:
        wid = checked_id(world_id)
        snap = read_snapshot(self.paths.world_db_file(wid), "world_meta", integrity=integrity)
        if snap.problem == "banco_ausente" and not self.paths.world_dir(wid).is_dir():
            raise StorageError("mundo_nao_encontrado", "Mundo não encontrado.")
        return _summary_from(wid, snap, latest_version(WORLD_SET))

    def list_worlds(self) -> list[WorldSummary]:
        """Resumo de cada Mundo, lido em modo somente leitura e sem migrar."""
        latest = latest_version(WORLD_SET)
        out = [
            _summary_from(wid, read_snapshot(self.paths.world_db_file(wid), "world_meta"), latest)
            for wid in self.world_ids()
        ]
        out.sort(key=lambda w: ((w.name or "").casefold(), w.id))
        return out

    def read_content(self, world_id: str, version: int | None = None) -> Any:
        """Conteúdo (JSON decodificado) de uma versão do Mundo (padrão: a última), em modo somente leitura.

        Levanta :class:`StorageError` ``mundo_nao_encontrado`` ou ``versao_ausente``.
        """
        wid = checked_id(world_id)
        path = self.paths.world_db_file(wid)
        if not path.is_file():
            raise StorageError("mundo_nao_encontrado", "Mundo não encontrado.")
        conn = connect_readonly(path)
        try:
            if version is None:
                row = conn.execute("SELECT content FROM world_versions ORDER BY version DESC LIMIT 1").fetchone()
            else:
                row = conn.execute("SELECT content FROM world_versions WHERE version = ?", (version,)).fetchone()
        finally:
            conn.close()
        if row is None:
            raise StorageError("versao_ausente", "O Mundo não tem a versão pedida.")
        return json.loads(row["content"])

    def catalog(self) -> list[WorldSummary]:
        """Mundos salvos para a Nova Jornada: resumo, era e tom da última versão, semente e uso.

        Somente leitura e sem migrar; um Mundo ilegível continua na lista com ``status``.
        """
        items = self.list_worlds()
        counts = self.journey_counts()
        for item in items:
            item.journey_count = counts.get(item.id, 0)
            if item.status != "ok" or not item.versions:
                continue
            try:
                content = self.read_content(item.id, item.versions[-1])
            except (StorageError, sqlite3.Error, ValueError) as exc:
                log.warning("conteúdo do mundo %s ilegível: %s", item.id, exc)
                continue
            if isinstance(content, dict):
                era, tone = content.get("era"), content.get("tone")
                item.era = era.get("name") if isinstance(era, dict) and isinstance(era.get("name"), str) else None
                item.tone = tone.get("name") if isinstance(tone, dict) and isinstance(tone.get("name"), str) else None
        return items

    def require_version(self, world_id: str, version: int) -> None:
        """Confere que o Mundo existe, abre e tem ``version``. Levanta :class:`StorageError`."""
        if isinstance(version, bool) or not isinstance(version, int) or version < 1:
            raise StorageError("versao_invalida", "A versão do Mundo deve ser um inteiro a partir de 1.")
        wid = checked_id(world_id)
        if not self.paths.world_db_file(wid).is_file():
            raise StorageError("mundo_ausente", "O Mundo desta Jornada não existe mais.", path=self.paths.world_dir(wid))
        summary = self.inspect_world(wid)
        if summary.status == "danificado":
            raise WorldDamaged(
                "mundo_danificado", self.paths.world_db_file(wid), f"O Mundo está danificado: {summary.error_message}"
            )
        if summary.status == "mais_novo":
            raise StorageError("mundo_mais_novo", summary.error_message or "O Mundo é de uma versão mais nova do app.")
        if version not in summary.versions:
            raise StorageError("versao_ausente", f"O Mundo não tem a versão {version}.")

    # ------------------------------------------------------------- abertura
    def open_world(self, world_id: str) -> Database:
        """Abre o banco do Mundo para escrita (migra o conjunto ``world``, com backup antes).

        Quem chama fecha o banco (``with store.open_world(id) as db: ...``).
        Corrupção vira :class:`WorldDamaged`; nada é recriado.
        """
        wid = checked_id(world_id)
        path = self.paths.world_db_file(wid)
        if not path.is_file():
            raise StorageError("mundo_nao_encontrado", "Mundo não encontrado.")
        snap = read_snapshot(path, "world_meta")
        if snap.problem in ("banco_danificado", "banco_vazio", "sem_resumo"):
            raise WorldDamaged("mundo_danificado" if snap.problem != "sem_resumo" else "sem_resumo", path, snap.detail)
        if snap.problem == "banco_inacessivel":
            raise StorageError("banco_inacessivel", snap.detail or "O banco do Mundo não pôde ser lido.", path=path)
        try:
            db = Database(path, synchronous=WORLD_SYNCHRONOUS, recover_corrupt=False, create=False)
        except DatabaseError as exc:
            if exc.code in ("banco_danificado", "banco_ausente"):
                raise WorldDamaged("mundo_danificado", path, str(exc)) from exc
            raise
        try:
            migrate(db, migration_set=WORLD_SET, backups_dir=self.paths.world_backups_dir(wid))
        except BaseException:
            db.close()
            raise
        return db

    def prepare_for_attach(self, world_id: str) -> Path:
        """Garante que o Mundo pode ser anexado em leitura: íntegro e no esquema atual.

        Se houver migração pendente do Mundo, ela é feita aqui, **antes** e
        separada de qualquer escrita na Jornada. Devolve o caminho do ``world.db``.
        """
        wid = checked_id(world_id)
        path = self.paths.world_db_file(wid)
        if not path.is_file():
            raise StorageError("mundo_ausente", "O Mundo desta Jornada não existe mais.", path=self.paths.world_dir(wid))
        summary = self.inspect_world(wid, integrity=True)
        if summary.status == "danificado":
            raise WorldDamaged("mundo_danificado", path, f"O Mundo está danificado: {summary.error_message}")
        if summary.status == "mais_novo":
            raise StorageError("mundo_mais_novo", summary.error_message or "O Mundo é de uma versão mais nova do app.")
        if summary.schema_version < latest_version(WORLD_SET):
            self.open_world(wid).close()
        return path

    # ------------------------------------------------------------- uso e exclusão
    def journeys_using(self, world_id: str) -> tuple[list[str], list[str]]:
        """``(jornadas que usam o Mundo, jornadas ilegíveis)``, lendo cada ``journey_meta`` em leitura."""
        wid = checked_id(world_id)
        users: list[str] = []
        unknown: list[str] = []
        root = self.paths.journeys_dir
        if not root.is_dir():
            return users, unknown
        for entry in sorted(root.iterdir()):
            try:
                jid = validate_id(entry.name)
            except InvalidIdError:
                continue
            if not entry.is_dir() or jid != entry.name:
                continue
            snap = read_snapshot(self.paths.journey_db_file(jid), "journey_meta")
            if snap.meta is None:
                unknown.append(jid)
            elif snap.meta.get("world_id") == wid:
                users.append(jid)
        return users, unknown

    def journey_counts(self) -> dict[str, int]:
        """Quantas Jornadas legíveis usam cada Mundo (uma leitura de ``journey_meta`` por Jornada)."""
        counts: dict[str, int] = {}
        root = self.paths.journeys_dir
        if not root.is_dir():
            return counts
        for entry in root.iterdir():
            try:
                jid = validate_id(entry.name)
            except InvalidIdError:
                continue
            if not entry.is_dir() or jid != entry.name:
                continue
            snap = read_snapshot(self.paths.journey_db_file(jid), "journey_meta")
            wid = (snap.meta or {}).get("world_id")
            if isinstance(wid, str):
                counts[wid] = counts.get(wid, 0) + 1
        return counts

    def world_in_use(self, world_id: str) -> bool:
        """``True`` se alguma Jornada legível está vinculada a este Mundo."""
        users, _ = self.journeys_using(world_id)
        return bool(users)

    def discard_new_world(self, world_id: str) -> None:
        """Remove a pasta de um Mundo **recém-criado** por uma operação que falhou (compensação).

        Sem as conferências de :meth:`delete_world`: só para desfazer uma criação
        que nunca foi entregue ao jogador. Levanta :class:`StorageError` se não conseguir.
        """
        folder = self.paths.world_dir(checked_id(world_id))
        try:
            shutil.rmtree(folder)
        except FileNotFoundError:
            return
        except OSError as exc:
            raise StorageError("exclusao_falhou", f"Não foi possível remover o Mundo criado: {exc}", path=folder) from exc
        log.info("mundo descartado (criação desfeita): %s", world_id)

    def delete_world(self, world_id: str, *, confirm: bool = False) -> None:
        """Remove a pasta do Mundo. Exige ``confirm=True``; recusa se o Mundo estiver em uso.

        Também recusa (``uso_indeterminado``) se houver Jornada ilegível, porque não
        dá para saber se ela depende deste Mundo (ela pode ser restaurada de backup).

        A exclusão é atômica para o jogador: a pasta é primeiro **renomeada** para um nome
        que a lista ignora (``.excluindo-<id>-<n>``, na mesma pasta ``worlds``). Se o
        renome falhar (arquivo em uso), nada muda e o erro é ``exclusao_falhou``. Depois
        do renome o Mundo já não existe; se apagar os arquivos falhar, a pasta oculta fica
        e é removida na próxima exclusão.
        """
        wid = checked_id(world_id)
        if confirm is not True:
            raise StorageError("confirmacao_necessaria", "Excluir um Mundo exige confirmação explícita.")
        folder = self.paths.world_dir(wid)
        if not folder.is_dir():
            raise StorageError("mundo_nao_encontrado", "Mundo não encontrado.")
        users, unknown = self.journeys_using(wid)
        if users:
            raise StorageError("mundo_em_uso", f"O Mundo é usado por {len(users)} Jornada(s); exclua-as antes.")
        if unknown:
            raise StorageError(
                "uso_indeterminado",
                f"Há {len(unknown)} Jornada(s) que não puderam ser lidas; não dá para saber se usam este Mundo.",
            )
        trash = self._trash_path(wid)
        try:
            folder.rename(trash)
        except OSError as exc:
            raise StorageError("exclusao_falhou", f"Não foi possível excluir o Mundo: {exc}", path=folder) from exc
        log.info("mundo excluído: %s", wid)
        self._empty_trash()

    def _trash_path(self, world_id: str) -> Path:
        root = self.paths.worlds_dir
        n = 0
        while (root / f"{TRASH_PREFIX}{world_id}-{n}").exists():
            n += 1
        return root / f"{TRASH_PREFIX}{world_id}-{n}"

    def _empty_trash(self) -> None:
        """Apaga as pastas de Mundos já excluídos (renomeados); o que falhar fica para depois."""
        root = self.paths.worlds_dir
        if not root.is_dir():
            return
        for entry in root.iterdir():
            if entry.name.startswith(TRASH_PREFIX) and entry.is_dir() and not entry.is_symlink():
                try:
                    shutil.rmtree(entry)
                except OSError as exc:
                    log.warning("pasta de mundo excluído não removida (%s): %s", entry.name, exc)
