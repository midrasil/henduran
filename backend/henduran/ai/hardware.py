"""O que este PC tem: placa(s) de vídeo e memória, RAM e processador.

Origem: ``CODED-Xavier/Caliope``, ``backend/app/hardware.py``, commit ``1cab9e0``.
Uso autorizado pelo autor (ver ``docs/main/auditoria-caliope.md``).

Adaptações para o Henduran:

- Mantida a detecção (registro do driver de vídeo no Windows, que informa a
  memória exata também acima de 4 GB; ``nvidia-smi`` e ``/proc/meminfo`` fora
  do Windows). Valores agora em bytes.
- Leitores injetáveis (``Readers``) para testar sem depender da máquina.
- Cada leitura falha isoladamente e nunca derruba o serviço.
- A lista de modelos do Caliope (``PICKS`` e ``suggest``) volta como **sugestões
  para este PC** da tela Modelos (``docs/ui-ux/14-modelos.md``; decisão do
  responsável de 2026-11-22): os mesmos modelos, quantizações, termos de busca e
  limites de memória, textos traduzidos. Em vez de um único modelo, ``suggest``
  devolve até 3 que cabem na placa (o primeiro é o que o Caliope escolheria).
  **Só sugestão**: nada é escolhido nem baixado sozinho. A lista não informa a
  licença (o jogador a confere no repositório antes de baixar).
- Novo ``estimate_fit``: estimativa simples de onde um modelo roda.
- Novo ``estimate_vram``: memória de vídeo estimada para um contexto e um
  número de camadas na placa (pesos proporcionais às camadas + cache de
  contexto em f16), a partir do cabeçalho do ``.gguf`` (``henduran.ai.gguf``).
"""

from __future__ import annotations

import ctypes
import logging
import platform
import re
import subprocess
import sys
from collections.abc import Callable
from dataclasses import dataclass
from typing import Literal

log = logging.getLogger("henduran.hardware")

GPU_CLASS = r"SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}"
IGNORED_ADAPTERS = re.compile(r"basic display|basic render|remote|virtual|parsec|mirage|idd", re.I)

Fit = Literal["gpu", "cpu_lento", "pesado_demais"]

# PROPOSTA A VALIDAR (não aprovada): folga sobre o tamanho do arquivo para o
# contexto e os buffers do motor. 1.2 = o arquivo mais ~20%.
FIT_HEADROOM = 1.2


# ----------------------------------------------------------------- Windows
def _windows_gpus() -> list[dict]:
    import winreg  # noqa: PLC0415 (somente Windows)

    out: list[dict] = []
    try:
        root = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, GPU_CLASS)
    except OSError:
        return out
    with root:
        for i in range(64):
            try:
                sub = winreg.EnumKey(root, i)
            except OSError:
                break
            if not sub.isdigit():
                continue
            try:
                key = winreg.OpenKey(root, sub)
            except OSError:
                continue
            with key:
                name, mem = "", 0
                try:
                    name = str(winreg.QueryValueEx(key, "DriverDesc")[0]).strip()
                except OSError:
                    pass
                for value in ("HardwareInformation.qwMemorySize", "HardwareInformation.MemorySize"):
                    try:
                        raw = winreg.QueryValueEx(key, value)[0]
                        mem = (
                            int.from_bytes(raw[:8], "little")
                            if isinstance(raw, (bytes, bytearray))
                            else int(raw)
                        )
                        if mem:
                            break
                    except (OSError, ValueError, TypeError):
                        continue
            if name and not IGNORED_ADAPTERS.search(name):
                out.append({"name": name, "memory_bytes": max(0, mem)})
    return out


