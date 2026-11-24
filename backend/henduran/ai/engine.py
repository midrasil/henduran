"""Motor de IA local: o ``llama-server`` do llama.cpp, baixado, iniciado e parado pelo serviço.

Origem: ``CODED-Xavier/Caliope``, ``backend/app/runtime.py``, commit ``1cab9e0``.
Uso autorizado pelo autor (ver ``docs/main/auditoria-caliope.md``).

Adaptações para o Henduran:

- Pastas vindas de ``henduran.paths`` (sem ``APP_HOME``/``DATA_DIR``) e
  preferências de ``henduran.settings`` (sem dicionário de settings).
- Download **só por chamada explícita**, a partir dos releases oficiais de
  ``ggml-org/llama.cpp``: procura o asset exato ``llama-<tag>-bin-win-<variante>-x64.zip``
  em releases ``b<número>`` (o "latest" do GitHub aponta para um release sem
  binários; ver ``docs/main/importacoes-caliope.md``). Variantes ``vulkan``
  (padrão) e ``cpu``. Sem versão fixa de recuo: sem digest conhecido não há
  como verificar.
- **Integridade:** SHA-256 conferido com o ``digest`` da API do GitHub; sem
  digest, só com ``allow_unverified`` (registrado no log do motor); digest
  divergente descarta o arquivo.
- **Extração segura:** rejeita caminhos absolutos, ``..``, links simbólicos e
  qualquer destino fora da pasta; limita o tamanho descompactado.
- ``llama-server`` só em ``127.0.0.1``, porta livre por execução e chave de API
  aleatória por execução, passada pela variável ``LLAMA_API_KEY`` (fora da linha
  de comando). Variáveis ``LLAMA_*`` herdadas e o ``HENDURAN_TOKEN`` são
  removidos do ambiente do filho.
- Ciclo de vida: o filho herda o Job Object do shell Tauri (sem
  ``CREATE_BREAKAWAY_FROM_JOB``); como recuo, entra também num job próprio do
  serviço com ``KILL_ON_JOB_CLOSE`` (handles com tipos corretos de 64 bits).
  Um motor deixado por uma queda anterior só é encerrado se o executável
  estiver dentro da pasta ``engine/`` do Henduran.
- Descoberta de ``.gguf`` agrupa modelos divididos (``-00001-of-0000N``).
- Início assíncrono (``request_start``) para a interface acompanhar o estado.
- Servidor de embeddings omitido por ora: quando a memória semântica entrar
  (ADR-051/052), um segundo processo reentra em ``_run_start``, na porta seguinte.
"""

from __future__ import annotations

import asyncio
import contextlib
import hashlib
import io
import json
import logging
import os
import re
import secrets
import shutil
import socket
import stat
import subprocess
import time
import zipfile
from collections.abc import Awaitable, Callable
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import httpx

from henduran.paths import DataPaths
from henduran.settings import ENGINE_VARIANTS, SettingsStore

log = logging.getLogger("henduran.engine")

RELEASES_API = "https://api.github.com/repos/ggml-org/llama.cpp/releases?per_page=20"
DOWNLOAD_PREFIX = "https://github.com/ggml-org/llama.cpp/releases/download/"
TAG_RE = re.compile(r"^b\d+$")
ASSET_TEMPLATE = "llama-{tag}-bin-win-{variant}-x64.zip"
USER_AGENT = "Henduran"
MAX_DOWNLOAD_BYTES = 300_000_000
MAX_EXTRACTED_BYTES = 1_500_000_000
RELEASE_CACHE_SECONDS = 15 * 60
SOURCE_FILE = "SOURCE.json"
SERVER_NAMES = ("llama-server.exe", "llama-server")
LOG_NAME = "engine.log"
PID_NAME = "engine.pid"
HOST = "127.0.0.1"
READY_TIMEOUT = 240.0
SLOTS = 2

CREATE_NO_WINDOW = 0x08000000
CREATE_BREAKAWAY_FROM_JOB = 0x01000000  # nunca usado: o filho precisa ficar no job do app
SPAWN_FLAGS = CREATE_NO_WINDOW if os.name == "nt" else 0

STATES = ("stopped", "downloading", "starting", "ready", "error")


class EngineError(RuntimeError):
    """Falha do motor, com ``code`` estável para a interface."""

    def __init__(self, message: str, code: str = "engine_error") -> None:
        super().__init__(message)
        self.code = code


