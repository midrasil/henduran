"""Modelos ``.gguf`` do Hugging Face: busca, arquivos, download verificado, remoção e pastas extras.

Origem: ``CODED-Xavier/Caliope``, ``backend/app/modelhub.py``, commit ``1cab9e0``.
Uso autorizado pelo autor (ver ``docs/main/auditoria-caliope.md``).

Adaptações para o Henduran:

- Sem ``Database``, ``get_settings``/``update_settings``, ``model_prefs``
  (modelos "desativados"), ``use_own_models``, ``adopt_model(s)`` nem cópia de
  modelos do LM Studio: pastas de ``henduran.paths`` e pastas extras em
  ``henduran.settings`` (``model_folders``). Pastas extras **nunca** são copiadas,
  movidas nem alteradas; remover um modelo de uma pasta extra é recusado.
- Sem seletor de arquivo nativo (``tkinter``). As notas de qualidade por
  quantização e as sugestões por hardware ficam na tela Modelos e em
  ``henduran.ai.hardware.suggest``; ocultar modelos e os ajustes de carga por
  modelo ficam em ``henduran.settings`` (``hidden_models``, ``model_options``).
- ``scan_pc`` (Henduran): procura ``.gguf`` nas pastas comuns (Downloads, LM
  Studio, Documentos) só lendo; o jogador escolhe se usa a pasta de um achado.
- Endpoints conferidos na API real do Hugging Face (ver
  ``docs/main/importacoes-caliope.md``): busca com ``expand[]`` (o campo
  ``gated`` só vem assim), licença pelas tags ``license:*``, árvore fixada no
  commit (``sha``) do repositório e paginada pelo cabeçalho ``Link``, SHA-256 em
  ``lfs.oid`` (mascarado com ``*`` em repositórios restritos).
- Download só de ``https://huggingface.co`` e dos CDNs ``*.hf.co`` /
  ``*.huggingface.co``; cada redirecionamento é conferido (``https`` e host)
  antes de ser seguido. Repositórios restritos (*gated*) ou privados não são
  baixados (sem token nesta fase).
- Validação estrita do repositório e do nome do arquivo (sem ``..``, separadores
  extras, nomes reservados do Windows; extensão ``.gguf``), e toda escrita ou
  remoção confere que o caminho resolvido está dentro da pasta de modelos, sem
  links simbólicos ou junções no caminho.
- Espaço livre conferido antes de baixar; retomada por ``Range`` a partir do
  ``.part`` (também após reabrir o app); sem SHA-256 publicado o download
  continua com aviso e registro no log, sem se declarar verificado.
- Um download por vez; estado em memória, reconstruído do disco pelos ``.part``.
"""

from __future__ import annotations

import asyncio
import contextlib
import hashlib
import logging
import os
import posixpath
import re
import secrets
import shutil
import time
import uuid
from collections import deque
from collections.abc import AsyncIterator, Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from urllib.parse import quote

import httpx

from henduran.ai.engine import SPLIT_RE, folder_prefix, quant_of
from henduran.paths import DataPaths
from henduran.settings import MAX_MODEL_FOLDERS, SettingsStore

log = logging.getLogger("henduran.modelhub")

HF_BASE = "https://huggingface.co"
API_MODELS = f"{HF_BASE}/api/models"
API_HOST = "huggingface.co"
DOWNLOAD_HOSTS = {"huggingface.co", "hf.co"}
DOWNLOAD_HOST_SUFFIXES = (".huggingface.co", ".hf.co")
USER_AGENT = "Henduran"
MAX_REDIRECTS = 5
MAX_TREE_PAGES = 20
SEARCH_LIMIT_DEFAULT = 20
SEARCH_LIMIT_MAX = 50
QUERY_MAX = 100
CHUNK = 1 << 20
# PROVISÓRIO: folga de espaço livre deixada no disco além do tamanho do download.
DISK_MARGIN = 256 * 2**20
LOG_NAME = "models.log"
SEARCH_FIELDS = ("author", "downloads", "likes", "tags", "gated", "private", "lastModified")

_SEGMENT_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._+-]{0,199}$")
_HEX64 = re.compile(r"^[0-9a-f]{64}$")
_HEX40 = re.compile(r"^[0-9a-f]{40}$")
_LINK_NEXT = re.compile(r'<([^>]+)>\s*;\s*rel="?next"?')
_RATELIMIT_T = re.compile(r";\s*t=(\d+)")
WINDOWS_RESERVED = {
    "CON", "PRN", "AUX", "NUL", "CONIN$", "CONOUT$",
    *(f"COM{i}" for i in range(10)), *(f"LPT{i}" for i in range(10)),
    "COM¹", "COM²", "COM³", "LPT¹", "LPT²", "LPT³",
}

ACTIVE_STATES = ("queued", "downloading", "verifying")


class HubError(RuntimeError):
    """Falha do gerenciador de modelos, com ``code`` estável para a interface."""

    def __init__(self, message: str, code: str) -> None:
        super().__init__(message)
        self.code = code


# ------------------------------------------------------------------ validação
def safe_segment(name: str) -> bool:
    """Um componente de caminho seguro no Windows: sem separadores, ``..`` nem nomes reservados."""
    if not isinstance(name, str) or not _SEGMENT_RE.match(name):
        return False
    if ".." in name or name.endswith(".") or name.endswith(" "):
        return False
    return name.split(".", 1)[0].upper() not in WINDOWS_RESERVED