def _windows_ram() -> int:
    class MEMORYSTATUSEX(ctypes.Structure):
        _fields_ = [
            ("dwLength", ctypes.c_ulong),
            ("dwMemoryLoad", ctypes.c_ulong),
            ("ullTotalPhys", ctypes.c_ulonglong),
            ("ullAvailPhys", ctypes.c_ulonglong),
            ("ullTotalPageFile", ctypes.c_ulonglong),
            ("ullAvailPageFile", ctypes.c_ulonglong),
            ("ullTotalVirtual", ctypes.c_ulonglong),
            ("ullAvailVirtual", ctypes.c_ulonglong),
            ("sullAvailExtendedVirtual", ctypes.c_ulonglong),
        ]

    st = MEMORYSTATUSEX()
    st.dwLength = ctypes.sizeof(MEMORYSTATUSEX)
    if not ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(st)):  # type: ignore[attr-defined]
        return 0
    return int(st.ullTotalPhys)


def _windows_cpu() -> str:
    import winreg  # noqa: PLC0415

    try:
        with winreg.OpenKey(
            winreg.HKEY_LOCAL_MACHINE, r"HARDWARE\DESCRIPTION\System\CentralProcessor\0"
        ) as key:
            return str(winreg.QueryValueEx(key, "ProcessorNameString")[0]).strip()
    except OSError:
        return platform.processor()


# --------------------------------------------------------------- outros SO
def _other_ram() -> int:
    try:
        with open("/proc/meminfo", encoding="utf-8") as fh:
            match = re.search(r"MemTotal:\s+(\d+)", fh.read())
        return int(match.group(1)) * 1024 if match else 0
    except OSError:
        return 0


def _nvidia_smi() -> list[dict]:
    try:
        out = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader,nounits"],
            capture_output=True,
            text=True,
            timeout=5,
        ).stdout
    except (OSError, subprocess.SubprocessError):
        return []
    gpus = []
    for line in out.splitlines():
        if "," in line:
            name, mem = line.rsplit(",", 1)
            try:
                mib = int(mem.strip() or 0)
            except ValueError:
                mib = 0
            gpus.append({"name": name.strip(), "memory_bytes": mib * 2**20})
    return gpus


def _other_cpu() -> str:
    return platform.processor() or platform.machine()


@dataclass
class Readers:
    gpus: Callable[[], list[dict]]
    ram: Callable[[], int]
    cpu: Callable[[], str]


def default_readers() -> Readers:
    if sys.platform == "win32":
        return Readers(_windows_gpus, _windows_ram, _windows_cpu)
    return Readers(_nvidia_smi, _other_ram, _other_cpu)


def _safe(fn: Callable, fallback, what: str):
    try:
        return fn()
    except Exception as exc:  # noqa: BLE001 — leitura de hardware nunca derruba o serviço
        log.warning("não foi possível ler %s: %s", what, exc)
        return fallback


def scan(readers: Readers | None = None) -> dict:
    """``{"gpus": [{"name", "memory_bytes"}], "ram_bytes", "cpu", "os"}``.

    Campo que não puder ser lido fica vazio (lista vazia, 0 ou texto vazio).
    """
    r = readers or default_readers()
    gpus_raw = _safe(r.gpus, [], "as placas de vídeo")
    gpus = []
    for g in gpus_raw if isinstance(gpus_raw, list) else []:
        if isinstance(g, dict) and g.get("name"):
            try:
                mem = max(0, int(g.get("memory_bytes") or 0))
            except (TypeError, ValueError):
                mem = 0
            gpus.append({"name": str(g["name"]), "memory_bytes": mem})
    ram = _safe(r.ram, 0, "a memória RAM")
    cpu = _safe(r.cpu, "", "o processador")
    return {
        "gpus": gpus,
        "ram_bytes": int(ram) if isinstance(ram, int) and ram > 0 else 0,
        "cpu": str(cpu or ""),
        "os": f"{platform.system()} {platform.release()}".strip(),
    }