# ------------------------------------------------------------------ releases
@dataclass(frozen=True)
class ReleaseAsset:
    tag: str
    variant: str
    name: str
    url: str
    size: int
    digest: str | None  # hex SHA-256 ou None quando o GitHub não informa

    def to_dict(self) -> dict:
        out = asdict(self)
        out["verifiable"] = self.digest is not None
        return out


def parse_digest(value: Any) -> str | None:
    if isinstance(value, str) and value.lower().startswith("sha256:"):
        hexpart = value[7:].strip().lower()
        if re.fullmatch(r"[0-9a-f]{64}", hexpart):
            return hexpart
    return None


def pick_asset(releases: Any, variant: str) -> ReleaseAsset | None:
    """Primeiro release ``b<número>`` com o asset Windows x64 exato da variante."""
    for rel in releases if isinstance(releases, list) else []:
        if not isinstance(rel, dict) or rel.get("draft"):
            continue
        tag = str(rel.get("tag_name") or "")
        if not TAG_RE.match(tag):
            continue
        expected = ASSET_TEMPLATE.format(tag=tag, variant=variant)
        for asset in rel.get("assets") or []:
            if not isinstance(asset, dict) or asset.get("name") != expected:
                continue
            url = str(asset.get("browser_download_url") or "")
            if not url.startswith(DOWNLOAD_PREFIX):
                continue
            try:
                size = int(asset.get("size") or 0)
            except (TypeError, ValueError):
                size = 0
            return ReleaseAsset(tag, variant, expected, url, size, parse_digest(asset.get("digest")))
    return None


# ------------------------------------------------------------------ zip seguro
def _unsafe_name(name: str) -> bool:
    if not name or "\x00" in name or name.startswith(("/", "\\")) or re.match(r"^[A-Za-z]:", name):
        return True
    return ".." in re.split(r"[\\/]+", name)


def extract_zip_safely(data: bytes, dest: Path) -> None:
    """Extrai ``data`` em ``dest`` validando todas as entradas antes de gravar."""
    try:
        zf = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile as exc:
        raise EngineError("O arquivo baixado não é um ZIP válido.", "bad_archive") from exc
    with zf:
        infos = zf.infolist()
        if not any(Path(i.filename.replace("\\", "/")).name.lower() in SERVER_NAMES for i in infos):
            raise EngineError("O arquivo baixado não contém o llama-server.", "bad_archive")
        dest.mkdir(parents=True, exist_ok=True)
        root = dest.resolve()
        total = 0
        for info in infos:
            name = info.filename
            if _unsafe_name(name):
                raise EngineError("O arquivo baixado contém caminhos inseguros.", "unsafe_archive")
            mode = (info.external_attr >> 16) & 0xFFFF
            if stat.S_ISLNK(mode):
                raise EngineError("O arquivo baixado contém links simbólicos.", "unsafe_archive")
            target = (dest / name).resolve()
            if target != root and not target.is_relative_to(root):
                raise EngineError("O arquivo baixado contém caminhos inseguros.", "unsafe_archive")
            total += max(0, info.file_size)
            if total > MAX_EXTRACTED_BYTES:
                raise EngineError("O arquivo baixado é grande demais ao descompactar.", "bad_archive")
        for info in infos:
            target = dest / info.filename
            if info.is_dir():
                target.mkdir(parents=True, exist_ok=True)
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            with zf.open(info) as src, open(target, "wb") as dst:
                shutil.copyfileobj(src, dst, 1 << 20)


# ------------------------------------------------------------------ modelos
SPLIT_RE = re.compile(r"^(?P<base>.+)-(?P<index>\d{5})-of-(?P<total>\d{5})\.gguf$", re.I)
QUANT_RE = re.compile(
    r"(?:^|[-_.])((?:I?Q\d(?:_[A-Z0-9]+)*)|BF16|F16|F32|FP16)(?=$|[-_.])", re.I
)


def quant_of(name: str) -> str | None:
    """Quantização inferida pelo nome do arquivo (``Q4_K_M``, ``IQ3_XS``, ``F16``...)."""
    stem = name[:-5] if name.lower().endswith(".gguf") else name
    split = SPLIT_RE.match(stem + ".gguf")
    if split:
        stem = split.group("base")
    found = QUANT_RE.findall(stem)
    return found[-1].upper() if found else None