def validate_repo(repo: Any) -> str:
    """``autor/nome`` do Hugging Face, sem ``..`` nem barras extras; levanta ``repo_invalido``."""
    if isinstance(repo, str):
        parts = repo.split("/")
        if len(parts) == 2 and all(safe_segment(p) and len(p) <= 96 for p in parts):
            return repo
    raise HubError("Nome de repositório inválido. Use o formato autor/nome.", "repo_invalido")


def validate_repo_file(path: Any) -> str:
    """Caminho de um ``.gguf`` dentro do repositório; devolve o nome local do arquivo.

    Aceita subpastas (``Q8_0/Modelo-Q8_0-00001-of-00002.gguf``), mas cada parte
    precisa ser um nome seguro; o arquivo é gravado só com o nome final.
    """
    if isinstance(path, str) and "\\" not in path and len(path) <= 512:
        parts = path.split("/")
        if 1 <= len(parts) <= 4 and all(safe_segment(p) for p in parts) and parts[-1].lower().endswith(".gguf"):
            return parts[-1]
    raise HubError("Nome de arquivo inválido: só arquivos .gguf com nomes simples.", "arquivo_invalido")


def license_of(tags: Any) -> str | None:
    for tag in tags if isinstance(tags, list) else []:
        if isinstance(tag, str) and tag.startswith("license:") and len(tag) > 8:
            return tag[8:][:64]
    return None


def _int(value: Any) -> int:
    try:
        return max(0, int(value))
    except (TypeError, ValueError):
        return 0


def _text(value: Any, limit: int = 200) -> str:
    return value[:limit] if isinstance(value, str) else ""


def _sha256(value: Any) -> str | None:
    """``lfs.oid`` só vale como SHA-256 se tiver 64 hexadecimais (restritos vêm com ``*``)."""
    if isinstance(value, str) and _HEX64.match(value.lower()):
        return value.lower()
    return None


def no_links_between(path: Path, root: Path) -> bool:
    """``True`` se nenhum componente de ``root`` (exclusive) até ``path`` é link simbólico ou junção."""
    try:
        rel = path.relative_to(root)
    except ValueError:
        return False
    current = root
    for part in rel.parts:
        current = current / part
        try:
            if current.is_symlink() or current.is_junction():
                return False
        except OSError:
            return False
    return True


def inside(path: Path, root: Path) -> bool:
    """``path`` resolvido está dentro de ``root`` resolvido e sem links no caminho."""
    try:
        real_root = root.resolve()
        real = path.resolve()
    except OSError:
        return False
    if real == real_root or not real.is_relative_to(real_root):
        return False
    return no_links_between(path.absolute(), root.absolute())


def check_url(url: httpx.URL, *, api: bool = False) -> None:
    """Só ``https`` para ``huggingface.co`` (API) ou também para os CDNs ``*.hf.co`` (download)."""
    host = (url.host or "").lower()
    ok_host = host == API_HOST if api else (
        host in DOWNLOAD_HOSTS or host.endswith(DOWNLOAD_HOST_SUFFIXES)
    )
    if url.scheme != "https" or not ok_host or url.userinfo or url.port not in (None, 443):
        raise HubError(
            "O Hugging Face redirecionou para um endereço inesperado; o download foi recusado.",
            "destino_inesperado",
        )


def group_gguf_files(tree: Any) -> list[dict]:
    """Agrupa os ``.gguf`` da árvore: modelos divididos viram um único item com todas as partes."""
    singles: list[dict] = []
    groups: dict[tuple[str, str, int], dict] = {}
    for entry in tree if isinstance(tree, list) else []:
        if not isinstance(entry, dict) or entry.get("type") != "file":
            continue
        path = entry.get("path")
        if not isinstance(path, str) or not path.lower().endswith(".gguf") or "mmproj" in path.lower():
            continue
        try:
            name = validate_repo_file(path)
        except HubError:
            continue  # nome que o app não grava com segurança: fica fora da lista
        lfs = entry.get("lfs") if isinstance(entry.get("lfs"), dict) else {}
        part = {"path": path, "size": _int(lfs.get("size") or entry.get("size")), "sha256": _sha256(lfs.get("oid"))}
        match = SPLIT_RE.match(name)
        if not match:
            singles.append({"file": path, "name": name, "parts": [part], "total": 1})
            continue
        total = int(match.group("total"))
        key = (posixpath.dirname(path), match.group("base").lower(), total)
        group = groups.setdefault(key, {"name": f"{match.group('base')}.gguf", "parts": {}, "total": total})
        group["parts"][int(match.group("index"))] = part
    for group in groups.values():
        ordered = [group["parts"][i] for i in sorted(group["parts"])]
        singles.append({
            "file": ordered[0]["path"], "name": group["name"], "parts": ordered, "total": group["total"],
            "complete": sorted(group["parts"]) == list(range(1, group["total"] + 1)),
        })
    out = []
    for item in singles:
        parts = item["parts"]
        out.append({
            "file": item["file"],
            "name": item["name"],
            "quant": quant_of(item["name"]),
            "size_bytes": sum(p["size"] for p in parts),
            "parts": parts,
            "complete": item.get("complete", True),
            "verifiable": all(p["sha256"] for p in parts),
        })
    return sorted(out, key=lambda f: (f["size_bytes"], f["name"].lower()))


