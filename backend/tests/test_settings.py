from __future__ import annotations

import json
import logging
import os
from collections.abc import Iterator
from pathlib import Path

import pytest

from henduran import settings as settings_mod
from henduran.db import Database, open_app_database
from henduran.paths import DATA_DIR_ENV, DataPaths, default_data_dir
from henduran.settings import DEFAULTS, SettingsStore, atomic_write_text


@pytest.fixture
def opened() -> Iterator[list[Database]]:
    dbs: list[Database] = []
    yield dbs
    for db in dbs:
        db.close()


@pytest.fixture
def store(tmp_path, opened):
    """Abre o banco em ``tmp_path`` (com o JSON legado em ``tmp_path/settings.json``)."""

    def make(root: Path | None = None) -> SettingsStore:
        base = root or tmp_path
        db, _ = open_app_database(base / "henduran.db")
        opened.append(db)
        return SettingsStore(db, legacy_file=base / "settings.json")

    return make


def rows(s: SettingsStore) -> dict[str, object]:
    return {r["key"]: json.loads(r["value"]) for r in s.db.query_all("SELECT key, value FROM settings")}


# ------------------------------------------------------------ armazenamento
def test_banco_vazio_usa_padroes(store, tmp_path):
    s = store()
    assert s.all() == DEFAULTS
    assert s.get("context_size") == 4096
    assert rows(s) == {}
    assert not (tmp_path / "settings.json").exists()


def test_update_grava_e_relê(store, opened):
    s = store()
    out = s.update(active_model="a/b.gguf", context_size=8192, model_folders=["D:\\Modelos ç"])
    assert out["active_model"] == "a/b.gguf"
    opened.pop().close()
    again = store()
    assert again.get("active_model") == "a/b.gguf"
    assert again.get("context_size") == 8192
    assert again.get("model_folders") == ["D:\\Modelos ç"]
    assert again.get("engine_variant") == "vulkan"
    row = again.db.query_one("SELECT updated_at FROM settings WHERE key = 'context_size'")
    assert row["updated_at"].endswith("Z")


def test_get_devolve_copia_da_lista(store):
    s = store()
    s.update(model_folders=["C:\\a"])
    s.get("model_folders").append("C:\\b")
    assert s.get("model_folders") == ["C:\\a"]


@pytest.mark.parametrize(
    "changes",
    [{"context_size": 10}, {"context_size": True}, {"engine_variant": "cuda"}, {"active_model": ""}, {"desconhecida": 1},
     {"model_folders": "C:\\x"}, {"model_folders": ["ok", ""]}],
)
def test_update_rejeita_invalidos_sem_gravar(store, changes):
    s = store()
    with pytest.raises((ValueError, KeyError)):
        s.update(**changes)
    assert rows(s) == {}
    assert s.all() == DEFAULTS


def test_update_parcialmente_invalido_nao_grava_nada(store):
    s = store()
    with pytest.raises(ValueError):
        s.update(context_size=8192, engine_variant="cuda")
    assert rows(s) == {}


def test_valor_invalido_no_banco_usa_padrao(store, opened, caplog):
    s = store()
    s.db.execute(
        "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?), (?, ?, ?), (?, ?, ?)",
        ("context_size", '"grande"', "x", "engine_variant", '"cpu"', "x", "active_model", "{nao json", "x"),
    )
    opened.pop().close()
    with caplog.at_level(logging.WARNING, logger="henduran.settings"):
        again = store()
    assert again.get("context_size") == 4096
    assert again.get("engine_variant") == "cpu"
    assert again.get("active_model") is None
    assert "context_size" in caplog.text


# ------------------------------------------------------------ JSON legado
def test_importa_settings_json_valido_e_renomeia(store, tmp_path):
    legacy = tmp_path / "settings.json"
    data = {"active_model": "x/y.gguf", "context_size": 8192, "engine_variant": "cpu", "model_folders": ["D:\\LM Studio"]}
    legacy.write_text(json.dumps(data), encoding="utf-8")
    s = store()
    assert s.all() == {**DEFAULTS, **data}
    assert rows(s) == data
    assert not legacy.exists()
    assert json.loads((tmp_path / "settings.json.migrado").read_text(encoding="utf-8")) == data
    assert s.db.query_one("SELECT value FROM app_meta WHERE key = ?", (settings_mod.LEGACY_IMPORTED_KEY,))


def test_importa_so_os_validos(store, tmp_path, caplog):
    legacy = tmp_path / "settings.json"
    legacy.write_text(
        json.dumps({"context_size": "grande", "engine_variant": "cpu", "model_folders": [1], "outro": 1}),
        encoding="utf-8",
    )
    with caplog.at_level(logging.WARNING, logger="henduran.settings"):
        s = store()
    assert rows(s) == {"engine_variant": "cpu"}
    assert s.get("context_size") == 4096
    assert "context_size" in caplog.text and "outro" in caplog.text
    assert (tmp_path / "settings.json.migrado").exists()


