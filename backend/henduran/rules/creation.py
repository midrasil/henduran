"""Validação da criação de personagem da fatia 1 (``rules/09-criacao-de-personagem.md``).

Rascunho (JSON vindo da interface)::

    {
      "name": "...", "concept": "...", "appearance": "...", "history": "...",
      "ambition": "...", "desire": "...",
      "convictions": [{"text": "...", "pillar": "..."}, ... 3 itens],
      "attributes": {"forca": 4, "agilidade": 3, ...},       # os 6
      "skill_profile": "generalista" | "equilibrado" | "especialista",
      "skills": {"lutar": 3, "atletismo": 2, ...},         # Perícias sem pontos valem 0
      "age"?: "...", "height"?: "...", "origin"?: "...", "personality"?: "..."  # opcionais
    }

Os campos ``age``, ``height``, ``origin`` e ``personality`` são **opcionais**, texto
livre e sem efeito de regra: ausentes, nulos ou vazios valem "não informado". A
``appearance`` também é opcional (12-nova-jornada.md, seção 4; migração ``journey/0006``):
ausente, nula ou vazia, é gravada como texto vazio.

História formatada (ADR-077, item 2): o rascunho pode trazer ``history_html`` (HTML do
editor). O serviço o sanea (:mod:`henduran.richtext`), deriva o **texto puro** e o usa
como ``history``: o limite de ``TEXT_LIMITS["history"]`` conta o texto puro, e os erros
saem no campo ``history``. Com ``history_html``, o ``history`` enviado é ignorado; sem
ele, ``history`` continua aceito como texto simples (clientes antigos).

:func:`validate_character` devolve **todos** os erros, cada um com ``field``
(caminho, por exemplo ``convictions[1].pillar``), ``code`` estável e mensagem em
português. Os textos são dados: nunca são interpretados; são normalizados (NFC,
espaços das pontas removidos, ``\\r\\n`` vira ``\\n``) e limitados em tamanho.

Códigos: ``rascunho_invalido``, ``campo_desconhecido``, ``obrigatorio``,
``tipo_invalido``, ``muito_longo``, ``caracteres_invalidos``,
``conviccoes_quantidade``, ``atributo_desconhecido``, ``atributo_ausente``,
``abaixo_do_minimo``, ``acima_do_teto``, ``distribuicao_invalida``,
``perfil_desconhecido``, ``pericia_desconhecida``.
"""

from __future__ import annotations

import unicodedata
from collections import Counter
from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any

from henduran.rules import fatia1 as R

DRAFT_FIELDS = (
    "name",
    "concept",
    "appearance",
    "history",
    "ambition",
    "desire",
    "convictions",
    "attributes",
    "skill_profile",
    "skills",
    "age",
    "height",
    "origin",
    "personality",
    "history_html",
)
# Teto do HTML saneado da História e da entrada bruta (defesa do serviço; o limite que vale para
# o jogador é o do texto puro, ``TEXT_LIMITS["history"]``).
HISTORY_HTML_MAX = 40000
HISTORY_HTML_INPUT_MAX = 200000
# Campos opcionais da descrição (sem efeito de regra): (campo, rótulo, uma linha).
OPTIONAL_TEXT_FIELDS = (
    ("age", "A idade", True),
    ("height", "A altura", True),
    ("origin", "A origem", True),
    ("personality", "A personalidade", False),
)
OPTIONAL_FIELDS = tuple(name for name, _, _ in OPTIONAL_TEXT_FIELDS)
# Campos de texto simples do rascunho: (campo, chave do limite, rótulo).
_TEXT_FIELDS = (
    ("name", "name", "O nome"),
    ("concept", "concept", "O Conceito"),
    ("history", "history", "A história"),
    ("ambition", "ambition", "A Ambição"),
    ("desire", "desire", "O Desejo"),
)
# Campos em que quebras de linha não fazem sentido.
_SINGLE_LINE = frozenset({"name"})
# Teto de itens percorridos em listas e mapas, para limitar o trabalho com entradas abusivas.
_MAX_ITEMS = 64


@dataclass(frozen=True)
class FieldError:
    field: str
    code: str
    message: str

    def to_dict(self) -> dict[str, str]:
        return {"field": self.field, "code": self.code, "message": self.message}


@dataclass(frozen=True)
class Conviction:
    text: str
    pillar: str

    def to_dict(self) -> dict[str, str]:
        return {"text": self.text, "pillar": self.pillar}