# ------------------------------------------------------------------ HTTP
class HubClient:
    """Cliente do Hugging Face com redirecionamentos conferidos um a um (transporte injetável)."""

    def __init__(self, transport: httpx.AsyncBaseTransport | None = None, *, timeout: float = 20.0) -> None:
        self._transport = transport
        self._timeout = timeout

    def _client(self, read: float | None = None) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            transport=self._transport,
            follow_redirects=False,
            timeout=httpx.Timeout(self._timeout, read=read or self._timeout),
            headers={"User-Agent": USER_AGENT},
        )

    @staticmethod
    def raise_for(resp: httpx.Response) -> None:
        code = resp.status_code
        if 200 <= code < 300:
            return
        if code == 429:
            wait = _RATELIMIT_T.search(resp.headers.get("ratelimit", ""))
            extra = f" Tente de novo em {wait.group(1)} s." if wait else " Tente de novo em alguns minutos."
            raise HubError("O Hugging Face limitou as consultas deste PC." + extra, "limite_requisicoes")
        if code in (401, 403):
            raise HubError(
                "Este repositório não existe, é privado ou restrito: exige login no Hugging Face, "
                "o que ainda não é suportado.",
                "restrito",
            )
        if code == 404:
            raise HubError("Não encontrado no Hugging Face.", "nao_encontrado")
        raise HubError(f"O Hugging Face respondeu com erro ({code}). Tente de novo mais tarde.", "rede")

    async def _send(self, client: httpx.AsyncClient, url: str | httpx.URL, *, api: bool,
                    headers: dict[str, str] | None = None, params: Any = None) -> httpx.Response:
        target = httpx.URL(url, params=params) if params is not None else httpx.URL(url)
        for _ in range(MAX_REDIRECTS + 1):
            check_url(target, api=api)
            request = client.build_request("GET", target, headers=headers)
            try:
                resp = await client.send(request, stream=True)
            except httpx.TransportError as exc:
                raise HubError(
                    "Não foi possível falar com o Hugging Face. Verifique a internet e tente de novo.", "rede"
                ) from exc
            if resp.status_code in (301, 302, 303, 307, 308) and "location" in resp.headers:
                target = resp.url.join(resp.headers["location"])
                await resp.aclose()
                continue
            return resp
        raise HubError("O Hugging Face redirecionou vezes demais.", "destino_inesperado")

    async def get_json(self, url: str, params: Any = None) -> tuple[Any, httpx.Headers]:
        async with self._client() as client:
            resp = await self._send(client, url, api=True, params=params)
            try:
                self.raise_for(resp)
                await resp.aread()
            except httpx.TransportError as exc:
                raise HubError("A conexão com o Hugging Face caiu. Tente de novo.", "rede") from exc
            finally:
                await resp.aclose()
        try:
            return resp.json(), resp.headers
        except ValueError as exc:
            raise HubError("O Hugging Face devolveu uma resposta inválida.", "resposta_invalida") from exc

    @contextlib.asynccontextmanager
    async def stream(self, url: str, start: int = 0) -> AsyncIterator[httpx.Response]:
        headers = {"Accept-Encoding": "identity"}
        if start:
            headers["Range"] = f"bytes={start}-"
        async with self._client(read=120.0) as client:
            resp = await self._send(client, url, api=False, headers=headers)
            try:
                yield resp
            finally:
                await resp.aclose()


# ------------------------------------------------------------------ downloads
@dataclass
class Download:
    id: str
    repo: str
    file: str
    name: str
    parts: list[dict] = field(default_factory=list)
    state: str = "queued"
    done_bytes: int = 0
    total_bytes: int = 0
    speed_bps: float = 0.0
    error_code: str | None = None
    error_message: str | None = None
    warning: str | None = None
    verified: bool | None = None
    model_id: str | None = None
    task: asyncio.Task | None = None

    @property
    def key(self) -> tuple[str, str]:
        return (self.repo.lower(), posixpath.basename(self.file).lower())

    def to_dict(self) -> dict:
        progress = self.done_bytes / self.total_bytes if self.total_bytes else 0.0
        return {
            "id": self.id, "repo": self.repo, "file": self.file, "name": self.name, "state": self.state,
            "done_bytes": self.done_bytes, "total_bytes": self.total_bytes,
            "progress": round(min(1.0, progress), 4), "speed_bps": round(self.speed_bps),
            "error": {"code": self.error_code, "message": self.error_message} if self.error_code else None,
            "warning": self.warning, "verified": self.verified, "model_id": self.model_id,
            "parts": len(self.parts) or 1,
        }