def find_models(models_dir: Path, *, id_prefix: str = "", source: str = "app") -> list[dict]:
    """Modelos ``.gguf`` em ``models_dir`` (subpastas incluídas), por nome.

    Modelos divididos aparecem uma vez, pela parte ``-00001-of-N``, com o tamanho
    somado e ``complete=False`` se faltar alguma parte. ``mmproj`` é ignorado.
    ``files`` lista todos os arquivos do modelo (todas as partes presentes);
    ``id_prefix`` distingue modelos de pastas extras (ver ``folder_prefix``).
    """
    if not models_dir.is_dir():
        return []
    root = models_dir.resolve()
    singles: list[dict] = []
    groups: dict[tuple[str, str, int], dict] = {}
    for path in sorted(models_dir.rglob("*")):
        if path.suffix.lower() != ".gguf" or "mmproj" in path.name.lower():
            continue
        try:
            if not path.is_file() or not path.resolve().is_relative_to(root):
                continue
            size = path.stat().st_size
        except OSError:
            continue
        rel = path.relative_to(models_dir).as_posix()
        match = SPLIT_RE.match(path.name)
        if not match:
            singles.append(
                {"id": id_prefix + rel, "name": path.name, "path": str(path), "size_bytes": size,
                 "quant": quant_of(path.name), "parts": 1, "complete": True,
                 "files": [str(path)], "root": str(models_dir), "source": source}
            )
            continue
        total = int(match.group("total"))
        key = (path.parent.as_posix(), match.group("base").lower(), total)
        group = groups.setdefault(key, {"base": match.group("base"), "total": total, "parts": {}, "dir": path.parent})
        group["parts"][int(match.group("index"))] = (path, size)
    for group in groups.values():
        first = group["parts"].get(1)
        if first is None:
            continue  # sem a primeira parte o llama-server não carrega
        path = first[0]
        complete = sorted(group["parts"]) == list(range(1, group["total"] + 1))
        singles.append(
            {"id": id_prefix + path.relative_to(models_dir).as_posix(), "name": f"{group['base']}.gguf",
             "path": str(path), "size_bytes": sum(s for _, s in group["parts"].values()),
             "quant": quant_of(group["base"]), "parts": group["total"], "complete": complete,
             "files": [str(p) for _, (p, _s) in sorted(group["parts"].items())],
             "root": str(models_dir), "source": source}
        )
    return sorted(singles, key=lambda m: (m["name"].lower(), m["id"]))


def folder_prefix(folder: str | Path) -> str:
    """Prefixo estável do id dos modelos de uma pasta extra: ``ext:<8 hex>/``.

    Usa ``:``, que não pode aparecer num nome de arquivo do Windows; assim um id
    de pasta extra nunca colide com o caminho relativo de um modelo do app.
    """
    key = os.path.normcase(os.path.normpath(str(folder))).encode("utf-8", "surrogatepass")
    return f"ext:{hashlib.sha256(key).hexdigest()[:8]}/"


# ------------------------------------------------------------------ comando
def server_binary(engine_dir: Path) -> Path | None:
    if not engine_dir.is_dir():
        return None
    for name in SERVER_NAMES:
        for path in sorted(engine_dir.rglob(name)):
            if path.is_file():
                return path
    return None


def fit_ladder(layers: str = "auto", variant: str = "vulkan") -> list[tuple[int, str]]:
    """Tentativas de início, da mais rápida à mais leve na memória da placa."""
    if variant == "cpu":
        return [(SLOTS, "0"), (1, "0")]
    if str(layers).strip().lower() in ("auto", ""):
        return [(SLOTS, "auto"), (1, "auto"), (1, "26"), (1, "18")]
    return [(SLOTS, str(layers)), (1, str(layers))]


def out_of_memory(log_text: str) -> bool:
    t = log_text.lower()
    return any(
        k in t
        for k in ("outofdevicememory", "out of memory", "failed to allocate", "unable to allocate")
    )


def build_command(binary: Path, model: str, ctx: int, port: int, gpu_layers: str, slots: int = SLOTS) -> list[str]:
    """Linha de comando do llama-server. A chave de API vai por ``LLAMA_API_KEY``.

    Dois *slots*, cada um com o contexto inteiro (como no Caliope), deixam
    espaço para o Narrador Geral e o da Cena sem descartar o cache um do outro.
    """
    return [
        str(binary), "-m", model, "--host", HOST, "--port", str(port),
        "-ngl", str(gpu_layers or "auto"), "--no-webui",
        "-c", str(int(ctx) * slots), "-np", str(slots), "--cache-reuse", "256",
    ]


def child_env(api_key: str) -> dict[str, str]:
    """Ambiente do llama-server: sem ``LLAMA_*`` herdadas nem o token do serviço."""
    env = {
        k: v for k, v in os.environ.items()
        if not k.upper().startswith("LLAMA_") and k.upper() != "HENDURAN_TOKEN"
    }
    env["LLAMA_API_KEY"] = api_key
    return env


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind((HOST, 0))
        return s.getsockname()[1]