@dataclass(frozen=True)
class Character:
    """Personagem validado e normalizado (``skills`` traz as 22 Perícias, inclusive as em 0)."""

    name: str
    concept: str
    appearance: str
    history: str
    ambition: str
    desire: str
    convictions: tuple[Conviction, ...]
    attributes: Mapping[str, int]
    skill_profile: str
    skills: Mapping[str, int]
    age: str | None = None
    height: str | None = None
    origin: str | None = None
    personality: str | None = None
    history_html: str | None = None  # HTML saneado; None quando a História veio em texto simples

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "concept": self.concept,
            "appearance": self.appearance,
            "history": self.history,
            "ambition": self.ambition,
            "desire": self.desire,
            "convictions": [c.to_dict() for c in self.convictions],
            "attributes": {a: self.attributes[a] for a in R.ATTRIBUTE_IDS},
            "skill_profile": self.skill_profile,
            "skills": {s: self.skills[s] for s in R.SKILL_IDS},
            "age": self.age,
            "height": self.height,
            "origin": self.origin,
            "personality": self.personality,
            "history_html": self.history_html,
        }


@dataclass
class ValidationResult:
    errors: list[FieldError] = field(default_factory=list)
    character: Character | None = None

    @property
    def valid(self) -> bool:
        return not self.errors

    def error_dicts(self) -> list[dict[str, str]]:
        return [e.to_dict() for e in self.errors]


# ------------------------------------------------------------------ textos
def clean_text(value: str) -> str:
    """NFC, ``\\r\\n``/``\\r`` viram ``\\n`` e espaços das pontas removidos."""
    return unicodedata.normalize("NFC", value.replace("\r\n", "\n").replace("\r", "\n")).strip()


def has_bad_chars(text: str, *, single_line: bool) -> bool:
    """Caracteres de controle (categoria ``Cc``) não são aceitos, salvo ``\\n`` e ``\\t`` em texto de várias linhas."""
    for ch in text:
        if unicodedata.category(ch) == "Cc":
            if single_line or ch not in "\n\t":
                return True
    return False


def check_text(
    errors: list[FieldError], path: str, value: Any, limit: int, label: str, *, single_line: bool = False
) -> str | None:
    """Valida um texto obrigatório; devolve o texto normalizado ou ``None`` (com o erro em ``errors``)."""
    if value is None:
        errors.append(FieldError(path, "obrigatorio", f"{label} é obrigatório(a)."))
        return None
    if not isinstance(value, str):
        errors.append(FieldError(path, "tipo_invalido", f"{label} deve ser um texto."))
        return None
    if len(value) > limit * 4 + 64:  # muito acima do limite: nem normaliza
        errors.append(FieldError(path, "muito_longo", f"{label} deve ter até {limit} caracteres."))
        return None
    text = clean_text(value)
    if not text:
        errors.append(FieldError(path, "obrigatorio", f"{label} é obrigatório(a)."))
        return None
    if len(text) > limit:
        errors.append(FieldError(path, "muito_longo", f"{label} deve ter até {limit} caracteres (tem {len(text)})."))
        return None
    if has_bad_chars(text, single_line=single_line):
        errors.append(FieldError(path, "caracteres_invalidos", f"{label} contém caracteres de controle não permitidos."))
        return None
    return text


def check_optional_text(
    errors: list[FieldError], path: str, value: Any, limit: int, label: str, *, single_line: bool = False
) -> str | None:
    """Texto opcional: ``None`` ou vazio (depois de normalizar) é ausente; o resto segue :func:`check_text`."""
    if value is None:
        return None
    if isinstance(value, str) and len(value) <= limit * 4 + 64 and not clean_text(value):
        return None
    return check_text(errors, path, value, limit, label, single_line=single_line)


def check_history_html(errors: list[FieldError], value: Any) -> tuple[str | None, str | None]:
    """Sanea o HTML da História e confere o texto puro. Devolve ``(texto puro, HTML)`` ou ``(None, None)``."""
    from henduran.richtext import sanitize  # importação tardia: só quem valida a História precisa

    limit = R.TEXT_LIMITS["history"]
    if not isinstance(value, str):
        errors.append(FieldError("history", "tipo_invalido", "A história deve ser um texto."))
        return None, None
    if len(value) > HISTORY_HTML_INPUT_MAX:
        errors.append(FieldError("history", "muito_longo", f"A história deve ter até {limit} caracteres."))
        return None, None
    rich = sanitize(value)
    plain = rich.plain
    if not plain.strip():
        errors.append(FieldError("history", "obrigatorio", "A história é obrigatório(a)."))
        return None, None
    if len(plain) > limit:
        errors.append(FieldError("history", "muito_longo", f"A história deve ter até {limit} caracteres (tem {len(plain)})."))
        return None, None
    if len(rich.html) > HISTORY_HTML_MAX:
        errors.append(
            FieldError("history", "formatacao_demais", "A história tem formatação demais. Simplifique a formatação.")
        )
        return None, None
    return plain, rich.html


