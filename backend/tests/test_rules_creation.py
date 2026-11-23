"""Regras de criação de personagem da fatia 1 (rules/02, 03, 06, 07, 09)."""

from __future__ import annotations

import itertools
from collections import Counter

import pytest

from henduran.rules import fatia1 as R
from henduran.rules.creation import (
    Character,
    creation_catalog,
    derive,
    preview_derived,
    validate_character,
)

from .drafts import ATTRIBUTES, SKILLS, valid_draft


def codes(result) -> set[tuple[str, str]]:
    return {(e.field, e.code) for e in result.errors}


# ------------------------------------------------------------------ dados
def test_constantes_da_fatia_1():
    assert R.RULES_VERSION == "fatia-1"
    assert [a.name for a in R.ATTRIBUTES] == ["Força", "Agilidade", "Vigor", "Carisma", "Determinação", "Astúcia"]
    assert {a.id: a.category for a in R.ATTRIBUTES} == {
        "forca": "fisico", "agilidade": "fisico", "vigor": "fisico",
        "carisma": "espiritual", "determinacao": "espiritual", "astucia": "espiritual",
    }
    assert len(R.SKILLS) == 22 and len(set(R.SKILL_IDS)) == 22
    by_attr = Counter(s.attribute for s in R.SKILLS)
    assert by_attr == {"forca": 2, "agilidade": 6, "carisma": 5, "astucia": 9}  # Vigor e Determinação sem Perícias
    names = {s.name for s in R.SKILLS}
    assert not names & {"Dirigir", "Pilotar", "Conhecimento Específico"}
    assert R.SKILLS_BY_ID["conhecimento_geral"].name == "Conhecimento Geral"
    for item in (*R.ATTRIBUTES, *R.SKILLS):
        assert item.id.isascii() and item.id == item.id.lower() and " " not in item.id
        assert item.description
    assert sorted(R.ATTRIBUTE_DISTRIBUTION) == [1, 2, 2, 3, 3, 4]
    assert {p.id: p.counts for p in R.SKILL_PROFILES} == {
        "generalista": {3: 1, 2: 6, 1: 6},
        "equilibrado": {3: 2, 2: 4, 1: 6},
        "especialista": {4: 1, 3: 2, 2: 2, 1: 2},
    }
    assert R.CREATION_MAX == 4 and R.CONVICTION_COUNT == 3
    assert [(d.id, d.base, d.attribute, d.formula) for d in R.DERIVED] == [
        ("vida", 3, "vigor", "3 + Vigor"),
        ("vontade", 3, "determinacao", "3 + Determinação"),
    ]


# ------------------------------------------------------------------ caminho feliz
@pytest.mark.parametrize("profile", ["generalista", "equilibrado", "especialista"])
def test_rascunho_valido_em_cada_perfil(profile):
    result = validate_character(valid_draft(profile))
    assert result.valid, result.error_dicts()
    char = result.character
    assert isinstance(char, Character)
    assert char.skill_profile == profile
    assert len(char.skills) == 22 and list(char.skills) == list(R.SKILL_IDS)
    assert sum(1 for v in char.skills.values() if v == 0) == 22 - R.SKILL_PROFILES_BY_ID[profile].total_skills
    assert char.to_dict()["attributes"] == ATTRIBUTES
    assert [c.pillar for c in char.convictions][0] == "Bram, meu antigo sargento"


def test_pericias_em_zero_explicitas_valem():
    skills = dict(SKILLS["especialista"]) | {"ocultismo": 0, "erudicao": 0}
    assert validate_character(valid_draft("especialista", skills=skills)).valid


# ------------------------------------------------------------------ Atributos
def test_todas_as_distribuicoes_de_atributos():
    valid_count = 0
    target = Counter(R.ATTRIBUTE_DISTRIBUTION)
    for values in itertools.product(range(1, 5), repeat=6):
        attrs = dict(zip(R.ATTRIBUTE_IDS, values, strict=True))
        result = validate_character(valid_draft(attributes=attrs))
        ok = Counter(values) == target
        assert result.valid is ok, (values, result.error_dicts())
        if not ok:
            assert codes(result) == {("attributes", "distribuicao_invalida")}
        valid_count += ok
    assert valid_count == 180  # 6! / (2! * 2!)


