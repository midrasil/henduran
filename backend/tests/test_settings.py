from __future__ import annotations

import json
import os

import pytest

from henduran import settings as settings_mod
from henduran.paths import DATA_DIR_ENV, DataPaths, default_data_dir
from henduran.settings import DEFAULTS, SettingsStore, atomic_write_text


def test_arquivo_ausente_usa_padroes(tmp_path):
    s = SettingsStore(tmp_path / "settings.json")
    assert s.all() == DEFAULTS
    assert s.get("context_size") == 4096
    assert not (tmp_path / "settings.json").exists()


@pytest.mark.parametrize("content", ["{nao é json", "[1, 2]", "", '"texto"'])
def test_arquivo_corrompido_usa_padroes(tmp_path, content):
    path = tmp_path / "settings.json"
    path.write_text(content, encoding="utf-8")
    assert SettingsStore(path).all() == DEFAULTS


def test_valores_invalidos_no_arquivo_sao_ignorados(tmp_path):
    path = tmp_path / "settings.json"
    path.write_text(json.dumps({"context_size": "grande", "engine_variant": "cpu", "outro": 1}), encoding="utf-8")
    s = SettingsStore(path)
    assert s.get("context_size") == 4096
    assert s.get("engine_variant") == "cpu"


def test_update_grava_e_relê(tmp_path):
    path = tmp_path / "sub" / "settings.json"
    s = SettingsStore(path)
    s.update(active_model="a/b.gguf", context_size=8192)
    again = SettingsStore(path)
    assert again.get("active_model") == "a/b.gguf"
    assert again.get("context_size") == 8192


@pytest.mark.parametrize(
    "changes",
    [{"context_size": 10}, {"context_size": True}, {"engine_variant": "cuda"}, {"active_model": ""}, {"desconhecida": 1}],
)
def test_update_rejeita_invalidos_sem_gravar(tmp_path, changes):
    path = tmp_path / "settings.json"
    s = SettingsStore(path)
    with pytest.raises((ValueError, KeyError)):
        s.update(**changes)
    assert not path.exists()
    assert s.all() == DEFAULTS


def test_escrita_atomica_preserva_original_em_falha(tmp_path, monkeypatch):
    path = tmp_path / "settings.json"
    path.write_text("original", encoding="utf-8")

    def falha(src, dst):
        raise OSError("disco cheio")

    monkeypatch.setattr(settings_mod.os, "replace", falha)
    with pytest.raises(OSError):
        atomic_write_text(path, "novo")
    assert path.read_text(encoding="utf-8") == "original"
    assert [p.name for p in tmp_path.iterdir()] == ["settings.json"]  # sem temporários sobrando


def test_escrita_atomica_substitui(tmp_path):
    path = tmp_path / "settings.json"
    atomic_write_text(path, "um")
    atomic_write_text(path, "dois")
    assert path.read_text(encoding="utf-8") == "dois"


def test_pasta_de_dados(monkeypatch, tmp_path):
    monkeypatch.setenv(DATA_DIR_ENV, str(tmp_path / "x"))
    assert default_data_dir() == tmp_path / "x"
    monkeypatch.delenv(DATA_DIR_ENV)
    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path / "local"))
    assert default_data_dir() == tmp_path / "local" / "Henduran"
    p = DataPaths(tmp_path / "d").ensure()
    assert all(d.is_dir() for d in (p.engine_dir, p.models_dir, p.logs_dir))
    assert p.settings_file == tmp_path / "d" / "settings.json"
    assert os.path.basename(p.settings_file) == "settings.json"
