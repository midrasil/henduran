"""Gerador de mundo por código e validação do esquema v1."""

from __future__ import annotations

import copy
import json
import time
import unicodedata

import pytest

from henduran.worldgen import CONTENT_MAX_BYTES, SEED_MAX, generate_world, validate_world_content
from henduran.worldgen import data as D
from henduran.worldgen.generator import make_name


def codes(result) -> set[tuple[str, str]]:
    return {(e.field, e.code) for e in result.errors}


def all_texts(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for v in value.values():
            yield from all_texts(v)
    elif isinstance(value, list):
        for v in value:
            yield from all_texts(v)


# ------------------------------------------------------------------ tabelas
def test_tabelas_tem_o_tamanho_minimo_e_sao_unicas():
    assert len(D.ERAS) >= 8 and len(D.TONES) >= 8
    assert len(D.MONTH_NAMES) >= 16 and len(D.WEEKDAY_NAMES) >= 10
    assert len(D.DOMAINS) >= 12 and len(D.PLACE_TYPES) >= 10
    for table in (D.MONTH_NAMES, D.WEEKDAY_NAMES, [e[0] for e in D.ERAS], [t[0] for t in D.TONES],
                  [d[0] for d in D.DOMAINS], [p[0] for p in D.PLACE_TYPES]):
        assert len({x.casefold() for x in table}) == len(table)
    for kind in ("vila", "cidade", "porto", "fortaleza", "mosteiro", "floresta", "ruína", "vale"):
        assert kind in {p[0] for p in D.PLACE_TYPES}
    for _, openings in D.PLACE_TYPES:
        assert all("{nome}" in o for o in openings)


# ------------------------------------------------------------------ determinismo
def test_mesma_semente_mesmo_mundo():
    for seed in (0, 1, 476, 2**31, SEED_MAX):
        a, b = generate_world(seed), generate_world(seed)
        assert a == b and a["seed"] == seed
    assert generate_world(1)["content"] != generate_world(2)["content"]


def test_sem_semente_sorteia_e_devolve_a_semente():
    world = generate_world()
    assert 0 <= world["seed"] <= SEED_MAX
    assert generate_world(world["seed"]) == world


@pytest.mark.parametrize("seed", [-1, SEED_MAX + 1, 1.5, "3", True])
def test_semente_invalida(seed):
    with pytest.raises(ValueError):
        generate_world(seed)


# ------------------------------------------------------------------ mil sementes
def test_mil_sementes_validas_unicas_e_bem_escritas():
    start = time.perf_counter()
    seen_names = set()
    for seed in range(1000):
        content = generate_world(seed)["content"]
        result = validate_world_content(content)
        assert result.valid, (seed, result.error_dicts())
        assert result.content == content  # o gerador já entrega normalizado
        cal = content["calendar"]
        assert 8 <= len(cal["months"]) <= 14 and 5 <= len(cal["weekdays"]) <= 8
        assert all(20 <= m["days"] <= 40 for m in cal["months"])
        assert len({m["name"] for m in cal["months"]}) == len(cal["months"])
        assert len(set(cal["weekdays"])) == len(cal["weekdays"])
        assert cal["era_label"].startswith(f"Ano {cal['year']} ")
        assert 1 <= len(content["religions"]) <= 3
        assert len({r["domain"] for r in content["religions"]}) == len(content["religions"])
        places = content["places"]
        assert 3 <= len(places) <= 5
        assert len({p["id"] for p in places}) == len(places)
        assert len({p["name"].casefold() for p in places}) == len(places)
        for text in all_texts(content):
            assert text == text.strip() and text
            assert unicodedata.is_normalized("NFC", text)
            assert not any(unicodedata.category(ch) == "Cc" for ch in text), (seed, text)
            assert "{" not in text and "}" not in text  # nenhum marcador sobrando
        for place in places:
            assert place["description"].startswith(place["name"])
            assert place["name"][0].isupper() and place["name"][1:].islower()
            assert place["name"].casefold() not in D.BLOCKED_NAMES
        seen_names.add(content["name"])
    assert len(seen_names) > 900  # variedade
    assert time.perf_counter() - start < 20


def test_nomes_tem_no_maximo_um_acento():
    import random

    rng = random.Random(7)
    used: set[str] = set()
    for _ in range(2000):
        name = make_name(rng, used)
        accents = sum(1 for ch in unicodedata.normalize("NFD", name) if unicodedata.category(ch) == "Mn")
        assert accents <= 1, name
    assert len(used) == 2000


# ------------------------------------------------------------------ validação
@pytest.fixture
def content():
    return generate_world(476)["content"]


def test_validacao_normaliza_textos(content):
    content["name"] = "  Terras  "
    content["places"][0]["description"] = "  Linha 1\r\nLinha 2  "
    result = validate_world_content(content)
    assert result.valid
    assert result.content["name"] == "Terras"
    assert result.content["places"][0]["description"] == "Linha 1\nLinha 2"


@pytest.mark.parametrize("bad", [None, [], "mundo", 3])
def test_conteudo_que_nao_e_objeto(bad):
    assert not validate_world_content(bad).valid


def test_esquema_e_campos_desconhecidos(content):
    for schema in (2, "1", True, None):
        broken = copy.deepcopy(content) | {"schema": schema}
        assert codes(validate_world_content(broken)) == {("schema", "esquema_desconhecido")}
    broken = copy.deepcopy(content) | {"magia": "alta"}
    assert ("magia", "campo_desconhecido") in codes(validate_world_content(broken))
    broken = copy.deepcopy(content)
    broken["places"][1]["regra"] = "+2"
    assert ("places[1].regra", "campo_desconhecido") in codes(validate_world_content(broken))
    assert not validate_world_content({"schema": 1, "x": float("nan")}).valid  # não serializável


@pytest.mark.parametrize(
    "mutate,expected",
    [
        (lambda c: c.update(name=""), ("name", "obrigatorio")),
        (lambda c: c.update(name="a" * 101), ("name", "muito_longo")),
        (lambda c: c.update(name="a\x07"), ("name", "caracteres_invalidos")),
        (lambda c: c.update(era="x"), ("era", "tipo_invalido")),
        (lambda c: c["tone"].update(description="d" * 1001), ("tone.description", "muito_longo")),
        (lambda c: c.pop("calendar"), ("calendar", "obrigatorio")),
        (lambda c: c["calendar"].update(year=0), ("calendar.year", "fora_do_intervalo")),
        (lambda c: c["calendar"].update(year="476"), ("calendar.year", "tipo_invalido")),
        (lambda c: c["calendar"].update(months=c["calendar"]["months"][:7]), ("calendar.months", "quantidade_invalida")),
        (lambda c: c["calendar"].update(months=[{"name": f"M{i}", "days": 30} for i in range(15)]),
         ("calendar.months", "quantidade_invalida")),
        (lambda c: c["calendar"]["months"][0].update(days=19), ("calendar.months[0].days", "fora_do_intervalo")),
        (lambda c: c["calendar"]["months"][0].update(days=41), ("calendar.months[0].days", "fora_do_intervalo")),
        (lambda c: c["calendar"]["months"][0].update(days=True), ("calendar.months[0].days", "tipo_invalido")),
        (lambda c: c["calendar"]["months"][1].update(name=c["calendar"]["months"][0]["name"].upper()),
         ("calendar.months[1]", "duplicado")),
        (lambda c: c["calendar"].update(weekdays=["A", "B", "C", "D"]), ("calendar.weekdays", "quantidade_invalida")),
        (lambda c: c["calendar"].update(weekdays=["A", "B", "C", "D", "a"]), ("calendar.weekdays[4]", "duplicado")),
        (lambda c: c.update(religions=[]), ("religions", "quantidade_invalida")),
        (lambda c: c.update(religions=c["religions"] * 4), ("religions", "quantidade_invalida")),
        (lambda c: c["religions"][0].update(domain=""), ("religions[0].domain", "obrigatorio")),
        (lambda c: c.update(places=c["places"][:2]), ("places", "quantidade_invalida")),
        (lambda c: c.update(places=(c["places"] * 3)[:6]), ("places", "quantidade_invalida")),
        (lambda c: c["places"][1].update(id=c["places"][0]["id"]), ("places[1]", "duplicado")),
        (lambda c: c["places"][1].update(name=c["places"][0]["name"]), ("places[1]", "duplicado")),
        (lambda c: c["places"][0].update(id="Lugar 1"), ("places[0].id", "id_invalido")),
        (lambda c: c["places"][0].update(id="../x"), ("places[0].id", "id_invalido")),
        (lambda c: c["places"][0].update(type="t" * 41), ("places[0].type", "muito_longo")),
    ],
)
def test_conteudos_malformados(content, mutate, expected):
    mutate(content)
    result = validate_world_content(content)
    assert not result.valid and result.content is None
    assert expected in codes(result), result.error_dicts()


def test_conteudo_acima_de_256_kb(content):
    content["places"][0]["description"] = "a" * (CONTENT_MAX_BYTES + 10)
    assert codes(validate_world_content(content)) == {("", "muito_grande")}
    # Em UTF-8: acentos contam 2 bytes.
    content["places"][0]["description"] = "ã" * (CONTENT_MAX_BYTES // 2 + 10)
    assert codes(validate_world_content(content)) == {("", "muito_grande")}


def test_conteudo_profundo_demais_nao_derruba():
    nested: list = []
    for _ in range(100_000):
        nested = [nested]
    result = validate_world_content({"schema": 1, "name": nested})
    assert not result.valid


def test_edicao_do_jogador_dentro_dos_limites(content):
    content["name"] = "Minha Terra Ação"
    content["calendar"]["months"] = [{"name": f"Mês {i}", "days": 20 + i} for i in range(14)]
    content["calendar"]["weekdays"] = ["Um", "Dois", "Três", "Quatro", "Cinco"]
    content["places"][0]["type"] = "acampamento élfico"
    content["religions"] = content["religions"][:1]
    assert validate_world_content(content).valid
    assert len(json.dumps(content, ensure_ascii=False).encode()) < CONTENT_MAX_BYTES