@pytest.mark.parametrize(
    "value,code",
    [(5, "acima_do_teto"), (6, "acima_do_teto"), (0, "abaixo_do_minimo"), (-1, "abaixo_do_minimo"),
     (True, "tipo_invalido"), (3.0, "tipo_invalido"), ("3", "tipo_invalido"), (None, "tipo_invalido")],
)
def test_valor_de_atributo_invalido(value, code):
    attrs = dict(ATTRIBUTES) | {"vigor": value}
    result = validate_character(valid_draft(attributes=attrs))
    assert ("attributes.vigor", code) in codes(result)
    assert not any(e.code == "distribuicao_invalida" for e in result.errors)


def test_atributo_ausente_desconhecido_e_tipo():
    attrs = {k: v for k, v in ATTRIBUTES.items() if k != "astucia"} | {"sorte": 1}
    result = validate_character(valid_draft(attributes=attrs))
    assert {("attributes.astucia", "atributo_ausente"), ("attributes.sorte", "atributo_desconhecido")} <= codes(result)
    assert ("attributes", "tipo_invalido") in codes(validate_character(valid_draft(attributes=[4, 3, 3, 2, 2, 1])))
    assert ("attributes", "obrigatorio") in codes(validate_character(valid_draft(attributes=None)))


# ------------------------------------------------------------------ Perícias
@pytest.mark.parametrize("profile", ["generalista", "equilibrado", "especialista"])
def test_perfil_com_pericia_a_mais_ou_a_menos(profile):
    skills = dict(SKILLS[profile])
    unused = next(s for s in R.SKILL_IDS if s not in skills)
    extra = validate_character(valid_draft(profile, skills=skills | {unused: 1}))
    assert codes(extra) == {("skills", "distribuicao_invalida")}
    one = next(k for k, v in skills.items() if v == 1)
    fewer = validate_character(valid_draft(profile, skills={k: v for k, v in skills.items() if k != one}))
    assert codes(fewer) == {("skills", "distribuicao_invalida")}
    # Trocar um valor por outro muda a contagem.
    top = max(skills, key=skills.get)
    changed = validate_character(valid_draft(profile, skills=skills | {top: skills[top] - 1}))
    assert codes(changed) == {("skills", "distribuicao_invalida")}


@pytest.mark.parametrize("profile,other", [("generalista", "especialista"), ("especialista", "equilibrado"), ("equilibrado", "generalista")])
def test_distribuicao_de_outro_perfil_e_recusada(profile, other):
    result = validate_character(valid_draft(profile, skills=SKILLS[other]))
    assert codes(result) == {("skills", "distribuicao_invalida")}


def test_teto_4_desconhecida_e_tipos_nas_pericias():
    skills = dict(SKILLS["especialista"]) | {"lutar": 5}
    result = validate_character(valid_draft("especialista", skills=skills))
    assert codes(result) == {("skills.lutar", "acima_do_teto")}
    result = validate_character(valid_draft("especialista", skills=SKILLS["especialista"] | {"pilotar": 1}))
    assert ("skills.pilotar", "pericia_desconhecida") in codes(result)
    result = validate_character(valid_draft("especialista", skills=SKILLS["especialista"] | {"conhecimento_especifico": 1}))
    assert ("skills.conhecimento_especifico", "pericia_desconhecida") in codes(result)
    result = validate_character(valid_draft("especialista", skills=SKILLS["especialista"] | {"curar": -1}))
    assert ("skills.curar", "abaixo_do_minimo") in codes(result)
    result = validate_character(valid_draft("especialista", skills=SKILLS["especialista"] | {"curar": "1"}))
    assert ("skills.curar", "tipo_invalido") in codes(result)
    assert ("skills", "tipo_invalido") in codes(validate_character(valid_draft(skills=["lutar"])))
    many = {f"x{i}": 1 for i in range(200)}
    result = validate_character(valid_draft(skills=many))
    assert ("skills", "tipo_invalido") in codes(result) and len(result.errors) < 100