# ------------------------------------------------------------------ Windows
_JOBS: list[int] = []


def tie_to_service(proc: subprocess.Popen) -> bool:
    """Coloca o filho num job próprio com ``KILL_ON_JOB_CLOSE`` (recuo fora do Tauri).

    O handle do job fica aberto enquanto o serviço viver; se o serviço morrer,
    o Windows fecha o handle e encerra o motor. Dentro do Tauri o filho já está
    no job do app (herdado), e jobs aninhados são aceitos no Windows 8+.
    """
    if os.name != "nt":
        return False
    try:
        import ctypes
        from ctypes import wintypes

        k32 = ctypes.WinDLL("kernel32", use_last_error=True)
        k32.CreateJobObjectW.restype = wintypes.HANDLE
        k32.CreateJobObjectW.argtypes = [ctypes.c_void_p, wintypes.LPCWSTR]
        k32.SetInformationJobObject.restype = wintypes.BOOL
        k32.SetInformationJobObject.argtypes = [wintypes.HANDLE, ctypes.c_int, ctypes.c_void_p, wintypes.DWORD]
        k32.AssignProcessToJobObject.restype = wintypes.BOOL
        k32.AssignProcessToJobObject.argtypes = [wintypes.HANDLE, wintypes.HANDLE]

        class BASIC(ctypes.Structure):
            _fields_ = [
                ("PerProcessUserTimeLimit", ctypes.c_int64), ("PerJobUserTimeLimit", ctypes.c_int64),
                ("LimitFlags", wintypes.DWORD), ("MinimumWorkingSetSize", ctypes.c_size_t),
                ("MaximumWorkingSetSize", ctypes.c_size_t), ("ActiveProcessLimit", wintypes.DWORD),
                ("Affinity", ctypes.c_size_t), ("PriorityClass", wintypes.DWORD),
                ("SchedulingClass", wintypes.DWORD),
            ]

        class IO(ctypes.Structure):
            _fields_ = [(n, ctypes.c_uint64) for n in ("R", "W", "O", "RT", "WT", "OT")]

        class EXTENDED(ctypes.Structure):
            _fields_ = [
                ("Basic", BASIC), ("Io", IO), ("ProcessMemoryLimit", ctypes.c_size_t),
                ("JobMemoryLimit", ctypes.c_size_t), ("PeakProcessMemoryUsed", ctypes.c_size_t),
                ("PeakJobMemoryUsed", ctypes.c_size_t),
            ]

        job = k32.CreateJobObjectW(None, None)
        if not job:
            raise OSError(ctypes.get_last_error(), "CreateJobObjectW")
        info = EXTENDED()
        info.Basic.LimitFlags = 0x2000  # JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
        if not k32.SetInformationJobObject(job, 9, ctypes.byref(info), ctypes.sizeof(info)):
            raise OSError(ctypes.get_last_error(), "SetInformationJobObject")
        if not k32.AssignProcessToJobObject(job, int(proc._handle)):  # noqa: SLF001
            raise OSError(ctypes.get_last_error(), "AssignProcessToJobObject")
        _JOBS.append(job)
        return True
    except Exception as exc:  # noqa: BLE001 — melhor esforço; o job do Tauri continua valendo
        log.warning("não foi possível amarrar o motor ao serviço: %s", exc)
        return False


def _process_image(pid: int) -> str | None:
    if os.name != "nt":
        return None
    import ctypes
    from ctypes import wintypes

    k32 = ctypes.WinDLL("kernel32", use_last_error=True)
    k32.OpenProcess.restype = wintypes.HANDLE
    k32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    k32.QueryFullProcessImageNameW.argtypes = [wintypes.HANDLE, wintypes.DWORD, wintypes.LPWSTR, ctypes.POINTER(wintypes.DWORD)]
    k32.CloseHandle.argtypes = [wintypes.HANDLE]
    handle = k32.OpenProcess(0x1000, False, pid)  # PROCESS_QUERY_LIMITED_INFORMATION
    if not handle:
        return None
    try:
        buf = ctypes.create_unicode_buffer(32768)
        size = wintypes.DWORD(len(buf))
        if not k32.QueryFullProcessImageNameW(handle, 0, buf, ctypes.byref(size)):
            return None
        return buf.value
    finally:
        k32.CloseHandle(handle)


# ------------------------------------------------------------------ HTTP padrão
async def _http_status(url: str, headers: dict[str, str]) -> int:
    async with httpx.AsyncClient(timeout=3.0) as client:
        return (await client.get(url, headers=headers)).status_code