def estimate_fit(model_size_bytes: int, hardware: dict) -> Fit:
    """Estimativa de onde o modelo roda. **Limiares provisórios, proposta a validar.**

    - ``"gpu"``: arquivo + ~20% cabe na memória da maior placa de vídeo;
    - ``"cpu_lento"``: senão, cabe na RAM (roda no processador, mais lento);
    - ``"pesado_demais"``: não cabe em nenhuma das duas.

    Não considera o contexto, a divisão entre placa e RAM nem a variante do
    motor instalada; serve só para orientar a escolha.
    """
    need = max(0, int(model_size_bytes)) * FIT_HEADROOM
    vram = max([g.get("memory_bytes") or 0 for g in hardware.get("gpus") or []] or [0])
    ram = hardware.get("ram_bytes") or 0
    if vram and need <= vram:
        return "gpu"
    if ram and need <= ram:
        return "cpu_lento"
    return "pesado_demais"


# ------------------------------------------------------------ sugestões
# Lista do Caliope (``backend/app/hardware.py``, commit ``1cab9e0``): memória de vídeo
# mínima em GiB, modelo, quantização a escolher, termo de busca e o porquê (traduzido).
PICKS: tuple[tuple[float, str, str, str, str], ...] = (
    (20, "Cydonia 24B (Mistral Small 24B roleplay)", "Q4_K_M", "Cydonia-24B",
     "Um modelo grande de roleplay: escrita mais rica e melhor memória dos detalhes. Precisa de uma placa com 20 GB ou mais."),
    (12, "Mag-Mell 12B (MN-12B-Mag-Mell-R1)", "Q6_K (16 GB) ou Q4_K_M (12 GB)", "Mag-Mell-R1",
     "Um dos melhores modelos de roleplay de 12B: criativo, bom com personagens e ainda rápido."),
    (7.5, "Stheno 8B (L3-8B-Stheno-v3.2)", "Q4_K_M", "Stheno-v3.2",
     "A escolha recomendada para placas de 8 GB: ótima qualidade de roleplay e respostas rápidas."),
    (5.5, "Stheno 8B (L3-8B-Stheno-v3.2)", "Q3_K_M", "Stheno-v3.2",
     "O arquivo menor do mesmo modelo cabe em 6 GB; um pouco menos preciso, ainda bom."),
    (3.5, "Llama 3.2 3B Instruct", "Q6_K", "Llama-3.2-3B-Instruct-GGUF",
     "Um modelo pequeno para placas de 4 GB. Rápido, mas com histórias mais simples que os maiores."),
)
# Sem placa adequada (Caliope): com 16 GiB de RAM ou mais, o Stheno no processador; senão, o Llama 3.2 3B.
CPU_PICK_MIN_RAM_GIB = 16
CPU_PICKS = (
    ("Stheno 8B (L3-8B-Stheno-v3.2)", "Q4_K_M", "Stheno-v3.2",
     "Não foi encontrada uma placa de vídeo adequada, então roda no processador: funciona, mas as respostas "
     "são lentas (algumas palavras por segundo). Uma placa de vídeo com 8 GB faz muita diferença."),
    ("Llama 3.2 3B Instruct", "Q4_K_M", "Llama-3.2-3B-Instruct-GGUF",
     "Este PC tem pouca memória para modelos de IA; um modelo pequeno roda no processador. "
     "As respostas serão lentas e simples."),
)
MAX_SUGGESTIONS = 3


def _pick(name: str, quant: str, search: str, why: str, gpu: bool, need_gib: float | None) -> dict:
    return {
        "name": name, "quant": quant, "search": search, "why": why, "gpu": gpu,
        "min_vram_bytes": int(need_gib * 2**30) if need_gib else 0,
        "license": None, "source": "Caliope",
    }