def _is_int(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def _describe(counts: Mapping[int, int]) -> str:
    parts = [f"{n} em {v}" for v, n in sorted(counts.items(), reverse=True) if n]
    return ", ".join(parts) if parts else "nenhum valor"


# ------------------------------------------------------------------ validação
def _validate_convictions(errors: list[FieldError], value: Any) -> tuple[Conviction, ...] | None:
    if value is None:
        errors.append(FieldError("convictions", "obrigatorio", f"Informe {R.CONVICTION_COUNT} Convicções."))
        return None
    if not isinstance(value, list):
        errors.append(FieldError("convictions", "tipo_invalido", "As Convicções devem ser uma lista."))
        return None
    ok = True
    if len(value) != R.CONVICTION_COUNT:
        errors.append(
            FieldError(
                "convictions",
                "conviccoes_quantidade",
                f"O personagem tem exatamente {R.CONVICTION_COUNT} Convicções (recebidas {len(value)}).",
            )
        )
        ok = False
    out: list[Conviction] = []
    for i, item in enumerate(value[:_MAX_ITEMS]):
        base = f"convictions[{i}]"
        if not isinstance(item, dict):
            errors.append(FieldError(base, "tipo_invalido", "Cada Convicção deve ter texto e Pilar."))
            ok = False
            continue
        for key in item:
            if key not in ("text", "pillar"):
                errors.append(FieldError(f"{base}.{str(key)[:40]}", "campo_desconhecido", "Campo desconhecido na Convicção."))
                ok = False
        text = check_text(errors, f"{base}.text", item.get("text"), R.TEXT_LIMITS["conviction_text"], "A Convicção")
        pillar = check_text(errors, f"{base}.pillar", item.get("pillar"), R.TEXT_LIMITS["conviction_pillar"], "O Pilar")
        if text is None or pillar is None:
            ok = False
        else:
            out.append(Conviction(text, pillar))
    return tuple(out) if ok else None


def _validate_attributes(errors: list[FieldError], value: Any) -> dict[str, int] | None:
    if value is None:
        errors.append(FieldError("attributes", "obrigatorio", "Distribua os valores dos seis Atributos."))
        return None
    if not isinstance(value, dict):
        errors.append(FieldError("attributes", "tipo_invalido", "Os Atributos devem ser um mapa de id para valor."))
        return None
    ok = True
    for key in list(value)[:_MAX_ITEMS]:
        if key not in R.ATTRIBUTES_BY_ID:
            errors.append(FieldError(f"attributes.{str(key)[:40]}", "atributo_desconhecido", "Atributo desconhecido."))
            ok = False
    out: dict[str, int] = {}
    for attr in R.ATTRIBUTES:
        path = f"attributes.{attr.id}"
        if attr.id not in value:
            errors.append(FieldError(path, "atributo_ausente", f"Falta o valor de {attr.name}."))
            ok = False
            continue
        v = value[attr.id]
        if not _is_int(v):
            errors.append(FieldError(path, "tipo_invalido", f"{attr.name} deve ser um número inteiro."))
            ok = False
        elif v < R.ATTRIBUTE_MIN:
            errors.append(FieldError(path, "abaixo_do_minimo", f"{attr.name} deve ser pelo menos {R.ATTRIBUTE_MIN}."))
            ok = False
        elif v > R.CREATION_MAX:
            errors.append(
                FieldError(path, "acima_do_teto", f"Na criação, {attr.name} não pode passar de {R.CREATION_MAX}.")
            )
            ok = False
        else:
            out[attr.id] = v
    if not ok:
        return None
    if Counter(out.values()) != Counter(R.ATTRIBUTE_DISTRIBUTION):
        expected = _describe(Counter(R.ATTRIBUTE_DISTRIBUTION))
        errors.append(
            FieldError(
                "attributes",
                "distribuicao_invalida",
                f"Os Atributos devem ter {expected}; recebido: {_describe(Counter(out.values()))}.",
            )
        )
        return None
    return out


def _validate_skills(errors: list[FieldError], profile_value: Any, value: Any) -> tuple[str | None, dict[str, int] | None]:
    profile: R.SkillProfile | None = None
    if profile_value is None:
        errors.append(FieldError("skill_profile", "obrigatorio", "Escolha um perfil de Perícias."))
    elif not isinstance(profile_value, str):
        errors.append(FieldError("skill_profile", "tipo_invalido", "O perfil de Perícias deve ser um texto."))
    elif profile_value not in R.SKILL_PROFILES_BY_ID:
        names = ", ".join(p.name for p in R.SKILL_PROFILES)
        errors.append(FieldError("skill_profile", "perfil_desconhecido", f"Perfil de Perícias desconhecido. Use: {names}."))
    else:
        profile = R.SKILL_PROFILES_BY_ID[profile_value]

    if value is None:
        value = {}
    if not isinstance(value, dict):
        errors.append(FieldError("skills", "tipo_invalido", "As Perícias devem ser um mapa de id para valor."))
        return (profile.id if profile else None), None
    ok = True
    for key in list(value)[:_MAX_ITEMS]:
        if key not in R.SKILLS_BY_ID:
            errors.append(FieldError(f"skills.{str(key)[:40]}", "pericia_desconhecida", "Perícia desconhecida."))
            ok = False
    if len(value) > _MAX_ITEMS:
        errors.append(FieldError("skills", "tipo_invalido", "Perícias demais no rascunho."))
        ok = False
    out: dict[str, int] = {}
    for skill in R.SKILLS:
        path = f"skills.{skill.id}"
        v = value.get(skill.id, 0)
        if not _is_int(v):
            errors.append(FieldError(path, "tipo_invalido", f"{skill.name} deve ser um número inteiro."))
            ok = False
        elif v < R.SKILL_MIN:
            errors.append(FieldError(path, "abaixo_do_minimo", f"{skill.name} não pode ser menor que {R.SKILL_MIN}."))
            ok = False
        elif v > R.CREATION_MAX:
            errors.append(FieldError(path, "acima_do_teto", f"Na criação, {skill.name} não pode passar de {R.CREATION_MAX}."))
            ok = False
        else:
            out[skill.id] = v
    if not ok or profile is None:
        return (profile.id if profile else None), None
    got = Counter(v for v in out.values() if v > 0)
    if got != Counter(profile.counts):
        errors.append(
            FieldError(
                "skills",
                "distribuicao_invalida",
                f"O perfil {profile.name} pede {_describe(profile.counts)}; recebido: {_describe(got)}.",
            )
        )
        return profile.id, None
    return profile.id, out


def validate_attributes(value: Any) -> tuple[dict[str, int] | None, list[FieldError]]:
    """Confere só os Atributos (valores e distribuição da criação). Usado pelo Narrador que preenche dados."""
    errors: list[FieldError] = []
    return _validate_attributes(errors, value), errors


def validate_skills(profile: Any, value: Any) -> tuple[str | None, dict[str, int] | None, list[FieldError]]:
    """Confere só o perfil e as Perícias (valores e distribuição do perfil). Usado pelo Narrador que preenche dados."""
    errors: list[FieldError] = []
    checked_profile, skills = _validate_skills(errors, profile, value)
    return checked_profile, skills, errors


def validate_character(draft: Any) -> ValidationResult:
    """Valida o rascunho inteiro e devolve todos os erros (ou o :class:`Character` normalizado)."""
    result = ValidationResult()
    errors = result.errors
    if not isinstance(draft, dict):
        errors.append(FieldError("", "rascunho_invalido", "O rascunho do personagem deve ser um objeto."))
        return result
    for key in list(draft)[:_MAX_ITEMS]:
        if key not in DRAFT_FIELDS:
            errors.append(FieldError(str(key)[:40], "campo_desconhecido", "Campo desconhecido no rascunho."))
    texts: dict[str, str | None] = {}
    rich_history = draft.get("history_html") is not None
    for name, limit_key, label in _TEXT_FIELDS:
        if name == "history" and rich_history:
            continue
        texts[name] = check_text(
            errors, name, draft.get(name), R.TEXT_LIMITS[limit_key], label, single_line=name in _SINGLE_LINE
        )
    texts["appearance"] = check_optional_text(
        errors, "appearance", draft.get("appearance"), R.TEXT_LIMITS["appearance"], "A aparência"
    )
    history_html: str | None = None
    if rich_history:
        texts["history"], history_html = check_history_html(errors, draft.get("history_html"))
    optional: dict[str, str | None] = {}
    for name, label, single_line in OPTIONAL_TEXT_FIELDS:
        optional[name] = check_optional_text(
            errors, name, draft.get(name), R.TEXT_LIMITS[name], label, single_line=single_line
        )
    convictions = _validate_convictions(errors, draft.get("convictions"))
    attributes = _validate_attributes(errors, draft.get("attributes"))
    profile, skills = _validate_skills(errors, draft.get("skill_profile"), draft.get("skills"))
    if errors:
        return result
    assert convictions is not None and attributes is not None and skills is not None and profile is not None
    result.character = Character(
        name=texts["name"] or "",
        concept=texts["concept"] or "",
        appearance=texts["appearance"] or "",
        history=texts["history"] or "",
        ambition=texts["ambition"] or "",
        desire=texts["desire"] or "",
        convictions=convictions,
        attributes=attributes,
        skill_profile=profile,
        skills=skills,
        history_html=history_html,
        **optional,
    )
    return result


# ------------------------------------------------------------------ derivadas
def derive(character: Character | Mapping[str, Any]) -> dict[str, int]:
    """Tamanho das trilhas: ``{"vida": 3 + Vigor, "vontade": 3 + Determinação}``.

    Aceita um :class:`Character` ou um mapa com ``attributes``. Levanta
    ``ValueError`` se o Atributo necessário faltar ou estiver fora de 1 a 5.
    """
    attributes = character.attributes if isinstance(character, Character) else character.get("attributes")
    if not isinstance(attributes, Mapping):
        raise ValueError("atributos ausentes")
    out: dict[str, int] = {}
    for d in R.DERIVED:
        v = attributes.get(d.attribute)
        if not _is_int(v) or not R.ATTRIBUTE_MIN <= v <= R.ATTRIBUTE_MAX:
            raise ValueError(f"{d.attribute} inválido")
        out[d.id] = d.base + v
    return out


def preview_derived(draft: Any) -> dict[str, int | None]:
    """Derivadas de um rascunho ainda incompleto: cada uma é ``None`` se o seu Atributo não for válido."""
    attributes = draft.get("attributes") if isinstance(draft, dict) else None
    out: dict[str, int | None] = {}
    for d in R.DERIVED:
        v = attributes.get(d.attribute) if isinstance(attributes, dict) else None
        out[d.id] = d.base + v if _is_int(v) and R.ATTRIBUTE_MIN <= v <= R.CREATION_MAX else None
    return out


# ------------------------------------------------------------------ catálogo para a interface
def creation_catalog() -> dict[str, Any]:
    """Dados de criação para a interface (fonte única da verdade; a interface não duplica regras)."""
    return {
        "rules_version": R.RULES_VERSION,
        "categories": [{"id": c.id, "name": c.name} for c in R.CATEGORIES],
        "attributes": [
            {
                "id": a.id,
                "name": a.name,
                "category": a.category,
                "description": a.description,
                "skills": [s.id for s in R.SKILLS if s.attribute == a.id],
            }
            for a in R.ATTRIBUTES
        ],
        "skills": [
            {"id": s.id, "name": s.name, "attribute": s.attribute, "description": s.description} for s in R.SKILLS
        ],
        "attribute_distribution": list(R.ATTRIBUTE_DISTRIBUTION),
        "skill_profiles": [
            {
                "id": p.id,
                "name": p.name,
                "distribution": [{"value": v, "count": n} for v, n in p.distribution],
                "total_skills": p.total_skills,
            }
            for p in R.SKILL_PROFILES
        ],
        "creation_max": R.CREATION_MAX,
        "ranges": {
            "attribute": {"min": R.ATTRIBUTE_MIN, "max": R.ATTRIBUTE_MAX},
            "skill": {"min": R.SKILL_MIN, "max": R.SKILL_MAX},
        },
        "derived": [
            {"id": d.id, "name": d.name, "base": d.base, "attribute": d.attribute, "formula": d.formula}
            for d in R.DERIVED
        ],
        "convictions": {"count": R.CONVICTION_COUNT},
        "text_limits": dict(R.TEXT_LIMITS),
        "fields": list(DRAFT_FIELDS),
    }


__all__ = [
    "Character",
    "Conviction",
    "DRAFT_FIELDS",
    "OPTIONAL_FIELDS",
    "FieldError",
    "ValidationResult",
    "HISTORY_HTML_MAX",
    "check_history_html",
    "check_optional_text",
    "check_text",
    "clean_text",
    "creation_catalog",
    "derive",
    "has_bad_chars",
    "preview_derived",
    "validate_attributes",
    "validate_character",
    "validate_skills",
]
