from __future__ import annotations

import pytest

from henduran.ai.hardware import Readers, estimate_fit, scan

GB = 2**30


def readers(gpus=lambda: [], ram=lambda: 0, cpu=lambda: "") -> Readers:
    return Readers(gpus=gpus, ram=ram, cpu=cpu)


def test_scan_com_leituras_simuladas():
    info = scan(readers(
        gpus=lambda: [{"name": "Placa X", "memory_bytes": 8 * GB}, {"name": "", "memory_bytes": 1}, "lixo"],
        ram=lambda: 16 * GB,
        cpu=lambda: "Processador Y",
    ))
    assert info["gpus"] == [{"name": "Placa X", "memory_bytes": 8 * GB}]
    assert info["ram_bytes"] == 16 * GB
    assert info["cpu"] == "Processador Y"
    assert isinstance(info["os"], str)


def test_falha_de_leitura_nao_derruba():
    def boom():
        raise OSError("registro indisponível")

    info = scan(readers(gpus=boom, ram=boom, cpu=boom))
    assert info["gpus"] == [] and info["ram_bytes"] == 0 and info["cpu"] == ""


def test_memoria_invalida_vira_zero():
    info = scan(readers(gpus=lambda: [{"name": "P", "memory_bytes": "muito"}], ram=lambda: -5))
    assert info["gpus"] == [{"name": "P", "memory_bytes": 0}]
    assert info["ram_bytes"] == 0


def test_scan_real_nao_falha():
    info = scan()
    assert set(info) == {"gpus", "ram_bytes", "cpu", "os"}


@pytest.mark.parametrize(
    "size,vram,ram,expected",
    [
        (5 * GB, 8 * GB, 16 * GB, "gpu"),
        (int(6.9 * GB), 8 * GB, 16 * GB, "cpu_lento"),  # 6,9 GB + 20% passa de 8 GB
        (6 * GB, 0, 16 * GB, "cpu_lento"),
        (20 * GB, 8 * GB, 16 * GB, "pesado_demais"),
        (1 * GB, 0, 0, "pesado_demais"),
    ],
)
def test_estimate_fit(size, vram, ram, expected):
    hw = {"gpus": [{"name": "a", "memory_bytes": vram}] if vram else [], "ram_bytes": ram}
    assert estimate_fit(size, hw) == expected


def test_estimate_fit_usa_a_maior_placa():
    hw = {"gpus": [{"name": "integrada", "memory_bytes": GB}, {"name": "dedicada", "memory_bytes": 12 * GB}], "ram_bytes": 0}
    assert estimate_fit(8 * GB, hw) == "gpu"
