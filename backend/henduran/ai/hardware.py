"""O que este PC tem: placa(s) de vídeo e memória, RAM e processador.

Origem: ``CODED-Xavier/Caliope``, ``backend/app/hardware.py``, commit ``1cab9e0``.
Uso autorizado pelo autor (ver ``docs/main/auditoria-caliope.md``).

Adaptações para o Henduran:

- Mantida a detecção (registro do driver de vídeo no Windows, que informa a
  memória exata também acima de 4 GB; ``nvidia-smi`` e ``/proc/meminfo`` fora
  do Windows). Valores agora em bytes.
- Leitores injetáveis (``Readers``) para testar sem depender da máquina.
- Cada leitura falha isoladamente e nunca derruba o serviço.
- **Removida** a lista curada de modelos de roleplay do Caliope (``PICKS`` e
  ``suggest``): a sugestão de modelos do Henduran é própria (ADR-070) e ainda
  não foi decidida.
- Novo ``estimate_fit``: estimativa simples de onde um modelo roda.
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