@pytest.mark.parametrize("content", ["{nao é json", "[1, 2]", "", '"texto"', '{"context_size": 1}'])
def test_legado_invalido_nao_derruba(store, tmp_path, content):
    (tmp_path / "settings.json").write_text(content, encoding="utf-8")
    s = store()
    assert s.all() == DEFAULTS
    assert rows(s) == {}
    assert (tmp_path / "settings.json.migrado").read_text(encoding="utf-8") == content


def test_legado_bytes_invalidos_nao_derruba(store, tmp_path):
    (tmp_path / "settings.json").write_bytes(b"\xff\xfe\x00lixo")
    assert store().all() == DEFAULTS


def test_legado_ausente(store, tmp_path):
    s = store()
    assert s.all() == DEFAULTS
    assert not (tmp_path / "settings.json.migrado").exists()


def test_importacao_unica(store, opened, tmp_path):
    legacy = tmp_path / "settings.json"
    legacy.write_text(json.dumps({"engine_variant": "cpu"}), encoding="utf-8")
    store()
    opened.pop().close()
    # Um settings.json que reaparece depois não é importado de novo.
    legacy.write_text(json.dumps({"engine_variant": "vulkan", "context_size": 2048}), encoding="utf-8")
    s = store()
    assert s.get("engine_variant") == "cpu"
    assert s.get("context_size") == 4096
    assert legacy.exists()


def test_nao_importa_se_a_tabela_ja_tem_valores(store, opened, tmp_path):
    s = store()
    s.db.execute("DELETE FROM app_meta WHERE key = ?", (settings_mod.LEGACY_IMPORTED_KEY,))
    s.update(context_size=2048)
    opened.pop().close()
    (tmp_path / "settings.json").write_text(json.dumps({"context_size": 8192}), encoding="utf-8")
    assert store().get("context_size") == 2048
    assert (tmp_path / "settings.json").exists()


def test_migrado_existente_nao_e_sobrescrito(store, tmp_path):
    (tmp_path / "settings.json.migrado").write_text("antigo", encoding="utf-8")
    (tmp_path / "settings.json").write_text(json.dumps({"engine_variant": "cpu"}), encoding="utf-8")
    store()
    assert (tmp_path / "settings.json.migrado").read_text(encoding="utf-8") == "antigo"
    assert (tmp_path / "settings.json.migrado-1").exists()


def test_falha_na_gravacao_da_importacao_nao_grava_nada(store, tmp_path, monkeypatch):
    (tmp_path / "settings.json").write_text(json.dumps({"engine_variant": "cpu", "context_size": 8192}), encoding="utf-8")
    real_dumps = json.dumps
    calls = {"n": 0}

    def dumps_falha_na_segunda(value, **kw):
        calls["n"] += 1
        if calls["n"] == 2:  # a primeira preferência já foi gravada na transação
            raise RuntimeError("falha simulada")
        return real_dumps(value, **kw)

    monkeypatch.setattr(settings_mod.json, "dumps", dumps_falha_na_segunda)
    s = store()
    monkeypatch.setattr(settings_mod.json, "dumps", real_dumps)
    assert calls["n"] == 2
    assert s.all() == DEFAULTS
    assert rows(s) == {}
    assert (tmp_path / "settings.json").exists()  # fica para a próxima tentativa


def test_caminho_com_espacos_e_acentos(store, tmp_path):
    root = tmp_path / "Pasta com espaços" / "Ação ñ"
    root.mkdir(parents=True)
    (root / "settings.json").write_text(json.dumps({"engine_variant": "cpu"}), encoding="utf-8")
    s = store(root)
    s.update(active_model="ç/é.gguf")
    assert (root / "henduran.db").is_file()
    assert s.get("engine_variant") == "cpu"
    assert (root / "settings.json.migrado").exists()


# ------------------------------------------------------------ escrita atômica
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
    assert DataPaths.from_env().database_file == tmp_path / "x" / "henduran.db"
    monkeypatch.delenv(DATA_DIR_ENV)
    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path / "local"))
    assert default_data_dir() == tmp_path / "local" / "Henduran"
    p = DataPaths(tmp_path / "d").ensure()
    assert all(d.is_dir() for d in (p.engine_dir, p.models_dir, p.logs_dir))
    assert p.settings_file == tmp_path / "d" / "settings.json"
    assert p.database_file == tmp_path / "d" / "henduran.db"
    assert p.backups_dir == tmp_path / "d" / "backups"
    assert os.path.basename(p.settings_file) == "settings.json"
