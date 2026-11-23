"""Identificadores de Jornada e Mundo: UUID estrito e caminhos sempre dentro da pasta de dados."""

from __future__ import annotations

import uuid

import pytest

from henduran.paths import DataPaths, InvalidIdError, new_id, validate_id

GOOD = "3f2b8c1e-9a4d-4e6f-8b7a-0c1d2e3f4a5b"


def test_uuid_valido_e_normalizado():
    assert validate_id(GOOD) == GOOD
    assert validate_id(GOOD.upper()) == GOOD  # maiúsculas viram minúsculas
    fresh = new_id()
    assert validate_id(fresh) == fresh and uuid.UUID(fresh).version == 4


@pytest.mark.parametrize(
    "bad",
    [
        "",
        "..",
        ".",
        "../" + GOOD,
        GOOD + "/..",
        "..\\" + GOOD,
        "a/b",
        "a\\b",
        "C:\\Windows",
        "CON",
        "NUL",
        "aux",
        "COM1",
        "lpt1.txt",
        GOOD.replace("-", ""),  # 32 caracteres, sem hífens
        "{" + GOOD + "}",
        "urn:uuid:" + GOOD,
        GOOD[:-1],
        GOOD + "0",
        " " + GOOD,
        GOOD + " ",
        GOOD + "\n",
        GOOD.replace("3", "g", 1),
        GOOD[:8] + "_" + GOOD[9:],
        GOOD + "\x00",
        "３f2b8c1e-9a4d-4e6f-8b7a-0c1d2e3f4a5b",  # dígito de largura total
        None,
        123,
        uuid.UUID(GOOD),
    ],
)
def test_ids_invalidos_sao_recusados(bad, tmp_path):
    with pytest.raises(InvalidIdError):
        validate_id(bad)
    paths = DataPaths(tmp_path)
    for fn in (paths.journey_dir, paths.journey_db_file, paths.journey_lock_file, paths.world_dir, paths.world_db_file):
        with pytest.raises(InvalidIdError):
            fn(bad)


def test_caminhos_da_jornada_e_do_mundo(tmp_path):
    paths = DataPaths(tmp_path)
    assert paths.journeys_dir == tmp_path / "journeys"
    assert paths.journey_dir(GOOD.upper()) == tmp_path / "journeys" / GOOD
    assert paths.journey_db_file(GOOD) == tmp_path / "journeys" / GOOD / "journey.db"
    assert paths.journey_backups_dir(GOOD) == tmp_path / "journeys" / GOOD / "backups"
    assert paths.journey_assets_dir(GOOD) == tmp_path / "journeys" / GOOD / "assets"
    assert paths.journey_lock_file(GOOD) == tmp_path / "journeys" / GOOD / "journey.lock"
    assert paths.worlds_dir == tmp_path / "worlds"
    assert paths.world_dir(GOOD) == tmp_path / "worlds" / GOOD
    assert paths.world_db_file(GOOD) == tmp_path / "worlds" / GOOD / "world.db"
    assert paths.world_backups_dir(GOOD) == tmp_path / "worlds" / GOOD / "backups"


def test_caminho_resolvido_fora_da_pasta_de_dados_e_recusado(tmp_path):
    paths = DataPaths(tmp_path / "dados")
    with pytest.raises(InvalidIdError):
        paths._inside(tmp_path / "dados" / ".." / "fora")
    assert paths._inside(tmp_path / "dados" / "journeys") == tmp_path / "dados" / "journeys"