def test_perfil_ausente_ou_desconhecido():
    assert ("skill_profile", "obrigatorio") in codes(validate_character(valid_draft(skill_profile=None)))
    assert ("skill_profile", "perfil_desconhecido") in codes(validate_character(valid_draft(skill_profile="mestre")))
    assert ("skill_profile", "tipo_invalido") in codes(validate_character(valid_draft(skill_profile=3)))
    # Sem Perícias informadas, o perfil pede pontos: distribuição inválida.
    assert codes(validate_character(valid_draft(skills={}))) == {("skills", "distribuicao_invalida")}


# ------------------------------------------------------------------ textos
TEXT_FIELDS = [
    ("name", 200), ("concept", 300), ("ambition", 300), ("desire", 300), ("appearance", 4000), ("history", 4000),
]


@pytest.mark.parametrize("field,limit", TEXT_FIELDS)
def test_textos_obrigatorios_e_limites(field, limit):
    for empty in ("", "   ", "\n\t "):
        assert (field, "obrigatorio") in codes(validate_character(valid_draft(**{field: empty})))
    draft = valid_draft()
    del draft[field]
    assert (field, "obrigatorio") in codes(validate_character(draft))
    assert validate_character(valid_draft(**{field: "a" * limit})).valid
    assert (field, "muito_longo") in codes(validate_character(valid_draft(**{field: "a" * (limit + 1)})))
    assert (field, "muito_longo") in codes(validate_character(valid_draft(**{field: "a" * 100_000})))
    assert (field, "tipo_invalido") in codes(validate_character(valid_draft(**{field: 42})))
    assert (field, "caracteres_invalidos") in codes(validate_character(valid_draft(**{field: "a\x00b"})))
    assert (field, "caracteres_invalidos") in codes(validate_character(valid_draft(**{field: "a\x1bb"})))


def test_normalizacao_dos_textos():
    result = validate_character(
        valid_draft(name="  Ilsa  ", history="  linha 1\r\nlinha 2\t \n", concept="Café forte")
    )
    assert result.valid, result.error_dicts()
    char = result.character
    assert char.name == "Ilsa"
    assert char.history == "linha 1\nlinha 2"
    assert char.concept == "Café forte"  # NFC
    # Espaços nas pontas não contam para o limite.
    assert validate_character(valid_draft(name=" " * 50 + "a" * 200 + " " * 50)).valid
    # Nome é de uma linha; Conceito e história aceitam quebra.
    assert ("name", "caracteres_invalidos") in codes(validate_character(valid_draft(name="Ilsa\nCorvo")))
    assert validate_character(valid_draft(concept="Mercenária\nendividada")).valid
    # Textos são dados: nada é interpretado.
    weird = "'); DROP TABLE character; -- {{nome}} <script>"
    assert validate_character(valid_draft(name=weird)).character.name == weird


# ------------------------------------------------------------------ Convicções
@pytest.mark.parametrize("count", [0, 1, 2, 4, 5])
def test_exatamente_tres_conviccoes(count):
    items = [{"text": f"C{i}", "pillar": f"P{i}"} for i in range(count)]
    result = validate_character(valid_draft(convictions=items))
    assert ("convictions", "conviccoes_quantidade") in codes(result)