async def _http_json(url: str) -> Any:
    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
        resp = await client.get(url, headers={"Accept": "application/vnd.github+json", "User-Agent": USER_AGENT})
        resp.raise_for_status()
        return resp.json()


async def _http_bytes(url: str, progress: Callable[[int, int], None]) -> bytes:
    buf = bytearray()
    async with httpx.AsyncClient(timeout=httpx.Timeout(30.0, read=120.0), follow_redirects=True) as client:
        async with client.stream("GET", url, headers={"User-Agent": USER_AGENT}) as resp:
            resp.raise_for_status()
            total = int(resp.headers.get("content-length") or 0)
            async for chunk in resp.aiter_bytes(1 << 16):
                buf.extend(chunk)
                if len(buf) > MAX_DOWNLOAD_BYTES:
                    raise EngineError("O download ficou maior do que o esperado.", "bad_archive")
                progress(len(buf), total)
    return bytes(buf)


FetchJson = Callable[[str], Awaitable[Any]]
FetchBytes = Callable[[str, Callable[[int, int], None]], Awaitable[bytes]]
HttpStatus = Callable[[str, dict[str, str]], Awaitable[int]]


# ------------------------------------------------------------------ gerente
class EngineManager:
    """Um ``llama-server`` por vez, com estados ``stopped|downloading|starting|ready|error``."""

    def __init__(
        self,
        paths: DataPaths,
        settings: SettingsStore,
        *,
        fetch_json: FetchJson | None = None,
        fetch_bytes: FetchBytes | None = None,
        http_status: HttpStatus | None = None,
        launcher: Callable[[Path], list[str]] | None = None,
        ready_timeout: float = READY_TIMEOUT,
        poll_interval: float = 0.5,
    ) -> None:
        self.paths = paths
        self.settings = settings
        self._fetch_json = fetch_json or _http_json
        self._fetch_bytes = fetch_bytes or _http_bytes
        self._http_status = http_status or _http_status
        self._launcher = launcher or (lambda binary: [str(binary)])
        self._ready_timeout = ready_timeout
        self._poll = poll_interval
        self.process: subprocess.Popen | None = None
        self.port: int | None = None
        self._api_key: str | None = None
        self.state = "stopped"
        self.message = ""
        self.progress = 0.0
        self._lock = asyncio.Lock()
        self._start_task: asyncio.Task | None = None
        self._download_task: asyncio.Task | None = None
        self._release_cache: dict[str, tuple[float, ReleaseAsset]] = {}
        self._fit: dict[tuple, tuple[int, str]] = {}

    # ---- caminhos
    @property
    def log_path(self) -> Path:
        return self.paths.logs_dir / LOG_NAME

    @property
    def pid_path(self) -> Path:
        return self.paths.logs_dir / PID_NAME

    def binary(self) -> Path | None:
        return server_binary(self.paths.engine_dir)

    def source_info(self) -> dict:
        try:
            data = json.loads((self.paths.engine_dir / SOURCE_FILE).read_text(encoding="utf-8"))
            return data if isinstance(data, dict) else {}
        except (OSError, ValueError):
            return {}

    def model_roots(self) -> list[tuple[str, Path, str]]:
        """``(prefixo de id, pasta, origem)``: a pasta do app e depois as pastas extras."""
        roots: list[tuple[str, Path, str]] = [("", self.paths.models_dir, "app")]
        for folder in self.settings.get("model_folders"):
            roots.append((folder_prefix(folder), Path(folder), "extra"))
        return roots

    def models(self) -> list[dict]:
        found: list[dict] = []
        for prefix, folder, source in self.model_roots():
            found.extend(find_models(folder, id_prefix=prefix, source=source))
        return sorted(found, key=lambda m: (m["name"].lower(), m["id"]))

    def resolve_model(self, model_id: str | None) -> dict | None:
        if not model_id:
            return None
        return next((m for m in self.models() if m["id"] == model_id), None)

    def model_options(self, model_id: str | None) -> dict:
        """Ajustes de carga do modelo: ``context_size`` (o salvo ou o global) e ``gpu_layers`` (o salvo ou ``auto``)."""
        saved = self.settings.get("model_options").get(model_id or "", {})
        return {
            "context_size": int(saved.get("context_size") or self.settings.get("context_size")),
            "gpu_layers": saved.get("gpu_layers", "auto"),
        }

    # ---- estado
    def _set(self, state: str, message: str) -> None:
        assert state in STATES
        self.state, self.message = state, message

    def endpoint(self) -> tuple[str, str] | None:
        """``(base_url, api_key)`` do motor pronto, ou ``None``."""
        self._check_alive()
        if self.state == "ready" and self.port and self._api_key:
            return f"http://{HOST}:{self.port}/v1", self._api_key
        return None

    def _check_alive(self) -> None:
        if self.state == "ready" and (self.process is None or self.process.poll() is not None):
            self._set("error", "O motor de IA parou inesperadamente. Veja o log do motor e tente de novo.")

    def status(self, with_log: bool = True) -> dict:
        self._check_alive()
        source = self.source_info()
        active = self.settings.get("active_model")
        model = self.resolve_model(active) if active else None
        out = {
            "state": self.state,
            "message": self.message,
            "progress": round(self.progress, 3),
            "installed": self.binary() is not None,
            "version": source.get("tag"),
            "variant": source.get("variant"),
            "verified": source.get("verified"),
            "active_model": active,
            "active_model_name": model["name"] if model else None,
        }
        if with_log:
            out["log"] = self.log_tail()
        return out

    def log_tail(self, lines: int = 12) -> str:
        """Fim do log do motor (lê só os últimos KB; a interface consulta a cada ~1,5 s)."""
        try:
            with open(self.log_path, "rb") as fh:
                fh.seek(0, os.SEEK_END)
                fh.seek(max(0, fh.tell() - 8192))
                text = fh.read().decode("utf-8", errors="replace")
        except OSError:
            return ""
        return "\n".join(text.splitlines()[-lines:])

    def _log(self, line: str) -> None:
        self.paths.logs_dir.mkdir(parents=True, exist_ok=True)
        with open(self.log_path, "a", encoding="utf-8", errors="replace") as fh:
            fh.write(f"[henduran {time.strftime('%Y-%m-%d %H:%M:%S')}] {line}\n")

    # ---- download
    async def lookup_release(self, variant: str, *, refresh: bool = False) -> ReleaseAsset:
        if variant not in ENGINE_VARIANTS:
            raise EngineError(f"Variante do motor desconhecida: {variant}.", "invalid_variant")
        cached = self._release_cache.get(variant)
        if cached and not refresh and time.monotonic() - cached[0] < RELEASE_CACHE_SECONDS:
            return cached[1]
        try:
            releases = await self._fetch_json(RELEASES_API)
        except Exception as exc:  # noqa: BLE001
            raise EngineError(
                "Não foi possível consultar os releases do llama.cpp no GitHub. Verifique a internet.",
                "release_lookup_failed",
            ) from exc
        asset = pick_asset(releases, variant)
        if asset is None:
            raise EngineError(
                f"Nenhum release recente do llama.cpp tem o motor {variant} para Windows.",
                "release_not_found",
            )
        self._release_cache[variant] = (time.monotonic(), asset)
        return asset

    async def install(self, variant: str, *, allow_unverified: bool = False) -> asyncio.Task:
        """Valida e inicia o download em segundo plano; acompanhe por ``status()``."""
        if self.state == "downloading":
            raise EngineError("O motor já está sendo baixado.", "busy")
        asset = await self.lookup_release(variant)
        if asset.digest is None and not allow_unverified:
            raise EngineError(
                "O GitHub não informou o SHA-256 deste arquivo; não há como verificar a integridade. "
                "Confirme para baixar mesmo assim.",
                "digest_unavailable",
            )
        self.progress = 0.0
        self._set("downloading", f"Baixando {asset.name}…")
        self._download_task = asyncio.create_task(self._download(asset, allow_unverified))
        return self._download_task

    async def download(self, variant: str, *, allow_unverified: bool = False) -> dict:
        """Baixa e instala, esperando terminar (usado nos testes)."""
        task = await self.install(variant, allow_unverified=allow_unverified)
        await task
        return self.status()

    async def _download(self, asset: ReleaseAsset, allow_unverified: bool) -> None:
        tmp = self.paths.root / "engine.new"
        try:
            self._log(f"download de {asset.url} ({asset.size} bytes)")
            if asset.digest is None:
                self._log("AVISO: sem SHA-256 publicado; download sem verificação, autorizado pelo jogador")
            data = await self._fetch_bytes(asset.url, self._on_progress)
            if len(data) > MAX_DOWNLOAD_BYTES or (asset.size and len(data) != asset.size):
                raise EngineError("O tamanho do arquivo baixado não confere.", "bad_archive")
            verified = False
            if asset.digest is not None:
                actual = hashlib.sha256(data).hexdigest()
                if not secrets.compare_digest(actual, asset.digest):
                    self._log(f"ERRO: SHA-256 divergente (esperado {asset.digest}, obtido {actual}); arquivo descartado")
                    raise EngineError(
                        "O arquivo baixado não confere com o SHA-256 publicado e foi descartado.",
                        "digest_mismatch",
                    )
                verified = True
                self._log(f"SHA-256 conferido: {actual}")
            self.message = "Extraindo o motor…"
            shutil.rmtree(tmp, ignore_errors=True)
            await asyncio.to_thread(extract_zip_safely, data, tmp)
            del data
            await self.stop(keep_state=True)
            shutil.rmtree(self.paths.engine_dir, ignore_errors=True)
            tmp.rename(self.paths.engine_dir)
            source = {
                "tag": asset.tag, "variant": asset.variant, "asset": asset.name, "url": asset.url,
                "sha256": asset.digest, "verified": verified,
                "installed_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
            }
            (self.paths.engine_dir / SOURCE_FILE).write_text(json.dumps(source, indent=2) + "\n", "utf-8")
            self.settings.update(engine_variant=asset.variant)
            self.progress = 1.0
            self._set("stopped", f"Motor de IA {asset.tag} ({asset.variant}) instalado.")
            self._log(f"motor instalado: {asset.name}")
        except asyncio.CancelledError:
            shutil.rmtree(tmp, ignore_errors=True)
            self._set("stopped", "Download cancelado.")
            raise
        except Exception as exc:  # noqa: BLE001 — vira estado de erro para a interface
            shutil.rmtree(tmp, ignore_errors=True)
            message = str(exc) if isinstance(exc, EngineError) else f"Falha no download do motor ({exc.__class__.__name__})."
            log.warning("falha no download do motor: %s", exc)
            self._set("error", message)

    def _on_progress(self, done: int, total: int) -> None:
        self.progress = done / total if total else 0.0
        self.message = f"Baixando o motor de IA… {done // 1_000_000} / {max(1, total // 1_000_000)} MB"

    # ---- início / parada
    def request_start(self) -> asyncio.Task:
        """Valida e começa a carregar o modelo ativo em segundo plano."""
        if self.state == "downloading":
            raise EngineError("Espere o download do motor terminar.", "busy")
        binary = self.binary()
        if binary is None:
            raise EngineError("O motor de IA ainda não foi baixado. Use a aba Modelos.", "engine_not_installed")
        active = self.settings.get("active_model")
        if not active:
            raise EngineError("Nenhum modelo escolhido. Escolha um na aba Modelos.", "no_model")
        model = self.resolve_model(active)
        if model is None:
            raise EngineError("O modelo escolhido não foi encontrado na pasta de modelos.", "no_model")
        if not model["complete"]:
            raise EngineError("Faltam partes deste modelo dividido na pasta de modelos.", "model_incomplete")
        if self._start_task and not self._start_task.done():
            self._start_task.cancel()
        self.progress = 0.0
        self._set("starting", "Carregando o modelo (a primeira vez pode levar um minuto)…")
        options = self.model_options(model["id"])
        self._start_task = asyncio.create_task(
            self._run_start(binary, model["path"], options["context_size"], options["gpu_layers"])
        )
        return self._start_task

    async def start(self) -> dict:
        task = self.request_start()
        with contextlib.suppress(asyncio.CancelledError):
            await task
        return self.status()

    async def _run_start(self, binary: Path, model: str, ctx: int | None = None, layers: str | int = "auto") -> None:
        async with self._lock:
            await self._stop_process()
            self._set("starting", "Carregando o modelo (a primeira vez pode levar um minuto)…")
            self._kill_stale()
            self._rotate_log()
            ctx = int(ctx or self.settings.get("context_size"))
            variant = self.source_info().get("variant") or self.settings.get("engine_variant")
            key = (model, ctx, variant, str(layers))
            tries = fit_ladder(str(layers), variant)
            if self._fit.get(key) in tries:
                tries = tries[tries.index(self._fit[key]):]
            try:
                for i, (slots, layers) in enumerate(tries):
                    self._launch(binary, model, ctx, slots, layers)
                    if await self._wait_ready():
                        self._fit[key] = (slots, layers)
                        return
                    if i + 1 < len(tries) and out_of_memory(self._raw_log_tail()):
                        log.info("memória de vídeo insuficiente com %s slot(s), camadas %s", slots, layers)
                        self._set("starting", "Memória de vídeo insuficiente: tentando um início mais leve…")
                        await self._stop_process()
                        continue
                    break
                await self._stop_process()
            except asyncio.CancelledError:
                await self._stop_process()
                raise

    def _launch(self, binary: Path, model: str, ctx: int, slots: int, layers: str) -> None:
        self.port = free_port()
        self._api_key = secrets.token_urlsafe(32)
        argv = self._launcher(binary) + build_command(binary, model, ctx, self.port, layers, slots)[1:]
        self.paths.logs_dir.mkdir(parents=True, exist_ok=True)
        with open(self.log_path, "a", encoding="utf-8", errors="replace") as logf:
            logf.write(f"\n===== {time.strftime('%Y-%m-%d %H:%M:%S')} {' '.join(argv)}\n")
            logf.flush()
            self.process = subprocess.Popen(
                argv, stdout=logf, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL,
                creationflags=SPAWN_FLAGS, cwd=str(binary.parent), env=child_env(self._api_key),
            )
        tie_to_service(self.process)
        with contextlib.suppress(OSError):
            self.pid_path.write_text(json.dumps([self.process.pid]))

    def _raw_log_tail(self) -> str:
        try:
            with open(self.log_path, "rb") as fh:
                fh.seek(0, os.SEEK_END)
                fh.seek(max(0, fh.tell() - 6000))
                return fh.read().decode("utf-8", "replace")
        except OSError:
            return ""

    async def _wait_ready(self) -> bool:
        end = time.monotonic() + self._ready_timeout
        url = f"http://{HOST}:{self.port}/health"
        headers = {"Authorization": f"Bearer {self._api_key}"}
        while time.monotonic() < end:
            if self.process is None:
                return False
            if self.process.poll() is not None:
                self._set(
                    "error",
                    "O motor parou enquanto carregava o modelo. Veja o log abaixo "
                    "(muitas vezes: memória de vídeo insuficiente).",
                )
                return False
            try:
                code = await self._http_status(url, headers)
            except Exception:  # noqa: BLE001
                code = 0
            if code == 200:
                self._set("ready", "Pronto")
                return True
            await asyncio.sleep(self._poll)
        self._set("error", "O modelo demorou demais para carregar.")
        return False

    async def stop(self, *, keep_state: bool = False) -> dict:
        task = self._start_task
        if task and not task.done():
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError, Exception):
                await task
        async with self._lock:
            await self._stop_process()
        if not keep_state and self.state != "downloading":
            self._set("stopped", "")
        return self.status()

    async def _stop_process(self) -> None:
        proc, self.process = self.process, None
        self.port = None
        self._api_key = None
        if proc and proc.poll() is None:
            proc.terminate()
            try:
                await asyncio.to_thread(proc.wait, 10)
            except subprocess.TimeoutExpired:
                proc.kill()
                await asyncio.to_thread(proc.wait, 10)
        with contextlib.suppress(OSError):
            self.pid_path.unlink()

    def stop_now(self) -> None:
        """Parada síncrona, para o encerramento do serviço."""
        proc, self.process = self.process, None
        if proc and proc.poll() is None:
            proc.terminate()
            try:
                proc.wait(5)
            except subprocess.TimeoutExpired:
                proc.kill()
        with contextlib.suppress(OSError):
            self.pid_path.unlink()
        if self.state != "downloading":
            self._set("stopped", "")

    def _rotate_log(self) -> None:
        """Um log por início (o anterior fica como ``engine.log.1``)."""
        with contextlib.suppress(OSError):
            if self.log_path.exists():
                self.log_path.replace(self.log_path.with_name(LOG_NAME + ".1"))

    def _kill_stale(self) -> None:
        """Encerra um motor deixado por uma queda, só se o executável for o nosso."""
        try:
            pids = json.loads(self.pid_path.read_text())
        except (OSError, ValueError):
            return
        engine_root = self.paths.engine_dir.resolve()
        for pid in pids if isinstance(pids, list) else []:
            try:
                image = _process_image(int(pid))
                if image and Path(image).resolve().is_relative_to(engine_root):
                    subprocess.run(
                        ["taskkill", "/PID", str(int(pid)), "/F"],
                        capture_output=True, creationflags=SPAWN_FLAGS, check=False,
                    )
            except (OSError, ValueError, TypeError):
                pass
        with contextlib.suppress(OSError):
            self.pid_path.unlink()


__all__ = [
    "EngineError", "EngineManager", "ReleaseAsset", "build_command", "child_env", "extract_zip_safely",
    "find_models", "fit_ladder", "folder_prefix", "out_of_memory", "pick_asset", "quant_of", "server_binary",
    "CREATE_BREAKAWAY_FROM_JOB", "SPAWN_FLAGS",
]