class ModelHub:
    """Busca e download de ``.gguf`` do Hugging Face, remoção e pastas extras."""

    def __init__(
        self,
        paths: DataPaths,
        settings: SettingsStore,
        *,
        engine: Any = None,
        client: HubClient | None = None,
        disk_usage: Callable[[str], Any] = shutil.disk_usage,
        scan_roots: Callable[[], list[Path]] | None = None,
    ) -> None:
        self.paths = paths
        self.settings = settings
        self.engine = engine
        self.client = client or HubClient()
        self._disk_usage = disk_usage
        self._scan_roots = scan_roots or common_model_dirs
        self.items: dict[str, Download] = {}

    # ---- log
    def _log(self, line: str) -> None:
        with contextlib.suppress(OSError):
            self.paths.logs_dir.mkdir(parents=True, exist_ok=True)
            with open(self.paths.logs_dir / LOG_NAME, "a", encoding="utf-8", errors="replace") as fh:
                fh.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {line}\n")

    # ---- Hugging Face
    async def search(self, query: str, limit: int = SEARCH_LIMIT_DEFAULT) -> list[dict]:
        """Repositórios públicos com GGUF, por downloads. Restritos aparecem marcados."""
        q = "".join(ch for ch in str(query or "") if ch.isprintable()).strip()[:QUERY_MAX]
        params: list[tuple[str, str]] = [
            ("filter", "gguf"), ("sort", "downloads"), ("direction", "-1"),
            ("limit", str(max(1, min(SEARCH_LIMIT_MAX, int(limit))))),
        ]
        if q:
            params.append(("search", q))
        params += [("expand[]", f) for f in SEARCH_FIELDS]
        rows, _ = await self.client.get_json(API_MODELS, params=params)
        out = []
        for row in rows if isinstance(rows, list) else []:
            if not isinstance(row, dict) or row.get("private"):
                continue
            rid = row.get("id")
            try:
                validate_repo(rid)
            except HubError:
                continue
            author, name = rid.split("/")
            gated = row.get("gated") not in (None, False)
            out.append({
                "id": rid, "author": _text(row.get("author"), 96) or author, "name": name,
                "downloads": _int(row.get("downloads")), "likes": _int(row.get("likes")),
                "license": license_of(row.get("tags")), "gated": gated, "restricted": gated,
                "updated": _text(row.get("lastModified"), 40),
            })
        return out

    async def repo_files(self, repo: str) -> dict:
        """Informações e arquivos ``.gguf`` de um repositório, fixados no commit atual."""
        repo = validate_repo(repo)
        info, _ = await self.client.get_json(f"{API_MODELS}/{quote(repo, safe='/')}")
        if not isinstance(info, dict):
            raise HubError("O Hugging Face devolveu uma resposta inválida.", "resposta_invalida")
        canonical = info.get("id") if isinstance(info.get("id"), str) else repo
        try:
            canonical = validate_repo(canonical)
        except HubError:
            canonical = repo
        sha = info.get("sha")
        revision = sha if isinstance(sha, str) and _HEX40.match(sha) else "main"
        gated = info.get("gated") not in (None, False)
        private = bool(info.get("private"))
        disabled = bool(info.get("disabled"))
        card = info.get("cardData") if isinstance(info.get("cardData"), dict) else {}
        license_id = license_of(info.get("tags")) or (_text(card.get("license"), 64) or None)
        tree = await self._tree(canonical, revision)
        author, name = canonical.split("/")
        return {
            "id": canonical, "author": author, "name": name, "revision": revision,
            "license": license_id, "license_name": _text(card.get("license_name"), 120) or None,
            "gated": gated, "private": private, "restricted": gated or private or disabled,
            "files": group_gguf_files(tree),
        }

    async def _tree(self, repo: str, revision: str) -> list:
        url: str | None = f"{API_MODELS}/{quote(repo, safe='/')}/tree/{revision}?recursive=true"
        entries: list = []
        for _ in range(MAX_TREE_PAGES):
            if url is None:
                break
            page, headers = await self.client.get_json(url)
            if isinstance(page, list):
                entries.extend(page)
            nxt = _LINK_NEXT.search(headers.get("link", ""))
            url = nxt.group(1) if nxt else None
        return entries

    # ---- caminhos
    def repo_dir(self, repo: str) -> Path:
        author, name = validate_repo(repo).split("/")
        return self.paths.models_dir / author / name

    def installed(self, repo: str, file: dict) -> bool:
        folder = self.repo_dir(repo)
        for part in file["parts"]:
            final = folder / posixpath.basename(part["path"])
            try:
                if not final.is_file() or (part["size"] and final.stat().st_size != part["size"]):
                    return False
            except OSError:
                return False
        return True

    def free_bytes(self) -> int | None:
        target = self.paths.models_dir
        while not target.exists() and target.parent != target:
            target = target.parent
        try:
            return int(self._disk_usage(str(target)).free)
        except OSError:
            return None

    def _prepare_dir(self, repo: str) -> Path:
        root = self.paths.models_dir
        root.mkdir(parents=True, exist_ok=True)
        folder = self.repo_dir(repo)
        if folder.exists() and not inside(folder, root):
            raise HubError("A pasta de destino sai da pasta de modelos; download recusado.", "fora_das_pastas")
        folder.mkdir(parents=True, exist_ok=True)
        if not inside(folder, root):
            raise HubError("A pasta de destino sai da pasta de modelos; download recusado.", "fora_das_pastas")
        return folder

    # ---- downloads
    def active(self) -> Download | None:
        return next((d for d in self.items.values() if d.state in ACTIVE_STATES), None)

    async def start(self, repo: str, file: str, *, reuse_id: str | None = None) -> Download:
        """Valida, confere espaço e começa o download em segundo plano (um por vez)."""
        repo = validate_repo(repo)
        validate_repo_file(file)
        key = (repo.lower(), posixpath.basename(file).lower())
        current = self.active()
        if current is not None:
            if current.key == key:
                return current
            raise HubError("Já há um download em andamento. Espere terminar ou cancele.", "ocupado")
        detail = await self.repo_files(repo)
        if detail["restricted"]:
            raise HubError(
                "Este repositório é restrito: exige login no Hugging Face, o que ainda não é suportado.",
                "restrito",
            )
        entry = next((f for f in detail["files"] if any(p["path"] == file for p in f["parts"])), None)
        if entry is None:
            base = posixpath.basename(file).lower()
            entry = next(
                (f for f in detail["files"] if any(posixpath.basename(p["path"]).lower() == base for p in f["parts"])),
                None,
            )
        if entry is None:
            raise HubError("Este arquivo não está mais no repositório.", "arquivo_nao_encontrado")
        if not entry["complete"]:
            raise HubError("Faltam partes deste modelo no repositório.", "arquivo_invalido")
        if self.active() is not None:  # outro pedido começou enquanto consultávamos o Hugging Face
            raise HubError("Já há um download em andamento. Espere terminar ou cancele.", "ocupado")
        folder = self._prepare_dir(detail["id"])
        need = 0
        for part in entry["parts"]:
            final = folder / validate_repo_file(part["path"])
            if final.exists():
                if not final.is_file() or final.stat().st_size != part["size"]:
                    raise HubError(
                        f"Já existe um arquivo {final.name} diferente na pasta de modelos. Remova-o antes.",
                        "conflito",
                    )
                continue
            tmp = final.with_name(final.name + ".part")
            have = tmp.stat().st_size if tmp.is_file() else 0
            need += max(0, part["size"] - (have if have <= part["size"] else 0))
        free = self.free_bytes()
        if free is not None and free < need + DISK_MARGIN:
            raise HubError(
                f"Espaço insuficiente no disco: o download precisa de {need / 2**30:.1f} GB "
                f"e há {free / 2**30:.1f} GB livres.",
                "sem_espaco",
            )
        old = next((d for d in self.items.values() if d.key == key), None)
        if old is not None:
            self.items.pop(old.id, None)
        item = Download(
            id=reuse_id or (old.id if old else uuid.uuid4().hex[:12]), repo=detail["id"], file=entry["file"],
            name=entry["name"], parts=entry["parts"], total_bytes=entry["size_bytes"],
        )
        self.items[item.id] = item
        item.task = asyncio.create_task(self._run(item, folder, detail["revision"]))
        return item

    async def retry(self, download_id: str) -> Download:
        item = self._find(download_id)
        if item.state in ACTIVE_STATES:
            return item
        return await self.start(item.repo, item.file, reuse_id=item.id)

    async def cancel(self, download_id: str) -> Download:
        item = self._find(download_id)
        task = item.task
        if item.state in ACTIVE_STATES and task and not task.done():
            task.cancel()
            await asyncio.wait({task}, timeout=10)
            item.state = "cancelled"
        return item

    def forget(self, download_id: str) -> None:
        """Tira um item terminado, com erro ou cancelado da lista e apaga os ``.part`` dele."""
        item = self._find(download_id)
        if item.state in ACTIVE_STATES:
            raise HubError("Cancele o download antes de limpá-lo.", "ocupado")
        self.items.pop(item.id, None)
        if item.state == "done":
            return
        root = self.paths.models_dir
        folder = self.repo_dir(item.repo)
        for part in item.parts:
            tmp = folder / (posixpath.basename(part["path"]) + ".part")
            if tmp.is_file() and inside(tmp, root):
                with contextlib.suppress(OSError):
                    tmp.unlink()
        self._tidy(folder)

    def _find(self, download_id: str) -> Download:
        item = self.items.get(download_id)
        if item is None:
            self._scan_parts()
            item = self.items.get(download_id)
        if item is None:
            raise HubError("Download desconhecido.", "download_desconhecido")
        return item

    def list_downloads(self) -> list[dict]:
        self._scan_parts()
        return [d.to_dict() for d in self.items.values()]

    def _scan_parts(self) -> None:
        """Reconstrói como "interrompidos" os ``.part`` deixados por uma queda ou por fechar o app."""
        root = self.paths.models_dir
        for did in [k for k, d in self.items.items() if k.startswith("disk-") and d.state == "interrupted"]:
            self.items.pop(did, None)
        if not root.is_dir():
            return
        known = {
            (d.repo.lower(), posixpath.basename(p["path"]).lower())
            for d in self.items.values() for p in (d.parts or [{"path": d.file}])
        }
        found: dict[tuple[str, str], dict] = {}
        for tmp in sorted(root.glob("*/*/*.gguf.part")):
            rel = tmp.relative_to(root).parts
            repo = f"{rel[0]}/{rel[1]}"
            name = tmp.name[: -len(".part")]
            try:
                validate_repo(repo)
                validate_repo_file(name)
                if not tmp.is_file() or not inside(tmp, root):
                    continue
                size = tmp.stat().st_size
            except (HubError, OSError):
                continue
            if (repo.lower(), name.lower()) in known:
                continue
            match = SPLIT_RE.match(name)
            first = f"{match.group('base')}-00001-of-{match.group('total')}.gguf" if match else name
            group = found.setdefault((repo.lower(), first.lower()), {"repo": repo, "file": first, "parts": [], "done": 0})
            group["parts"].append({"path": name, "size": 0, "sha256": None})
            group["done"] += size
        for (repo_key, first_key), group in found.items():
            did = "disk-" + hashlib.sha256(f"{repo_key}/{first_key}".encode()).hexdigest()[:12]
            match = SPLIT_RE.match(group["file"])
            self.items[did] = Download(
                id=did, repo=group["repo"], file=group["file"],
                name=f"{match.group('base')}.gguf" if match else group["file"], parts=group["parts"],
                state="interrupted", done_bytes=group["done"],
                error_message="Download interrompido. Use Tentar de novo para continuar de onde parou.",
            )

    async def _run(self, item: Download, folder: Path, revision: str) -> None:
        item.state, item.error_code, item.error_message, item.warning = "downloading", None, None, None
        try:
            base = 0
            unverified = []
            for part in item.parts:
                final = folder / validate_repo_file(part["path"])
                if not final.exists():
                    ok = await self._fetch_part(item, part, final, base, revision)
                    if not ok:
                        unverified.append(final.name)
                base += part["size"]
                item.done_bytes = base
            item.verified = not unverified
            if unverified:
                item.warning = (
                    "O Hugging Face não publicou o SHA-256 deste arquivo, então a integridade não pôde ser "
                    "verificada."
                )
            first = folder / posixpath.basename(item.parts[0]["path"])
            item.model_id = first.relative_to(self.paths.models_dir).as_posix()
            item.speed_bps = 0.0
            item.state = "done"
            self._log(f"download concluído: {item.repo}/{item.file} ({'verificado' if item.verified else 'SEM verificação'})")
        except asyncio.CancelledError:
            item.state, item.speed_bps = "cancelled", 0.0
            self._log(f"download cancelado: {item.repo}/{item.file}")
            raise
        except HubError as exc:
            item.state, item.error_code, item.error_message, item.speed_bps = "error", exc.code, str(exc), 0.0
            self._log(f"ERRO no download {item.repo}/{item.file}: {exc.code}: {exc}")
        except OSError as exc:
            item.state, item.error_code, item.speed_bps = "error", "disco", 0.0
            item.error_message = f"Falha ao gravar no disco ({exc.__class__.__name__})."
            self._log(f"ERRO de disco no download {item.repo}/{item.file}: {exc}")
        except Exception as exc:  # noqa: BLE001 — vira estado de erro na interface
            log.warning("falha no download: %s", exc)
            item.state, item.error_code, item.speed_bps = "error", "rede", 0.0
            item.error_message = "Falha no download. Use Tentar de novo para continuar."
            self._log(f"ERRO no download {item.repo}/{item.file}: {exc.__class__.__name__}")

    async def _fetch_part(self, item: Download, part: dict, final: Path, base: int, revision: str) -> bool:
        """Baixa uma parte em ``.part`` (retomando), confere o SHA-256 e só então dá o nome final.

        Devolve ``True`` se o SHA-256 foi conferido e ``False`` se não havia hash publicado.
        """
        root = self.paths.models_dir
        tmp = final.with_name(final.name + ".part")
        for target in (tmp, final):
            if target.exists() and not inside(target, root):
                raise HubError("O arquivo de destino sai da pasta de modelos; download recusado.", "fora_das_pastas")
        size = part["size"]
        have = tmp.stat().st_size if tmp.is_file() else 0
        if have > size > 0:
            tmp.unlink()
            have = 0
        sha = hashlib.sha256()
        if have:
            await asyncio.to_thread(_hash_file, tmp, sha)
        item.done_bytes = base + have
        url = f"{HF_BASE}/{quote(item.repo, safe='/')}/resolve/{revision}/{quote(part['path'], safe='/')}"
        if not (size and have == size):
            self._log(f"download de {url} a partir do byte {have} ({size} bytes)")
            async with self.client.stream(url, have) as resp:
                mode = "ab"
                if have and resp.status_code == 200:
                    self._log("o servidor não aceitou retomar; recomeçando do zero")
                    have, sha, mode = 0, hashlib.sha256(), "wb"
                elif have and resp.status_code == 206:
                    if not resp.headers.get("content-range", "").startswith(f"bytes {have}-"):
                        raise HubError("O servidor devolveu um trecho inesperado do arquivo. Tente de novo.", "rede")
                elif resp.status_code == 416:
                    with contextlib.suppress(OSError):
                        tmp.unlink()
                    raise HubError("Não foi possível retomar o download. Tente de novo para recomeçar.", "rede")
                else:
                    HubClient.raise_for(resp)
                    if resp.status_code != 200:
                        raise HubError(f"Resposta inesperada do Hugging Face ({resp.status_code}).", "rede")
                if not inside(tmp, root):
                    raise HubError("O arquivo de destino sai da pasta de modelos; download recusado.", "fora_das_pastas")
                samples: deque[tuple[float, int]] = deque([(time.monotonic(), have)])
                with open(tmp, mode) as fh:
                    # Junta os pedaços recebidos e grava a cada ~1 MiB numa thread; se a
                    # conexão cair ou o download for cancelado, o que já chegou é gravado
                    # no ``.part`` (o ``finally``) para retomar exatamente dali.
                    buffer = bytearray()
                    try:
                        async for chunk in resp.aiter_bytes():
                            if size and have + len(chunk) > size:
                                raise HubError("O servidor enviou mais dados do que o esperado.", "rede")
                            buffer += chunk
                            if len(buffer) >= CHUNK:
                                data, buffer = bytes(buffer), bytearray()
                                await asyncio.to_thread(_write_and_hash, fh, sha, data)
                            have += len(chunk)
                            item.done_bytes = base + have
                            now = time.monotonic()
                            samples.append((now, have))
                            while len(samples) > 2 and now - samples[0][0] > 3.0:
                                samples.popleft()
                            elapsed = now - samples[0][0]
                            if elapsed > 0.2:
                                item.speed_bps = (have - samples[0][1]) / elapsed
                    except httpx.TransportError as exc:
                        raise HubError(
                            "A conexão caiu durante o download. Use Tentar de novo para continuar de onde parou.",
                            "rede",
                        ) from exc
                    finally:
                        if buffer:
                            _write_and_hash(fh, sha, bytes(buffer))
            if size and have != size:
                raise HubError(
                    "O download parou antes do fim. Use Tentar de novo para continuar de onde parou.", "rede"
                )
        item.state = "verifying"
        expected = part.get("sha256")
        verified = False
        if expected:
            actual = sha.hexdigest()
            if not secrets.compare_digest(actual, expected):
                with contextlib.suppress(OSError):
                    tmp.unlink()
                self._log(f"ERRO: SHA-256 divergente em {final.name} (esperado {expected}, obtido {actual}); descartado")
                raise HubError(
                    "O arquivo baixado não confere com o SHA-256 publicado e foi descartado. Tente de novo.",
                    "hash_divergente",
                )
            verified = True
            self._log(f"SHA-256 conferido em {final.name}: {actual}")
        else:
            self._log(f"AVISO: {final.name} sem SHA-256 publicado; arquivo NÃO verificado")
        if not inside(tmp, root) or not inside(final, root):
            raise HubError("O arquivo de destino sai da pasta de modelos; download recusado.", "fora_das_pastas")
        os.replace(tmp, final)
        item.state = "downloading"
        return verified

    async def shutdown(self) -> None:
        """Cancela o download em curso (o ``.part`` fica para retomar depois)."""
        for item in list(self.items.values()):
            if item.task and not item.task.done():
                item.task.cancel()
                with contextlib.suppress(asyncio.CancelledError, Exception):
                    await item.task

    # ---- modelos locais
    async def remove_model(self, model_id: str) -> dict:
        """Apaga do disco um modelo da pasta do app (todas as partes). Pastas extras: recusado."""
        if self.engine is None:
            raise HubError("O gerenciamento de modelos não está ativo.", "engine_unavailable")
        model = await asyncio.to_thread(self.engine.resolve_model, model_id)
        if model is None:
            raise HubError("Modelo não encontrado nas pastas de modelos.", "model_not_found")
        if model.get("source") != "app":
            raise HubError(
                "Este modelo está numa pasta extra. O Henduran não apaga arquivos de outras pastas; "
                "remova a pasta da lista ou apague o arquivo pelo Explorador de Arquivos.",
                "pasta_externa",
            )
        root = self.paths.models_dir
        files = [Path(f) for f in model.get("files") or [model["path"]]]
        for f in files:
            if f.suffix.lower() != ".gguf" or not f.is_file() or not inside(f, root):
                raise HubError("Só é possível apagar arquivos .gguf dentro da pasta de modelos.", "fora_das_pastas")
        busy = self.active()
        if busy is not None:
            busy_dir = self.repo_dir(busy.repo).resolve()
            if any(f.resolve().parent == busy_dir for f in files):
                raise HubError("Há um download em andamento neste repositório. Espere ou cancele.", "ocupado")
        if self.settings.get("active_model") == model["id"]:
            await self.engine.stop()
            self.settings.update(active_model=None)
        for f in files:
            f.unlink()
        self._log(f"modelo removido: {model['id']} ({len(files)} arquivo(s))")
        self._tidy(files[0].parent)
        return {"removed": model["id"], "files": len(files)}

    def _tidy(self, folder: Path) -> None:
        """Remove pastas vazias de ``<autor>/<repo>`` até a pasta de modelos (exclusive)."""
        root = self.paths.models_dir.resolve()
        current = folder
        with contextlib.suppress(OSError):
            while current.resolve() != root and current.resolve().is_relative_to(root) and current.is_dir():
                if any(current.iterdir()):
                    break
                current.rmdir()
                current = current.parent

    # ---- pastas
    def folders(self) -> list[dict]:
        out = [{"path": str(self.paths.models_dir), "kind": "app", "exists": self.paths.models_dir.is_dir()}]
        for folder in self.settings.get("model_folders"):
            out.append({"path": folder, "kind": "extra", "exists": Path(folder).is_dir()})
        return out

    def add_folder(self, raw: str) -> dict:
        text = str(raw or "").strip().strip('"').strip()
        if not text or "\x00" in text or len(text) > 1024:
            raise HubError("Informe o caminho completo de uma pasta.", "pasta_invalida")
        path = Path(text).expanduser()
        if not path.is_absolute():
            raise HubError("Informe o caminho completo da pasta (por exemplo, D:\\Modelos).", "pasta_invalida")
        if not path.exists():
            raise HubError(f"A pasta não existe: {text}", "pasta_inexistente")
        if not path.is_dir():
            raise HubError("O caminho informado não é uma pasta.", "pasta_invalida")
        resolved = path.resolve()
        if resolved.parent == resolved or resolved == Path.home().resolve():
            raise HubError(
                "Escolha a pasta onde estão os modelos, não uma unidade inteira nem a pasta do usuário.",
                "pasta_invalida",
            )
        current = self.settings.get("model_folders")
        if len(current) >= MAX_MODEL_FOLDERS:
            raise HubError(f"Limite de {MAX_MODEL_FOLDERS} pastas extras.", "pasta_invalida")
        for other in [self.paths.root, *map(Path, current)]:
            other_r = other.resolve()
            if resolved == other_r or resolved.is_relative_to(other_r) or other_r.is_relative_to(resolved):
                raise HubError("Esta pasta já está incluída ou se sobrepõe a outra pasta de modelos.", "pasta_sobreposta")
        self.settings.update(model_folders=[*current, str(resolved)])
        return {"path": str(resolved), "kind": "extra", "exists": True}

    async def remove_folder(self, raw: str) -> None:
        """Tira uma pasta extra da lista. **Nenhum arquivo é apagado.**"""
        key = os.path.normcase(os.path.normpath(str(raw or "").strip().strip('"')))
        current = self.settings.get("model_folders")
        keep = [f for f in current if os.path.normcase(os.path.normpath(f)) != key]
        if len(keep) == len(current):
            raise HubError("Esta pasta não está na lista de pastas extras.", "pasta_desconhecida")
        active = self.settings.get("active_model")
        removed = [f for f in current if f not in keep]
        if self.engine is not None and active:
            if any(active.startswith(folder_prefix(f)) for f in removed):
                await self.engine.stop()
                self.settings.update(active_model=None)
        self.settings.update(model_folders=keep)

    # ---- procurar neste PC
    def scan_pc(self) -> dict:
        """Procura ``.gguf`` nas pastas comuns (Downloads, LM Studio, Documentos). **Só lê.**

        Nada é copiado, movido nem lembrado: o jogador decide se usa a pasta de um
        achado (``add_folder``). Modelos já dentro da pasta do app ou de uma pasta
        extra ficam de fora. Modelos divididos aparecem uma vez, pela primeira parte.
        """
        known = [self.paths.models_dir, *map(Path, self.settings.get("model_folders"))]
        known_r = []
        for folder in known:
            with contextlib.suppress(OSError):
                known_r.append(folder.resolve())
        searched: list[str] = []
        found: dict[str, dict] = {}
        visited = 0
        truncated = False
        for root in self._scan_roots():
            try:
                root_r = root.resolve()
                if not root.is_dir():
                    continue
            except OSError:
                continue
            if any(root_r == k or root_r.is_relative_to(k) for k in known_r):
                continue
            searched.append(str(root))
            for current, dirs, files in os.walk(root, onerror=lambda _exc: None):
                here = Path(current)
                depth = len(here.relative_to(root).parts)
                visited += 1
                if visited > SCAN_MAX_DIRS or len(found) >= SCAN_MAX_RESULTS:
                    truncated = True
                    break
                # sem links nem junções, sem pastas ocultas do sistema e sem as pastas já conhecidas
                keep = []
                for name in dirs:
                    sub = here / name
                    try:
                        if sub.is_symlink() or sub.is_junction() or name.startswith(("$", ".git", "node_modules")):
                            continue
                        sub_r = sub.resolve()
                    except OSError:
                        continue
                    if any(sub_r == k or sub_r.is_relative_to(k) for k in known_r):
                        continue
                    keep.append(name)
                dirs[:] = keep if depth < SCAN_MAX_DEPTH else []
                for name in sorted(files):
                    if not name.lower().endswith(".gguf") or "mmproj" in name.lower():
                        continue
                    path = here / name
                    try:
                        if path.is_symlink() or not path.is_file():
                            continue
                        size = path.stat().st_size
                    except OSError:
                        continue
                    match = SPLIT_RE.match(name)
                    if match:
                        key = str(here / f"{match.group('base')}-00001-of-{match.group('total')}.gguf").lower()
                        entry = found.setdefault(key, {
                            "path": str(here / f"{match.group('base')}-00001-of-{match.group('total')}.gguf"),
                            "folder": str(here), "name": f"{match.group('base')}.gguf",
                            "quant": quant_of(match.group("base")), "size_bytes": 0,
                            "parts": int(match.group("total")), "found_parts": 0,
                        })
                        entry["size_bytes"] += size
                        entry["found_parts"] += 1
                        continue
                    found[str(path).lower()] = {
                        "path": str(path), "folder": str(here), "name": name, "quant": quant_of(name),
                        "size_bytes": size, "parts": 1, "found_parts": 1,
                    }
        out = []
        for entry in found.values():
            entry["complete"] = entry.pop("found_parts") == entry["parts"]
            out.append(entry)
        out.sort(key=lambda e: (e["name"].lower(), e["path"].lower()))
        return {"found": out, "searched": searched, "truncated": truncated}


SCAN_MAX_DEPTH = 6
SCAN_MAX_DIRS = 20_000
SCAN_MAX_RESULTS = 200


def common_model_dirs() -> list[Path]:
    """Pastas onde costuma haver ``.gguf``: Downloads, as do LM Studio e Documentos."""
    home = Path.home()
    return [
        home / "Downloads",
        home / ".lmstudio" / "models",
        home / ".cache" / "lm-studio" / "models",
        home / "Documents",
    ]


def _hash_file(path: Path, sha: Any) -> None:
    with open(path, "rb") as fh:
        while chunk := fh.read(1 << 22):
            sha.update(chunk)


def _write_and_hash(fh: Any, sha: Any, chunk: bytes) -> None:
    fh.write(chunk)
    sha.update(chunk)


__all__ = [
    "HubClient", "HubError", "ModelHub", "Download", "check_url", "common_model_dirs", "group_gguf_files", "inside",
    "license_of", "safe_segment", "validate_repo", "validate_repo_file",
]
