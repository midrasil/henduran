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


# ------------------------------------------------------------ sugestões
from henduran.ai.hardware import estimate_vram, kv_bytes_per_token_layer, search_terms, suggest  # noqa: E402


def hw_with(vram_gib: float = 0, ram_gib: float = 0) -> dict:
    gpus = [{"name": "placa", "memory_bytes": int(vram_gib * GB)}] if vram_gib else []
    return {"gpus": gpus, "ram_bytes": int(ram_gib * GB)}


@pytest.mark.parametrize(
    "vram,ram,first,count",
    [
        (24, 32, "Cydonia-24B", 3),
        (12, 32, "Mag-Mell-R1", 3),
        (8, 16, "Stheno-v3.2", 2),
        (6, 16, "Stheno-v3.2", 2),
        (4, 8, "Llama-3.2-3B-Instruct-GGUF", 1),
        (2, 16, "Stheno-v3.2", 1),  # placa pequena demais: a escolha do Caliope para o processador
        (0, 32, "Stheno-v3.2", 1),
        (0, 8, "Llama-3.2-3B-Instruct-GGUF", 1),
    ],
)
def test_sugestoes_pela_placa_e_pela_memoria(vram, ram, first, count):
    out = suggest(hw_with(vram, ram))
    assert out[0]["search"] == first and len(out) == count
    assert len({s["search"] for s in out}) == len(out)  # sem repetir o mesmo modelo
    assert all(s["license"] is None and s["source"] == "Caliope" for s in out)
    assert out[0]["gpu"] is (vram >= 3.5)


def test_sugestao_de_6_gb_usa_o_arquivo_menor():
    assert suggest(hw_with(6, 16))[0]["quant"] == "Q3_K_M"
    assert suggest(hw_with(8, 16))[0]["quant"] == "Q4_K_M"


def test_termos_de_busca_sem_repetir():
    assert search_terms() == ["Cydonia-24B", "Mag-Mell-R1", "Stheno-v3.2", "Llama-3.2-3B-Instruct-GGUF"]


# ---------------------------------------------------- memória de vídeo
META = {"block_count": 32, "embedding_length": 4096, "head_count": 32, "head_count_kv": 8}
PER_LAYER = 8 * (128 + 128) * 2  # 8 cabeças KV × (K + V de 128) × 2 bytes


def test_cache_de_contexto_por_token_e_camada():
    assert kv_bytes_per_token_layer(META) == PER_LAYER
    assert kv_bytes_per_token_layer({**META, "key_length": 64, "value_length": 32}) == 8 * 96 * 2
    assert kv_bytes_per_token_layer({"block_count": 3}) is None


def test_estimativa_com_camadas_escolhidas():
    out = estimate_vram(META, 33 * 2**20, context_size=8192, slots=2, gpu_layers=33, vram_bytes=12 * GB, variant="vulkan")
    assert out["known"] is True and out["total_layers"] == 33 and out["layers_on_gpu"] == 33
    assert out["weights_bytes"] == 33 * 2**20
    assert out["kv_bytes"] == PER_LAYER * 8192 * 2 * 32
    assert out["vram_bytes"] == out["weights_bytes"] + out["kv_bytes"]
    half = estimate_vram(META, 33 * 2**20, context_size=8192, slots=2, gpu_layers=11, vram_bytes=12 * GB, variant="vulkan")
    assert half["weights_bytes"] == 11 * 2**20 and half["kv_bytes"] == PER_LAYER * 8192 * 2 * 11
    over = estimate_vram(META, 1, context_size=4096, slots=1, gpu_layers=500, vram_bytes=0, variant="vulkan")
    assert over["layers_on_gpu"] == 33


def test_automatico_cabe_na_placa_ou_poe_menos_camadas():
    big = 8 * GB
    full = estimate_vram(META, big, context_size=4096, slots=2, gpu_layers="auto", vram_bytes=24 * GB, variant="vulkan")
    assert full["layers_on_gpu"] == 33
    part = estimate_vram(META, big, context_size=4096, slots=2, gpu_layers="auto", vram_bytes=6 * GB, variant="vulkan")
    assert 0 < part["layers_on_gpu"] < 33 and part["vram_bytes"] <= 6 * GB
    nofit = estimate_vram(META, 900 * GB, context_size=4096, slots=2, gpu_layers="auto", vram_bytes=GB, variant="vulkan")
    assert nofit["layers_on_gpu"] == 0 and nofit["vram_bytes"] == 0
    unknown_card = estimate_vram(META, big, context_size=4096, slots=2, gpu_layers="auto", vram_bytes=0, variant="vulkan")
    assert unknown_card["layers_on_gpu"] == 33


def test_variante_cpu_e_metadados_ausentes():
    cpu = estimate_vram(META, GB, context_size=4096, slots=2, gpu_layers=20, vram_bytes=8 * GB, variant="cpu")
    assert cpu["layers_on_gpu"] == 0 and cpu["vram_bytes"] == 0
    none = estimate_vram(None, GB, context_size=4096, slots=2, gpu_layers="auto", vram_bytes=8 * GB, variant="vulkan")
    assert none["known"] is False and none["vram_bytes"] is None and none["total_layers"] is None