def test_conviccoes_malformadas():
    good = valid_draft()["convictions"]
    assert ("convictions", "obrigatorio") in codes(validate_character(valid_draft(convictions=None)))
    assert ("convictions", "tipo_invalido") in codes(validate_character(valid_draft(convictions="x")))
    bad = [good[0], "texto solto", {"text": "C", "pillar": "  "}]
    found = codes(validate_character(valid_draft(convictions=bad)))
    assert {("convictions[1]", "tipo_invalido"), ("convictions[2].pillar", "obrigatorio")} <= found
    extra = [good[0], good[1], dict(good[2], peso=3)]
    assert ("convictions[2].peso", "campo_desconhecido") in codes(validate_character(valid_draft(convictions=extra)))
    long = [good[0], good[1], {"text": "a" * 301, "pillar": "b" * 301}]
    found = codes(validate_character(valid_draft(convictions=long)))
    assert {("convictions[2].text", "muito_longo"), ("convictions[2].pillar", "muito_longo")} <= found
    assert validate_character(valid_draft(convictions=[good[0], good[1], {"text": "a" * 300, "pillar": "b" * 300}])).valid
    huge = [{"text": "a", "pillar": "b"}] * 10_000
    assert len(validate_character(valid_draft(convictions=huge)).errors) == 1


# ------------------------------------------------------------------ rascunho
def test_rascunho_nao_objeto_e_campos_desconhecidos():
    for bad in (None, [], "x", 3):
        assert codes(validate_character(bad)) == {("", "rascunho_invalido")}
    for extra in ("competencias", "capacidades", "equipamento", "xp", "conhecimento_especifico"):
        result = validate_character(valid_draft(**{extra: []}))
        assert codes(result) == {(extra, "campo_desconhecido")}


def test_todos_os_erros_de_uma_vez():
    result = validate_character({"name": "", "attributes": {"forca": 9}, "skill_profile": "x"})
    fields = {e.field for e in result.errors}
    assert {"name", "concept", "appearance", "history", "ambition", "desire", "convictions",
            "attributes.forca", "attributes.vigor", "skill_profile"} <= fields
    for e in result.errors:
        assert e.code and e.message and e.code.isascii()


# ------------------------------------------------------------------ derivadas
@pytest.mark.parametrize("vigor", [1, 2, 3, 4, 5])
@pytest.mark.parametrize("determinacao", [1, 2, 3, 4, 5])
def test_derivadas(vigor, determinacao):
    attrs = dict(ATTRIBUTES) | {"vigor": vigor, "determinacao": determinacao}
    assert derive({"attributes": attrs}) == {"vida": 3 + vigor, "vontade": 3 + determinacao}


def test_derivadas_do_personagem_e_previa():
    char = validate_character(valid_draft()).character
    assert derive(char) == {"vida": 6, "vontade": 6}
    with pytest.raises(ValueError):
        derive({"attributes": {"vigor": 0, "determinacao": 2}})
    with pytest.raises(ValueError):
        derive({})
    assert preview_derived({"attributes": {"vigor": 4}}) == {"vida": 7, "vontade": None}
    assert preview_derived({"attributes": {"vigor": True, "determinacao": 9}}) == {"vida": None, "vontade": None}
    assert preview_derived(None) == {"vida": None, "vontade": None}


def test_catalogo_coerente_com_as_constantes():
    cat = creation_catalog()
    assert cat["rules_version"] == R.RULES_VERSION
    assert [a["id"] for a in cat["attributes"]] == list(R.ATTRIBUTE_IDS)
    assert [s["id"] for s in cat["skills"]] == list(R.SKILL_IDS)
    assert sum(len(a["skills"]) for a in cat["attributes"]) == 22
    assert cat["attribute_distribution"] == list(R.ATTRIBUTE_DISTRIBUTION)
    assert {p["id"]: {d["value"]: d["count"] for d in p["distribution"]} for p in cat["skill_profiles"]} == {
        p.id: p.counts for p in R.SKILL_PROFILES
    }
    assert cat["creation_max"] == 4 and cat["convictions"] == {"count": 3}
    assert cat["text_limits"] == dict(R.TEXT_LIMITS)
    assert [d["formula"] for d in cat["derived"]] == ["3 + Vigor", "3 + Determinação"]