def suggest(hardware: dict) -> list[dict]:
    """Até 3 modelos da lista do Caliope para este PC, do mais indicado ao mais leve.

    Com placa de vídeo: os que cabem na maior placa (memória mínima da lista),
    sem repetir o mesmo modelo. Sem placa adequada: a escolha do Caliope para o
    processador, pela RAM. **Só sugestão.**
    """
    vram = max([g.get("memory_bytes") or 0 for g in hardware.get("gpus") or []] or [0]) / 2**30
    ram = (hardware.get("ram_bytes") or 0) / 2**30
    out: list[dict] = []
    seen: set[str] = set()
    if vram:
        for need, name, quant, search, why in PICKS:
            if vram >= need and search not in seen:
                seen.add(search)
                out.append(_pick(name, quant, search, why, True, need))
            if len(out) >= MAX_SUGGESTIONS:
                break
    if not out:
        name, quant, search, why = CPU_PICKS[0] if ram >= CPU_PICK_MIN_RAM_GIB else CPU_PICKS[1]
        out.append(_pick(name, quant, search, why, False, None))
    return out


def search_terms() -> list[str]:
    """Termos de busca da lista inteira, sem repetir (chips de sugestão de busca)."""
    terms: list[str] = []
    for *_, search, _why in PICKS:
        if search not in terms:
            terms.append(search)
    for _name, _quant, search, _why in CPU_PICKS:
        if search not in terms:
            terms.append(search)
    return terms


# -------------------------------------------------------- memória de vídeo
F16_BYTES = 2  # o cache de contexto do llama-server é f16 por padrão


def kv_bytes_per_token_layer(meta: dict) -> int | None:
    """Bytes do cache de contexto (K e V) por token e por camada, ou ``None`` sem os metadados."""
    heads = meta.get("head_count")
    heads_kv = meta.get("head_count_kv") or heads
    embd = meta.get("embedding_length")
    key_len = meta.get("key_length") or (embd // heads if embd and heads else None)
    value_len = meta.get("value_length") or key_len
    if not heads_kv or not key_len or not value_len:
        return None
    return int(heads_kv * (key_len + value_len) * F16_BYTES)


def estimate_vram(
    meta: dict | None,
    file_bytes: int,
    *,
    context_size: int,
    slots: int,
    gpu_layers: str | int,
    vram_bytes: int,
    variant: str | None,
) -> dict:
    """Memória de vídeo estimada para carregar o modelo. **Estimativa aproximada.**

    - camadas na placa: ``-ngl`` conta as camadas do modelo + a de saída (``block_count + 1``);
    - pesos na placa: o tamanho do arquivo proporcional às camadas na placa;
    - cache de contexto: ``tokens × camadas na placa × bytes por token e camada``, com
      ``tokens = contexto × slots`` (o motor reserva o contexto inteiro em cada slot).
    Não inclui os buffers de cálculo do motor. ``gpu_layers="auto"`` estima quantas
    camadas cabem na maior placa (todas, se a memória dela for desconhecida). Na
    variante CPU nada vai para a placa.
    """
    blocks = (meta or {}).get("block_count")
    total = blocks + 1 if blocks else None
    per_layer = kv_bytes_per_token_layer(meta or {})
    tokens = max(0, int(context_size)) * max(1, int(slots))
    out = {
        "total_layers": total, "layers_on_gpu": None, "weights_bytes": None, "kv_bytes": None,
        "vram_bytes": None, "vram_total_bytes": int(vram_bytes or 0), "known": False,
        "slots": int(slots), "variant": variant,
    }
    if total is None or per_layer is None:
        return out

    def need(n: int) -> tuple[int, int]:
        weights = int(file_bytes * n / total)
        kv = per_layer * tokens * min(n, blocks)
        return weights, kv

    if variant == "cpu":
        layers = 0
    elif str(gpu_layers).strip().lower() in ("auto", ""):
        layers = total
        if vram_bytes:
            layers = 0
            for n in range(total, -1, -1):
                if sum(need(n)) <= vram_bytes:
                    layers = n
                    break
    else:
        layers = max(0, min(total, int(gpu_layers)))
    weights, kv = need(layers)
    out.update(layers_on_gpu=layers, weights_bytes=weights, kv_bytes=kv, vram_bytes=weights + kv, known=True)
    return out
