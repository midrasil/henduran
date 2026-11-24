"""Narrador que preenche dados na Nova Jornada (ADR-077, item 3): pedido, contexto, esquema e validação.

Puro (sem provedor nem banco): :func:`prepare` confere o pedido e devolve o :class:`FillPlan`
com as mensagens, o esquema JSON fixo pedido ao modelo e a função que valida a resposta. A
execução (cancelamento, tempo limite e novas tentativas) fica em :mod:`henduran.services.fill`.

**A IA propõe, o motor valida.** Nada aqui grava estado. Tipos de pedido (``kind``):

- ``field``: um campo de texto (``field``): ``name``, ``concept``, ``appearance``, ``ambition``,
  ``desire``, ``convictions[i].text``, ``convictions[i].pillar``, ``journey.name`` ou
  ``journey.description``. O resultado sobrescreve só aquele campo (no cliente).
- ``missing``: os campos **em branco** de uma aba (``tab``): ``ident`` (nome, Conceito e
  aparência) ou ``obj`` (Ambição, Desejo, Convicções e Pilares). Sem campos em branco:
  ``nada_a_preencher``.
- ``attributes``: os Atributos sem valor, mantendo os já escolhidos; a distribuição final
  tem de ser a do catálogo de criação (``rules/creation.py``).
- ``skills``: o perfil (o escolhido, se houver) e as Perícias, mantendo as já escolhidas;
  a distribuição final tem de ser a do perfil.
- ``history``: ``mode`` ``write`` (escreve ou desenvolve a História a partir do texto já
  escrito) ou ``continue`` (continua o texto). O modelo devolve HTML simples, que o serviço
  sanea (:mod:`henduran.richtext`); o limite de 4.000 conta o texto puro (em ``continue``,
  o total).

Os textos passam pelas mesmas conferências da criação (``check_text``: normalização,
caracteres de controle e limite de cada campo de ``GET /rules/creation``).

Resultado (``result``), de esquema fixo por tipo:

- ``field`` e ``missing``: ``{"values": {"<caminho>": "texto", ...}}``.
- ``attributes``: ``{"attributes": {"<id>": valor, ...}}`` (os seis).
- ``skills``: ``{"skill_profile": "<id>", "skills": {"<id>": valor, ...}}`` (só as acima de 0).
- ``history``: ``{"history_html": "<HTML saneado>", "history": "texto puro"}`` (a História
  inteira; em ``continue``, o texto anterior seguido da continuação).
"""

from __future__ import annotations

import json
import re
from collections import Counter
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from typing import Any

from henduran.narrative.scene import InvalidProposal
from henduran.providers.base import ChatMessage
from henduran.richtext import paragraphs_html, sanitize
from henduran.rules import fatia1 as R
from henduran.rules.creation import (
    HISTORY_HTML_INPUT_MAX,
    FieldError,
    check_text,
    clean_text,
    validate_attributes,
    validate_skills,
)
from henduran.services.journey_creation import JOURNEY_DESCRIPTION_MAX, JOURNEY_NAME_MAX

KINDS = ("field", "missing", "attributes", "skills", "history")
TABS = ("ident", "obj")
HISTORY_MODES = ("write", "continue")
REQUEST_FIELDS = ("kind", "field", "tab", "mode", "idea", "world", "character", "journey")
WORLD_KEYS = ("name", "era", "tone", "place")
JOURNEY_KEYS = ("name", "description")
IDEA_MAX = 500
CONTEXT_MAX = 4000  # cada texto do Mundo no pedido
HISTORY_CONTINUE_MIN = 40  # caracteres livres mínimos para pedir uma continuação
HISTORY_HTML_OUT_MAX = 16000  # HTML que o modelo pode devolver (o limite real é o do texto puro)


class FillInvalid(Exception):
    """Pedido inválido (422); ``errors`` traz os erros por campo."""

    def __init__(self, code: str, message: str, errors: list[FieldError] | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.errors = errors or []

    def error_dicts(self) -> list[dict[str, str]]:
        return [e.to_dict() for e in self.errors]


# ------------------------------------------------------------------ campos de texto
@dataclass(frozen=True)
class TextSpec:
    path: str  # caminho do campo no formulário (o do erro de validação)
    key: str  # chave no JSON pedido ao modelo
    limit: int
    label: str
    single_line: bool
    hint: str  # o que o campo é, para o modelo


_CONVICTION_HINT = (
    "uma Convicção: um princípio que o personagem se recusa a trair, um limite de conduta (não um objetivo)"
)
_PILLAR_HINT = "o Pilar dessa Convicção: a pessoa, o lugar ou o objeto concreto da história que a encarna"


def _specs() -> dict[str, TextSpec]:
    L = R.TEXT_LIMITS
    specs = [
        TextSpec("name", "name", L["name"], "O nome", True, "o nome do personagem"),
        TextSpec("concept", "concept", L["concept"], "O Conceito", False,
                 "o Conceito: quem é o personagem em poucas palavras (origem, ocupação, o que o move)"),
        TextSpec("appearance", "appearance", L["appearance"], "A aparência", False,
                 "a aparência: como os outros o veem (traços, roupas, marcas), em duas ou três frases"),
        TextSpec("ambition", "ambition", L["ambition"], "A Ambição", False,
                 "a Ambição: o que o personagem almeja a longo prazo"),
        TextSpec("desire", "desire", L["desire"], "O Desejo", False, "o Desejo: o que o personagem quer alcançar agora"),
    ]
    for i in range(R.CONVICTION_COUNT):
        specs.append(TextSpec(f"convictions[{i}].text", f"conviction_{i + 1}", L["conviction_text"], "A Convicção",
                              False, f"{_CONVICTION_HINT} (Convicção {i + 1})"))
        specs.append(TextSpec(f"convictions[{i}].pillar", f"pillar_{i + 1}", L["conviction_pillar"], "O Pilar",
                              False, f"{_PILLAR_HINT} (Pilar da Convicção {i + 1})"))
    specs.append(TextSpec("journey.name", "journey_name", JOURNEY_NAME_MAX, "O nome da Jornada", True,
                          "o nome da Jornada: um título curto e evocativo para esta história"))
    specs.append(TextSpec("journey.description", "journey_description", JOURNEY_DESCRIPTION_MAX,
                          "A descrição da Jornada", False,
                          "a descrição da Jornada: em poucas linhas, o ponto de partida, o clima e o que está em jogo"))
    return {s.path: s for s in specs}


TEXT_SPECS = _specs()
TAB_FIELDS = {
    "ident": ("name", "concept", "appearance"),
    "obj": ("ambition", "desire", *(p for i in range(R.CONVICTION_COUNT)
                                     for p in (f"convictions[{i}].text", f"convictions[{i}].pillar"))),
}


# ------------------------------------------------------------------ leitura do pedido
def _text(errors: list[FieldError], path: str, value: Any, limit: int) -> str:
    """Texto do contexto: ausente vale vazio; não texto é erro; longo demais é cortado no limite."""
    if value is None:
        return ""
    if not isinstance(value, str):
        errors.append(FieldError(path, "tipo_invalido", "Deve ser um texto."))
        return ""
    if len(value) > limit * 4 + 64:
        errors.append(FieldError(path, "muito_longo", f"Deve ter até {limit} caracteres."))
        return ""
    return clean_text(value)[:limit]


@dataclass
class CharacterContext:
    texts: dict[str, str]  # caminho -> texto (vazio = em branco)
    history: str  # texto puro
    history_html: str  # HTML saneado (vazio se não há História)
    optional: dict[str, str]
    attributes: dict[str, int]  # só os escolhidos
    skill_profile: str | None
    skills: dict[str, int]  # só as acima de 0


def _read_character(errors: list[FieldError], raw: Any) -> CharacterContext:
    if raw is None:
        raw = {}
    if not isinstance(raw, dict):
        errors.append(FieldError("character", "tipo_invalido", "O personagem deve ser um objeto."))
        raw = {}
    texts: dict[str, str] = {}
    for path in ("name", "concept", "appearance", "ambition", "desire"):
        texts[path] = _text(errors, f"character.{path}", raw.get(path), TEXT_SPECS[path].limit)
    convictions = raw.get("convictions")
    if convictions is not None and not isinstance(convictions, list):
        errors.append(FieldError("character.convictions", "tipo_invalido", "As Convicções devem ser uma lista."))
        convictions = []
    for i in range(R.CONVICTION_COUNT):
        item = (convictions or [])[i] if i < len(convictions or []) else {}
        if not isinstance(item, dict):
            item = {}
        for part in ("text", "pillar"):
            path = f"convictions[{i}].{part}"
            texts[path] = _text(errors, f"character.{path}", item.get(part), TEXT_SPECS[path].limit)
    optional = {k: _text(errors, f"character.{k}", raw.get(k), R.TEXT_LIMITS[k]) for k in ("age", "height", "origin", "personality")}
    history_html, history = "", ""
    raw_html = raw.get("history_html")
    if raw_html is not None:
        if not isinstance(raw_html, str) or len(raw_html) > HISTORY_HTML_INPUT_MAX:
            errors.append(FieldError("character.history_html", "tipo_invalido", "A história deve ser um texto."))
        else:
            rich = sanitize(raw_html)
            if rich.plain.strip():
                history_html, history = rich.html, rich.plain
    elif raw.get("history") is not None:
        history = _text(errors, "character.history", raw.get("history"), R.TEXT_LIMITS["history"])
        history_html = paragraphs_html(history) if history else ""
    attributes: dict[str, int] = {}
    raw_attrs = raw.get("attributes")
    if raw_attrs is not None:
        if not isinstance(raw_attrs, dict):
            errors.append(FieldError("character.attributes", "tipo_invalido", "Os Atributos devem ser um mapa."))
        else:
            for key, v in raw_attrs.items():
                if key not in R.ATTRIBUTES_BY_ID or v is None:
                    continue
                if isinstance(v, bool) or not isinstance(v, int) or not R.ATTRIBUTE_MIN <= v <= R.CREATION_MAX:
                    errors.append(FieldError(f"character.attributes.{key}", "tipo_invalido", "Valor de Atributo inválido."))
                else:
                    attributes[key] = v
    profile = raw.get("skill_profile")
    if profile is not None and profile not in R.SKILL_PROFILES_BY_ID:
        errors.append(FieldError("character.skill_profile", "perfil_desconhecido", "Perfil de Perícias desconhecido."))
        profile = None
    skills: dict[str, int] = {}
    raw_skills = raw.get("skills")
    if raw_skills is not None:
        if not isinstance(raw_skills, dict):
            errors.append(FieldError("character.skills", "tipo_invalido", "As Perícias devem ser um mapa."))
        else:
            for key, v in raw_skills.items():
                if key not in R.SKILLS_BY_ID or v in (None, 0):
                    continue
                if isinstance(v, bool) or not isinstance(v, int) or not 1 <= v <= R.CREATION_MAX:
                    errors.append(FieldError(f"character.skills.{key}", "tipo_invalido", "Valor de Perícia inválido."))
                else:
                    skills[key] = v
    return CharacterContext(texts, history, history_html, optional, attributes, profile, skills)


def _read_group(errors: list[FieldError], raw: Any, name: str, keys: tuple[str, ...], limit: int) -> dict[str, str]:
    if raw is None:
        return {k: "" for k in keys}
    if not isinstance(raw, dict):
        errors.append(FieldError(name, "tipo_invalido", f"{name} deve ser um objeto."))
        return {k: "" for k in keys}
    for key in raw:
        if key not in keys:
            errors.append(FieldError(f"{name}.{str(key)[:40]}", "campo_desconhecido", "Campo desconhecido."))
    return {k: _text(errors, f"{name}.{k}", raw.get(k), limit) for k in keys}


# ------------------------------------------------------------------ plano
@dataclass
class FillPlan:
    kind: str
    messages: list[ChatMessage]
    schema: dict[str, Any]
    parse: Callable[[str], dict[str, Any]]


SYSTEM = (
    "Você ajuda o jogador a preparar uma Jornada do Henduran, um RPG solo de fantasia. Você só propõe: o jogador "
    "confere tudo e decide.\n"
    "- Escreva em português do Brasil.\n"
    "- Responda somente com o objeto JSON pedido, sem comentários nem texto fora dele.\n"
    "- Use o Mundo, o lugar inicial e o que o jogador já preencheu; não contradiga nada disso.\n"
    "- Não invente regras, poderes, valores ou mecânicas de jogo; descreva só a pessoa e a história.\n"
    "- Seja concreto e evite clichês genéricos."
)


def _context_block(world: dict[str, str], character: CharacterContext, journey: dict[str, str], idea: str, *, skip: str | None = None) -> str:
    lines = ["Mundo:"]
    labels = {"name": "Nome", "era": "Época", "tone": "Tom", "place": "Lugar inicial"}
    lines += [f"- {labels[k]}: {world[k]}" for k in WORLD_KEYS if world[k]]
    if len(lines) == 1:
        lines.append("- (não informado)")
    lines.append("")
    lines.append("Personagem, o que já foi preenchido:")
    names = {
        "name": "Nome", "concept": "Conceito", "appearance": "Aparência", "ambition": "Ambição", "desire": "Desejo",
    }
    filled = 0
    for path, label in names.items():
        if path != skip and character.texts[path]:
            lines.append(f"- {label}: {character.texts[path]}")
            filled += 1
    for key, label in (("age", "Idade"), ("height", "Altura"), ("origin", "Origem"), ("personality", "Personalidade")):
        if character.optional[key]:
            lines.append(f"- {label}: {character.optional[key]}")
            filled += 1
    for i in range(R.CONVICTION_COUNT):
        text = "" if skip == f"convictions[{i}].text" else character.texts[f"convictions[{i}].text"]
        pillar = "" if skip == f"convictions[{i}].pillar" else character.texts[f"convictions[{i}].pillar"]
        if text or pillar:
            lines.append(f"- Convicção {i + 1}: {text or '(em branco)'} (Pilar: {pillar or 'em branco'})")
            filled += 1
    if character.history and skip != "history":
        lines.append(f"- História: {character.history}")
        filled += 1
    if not filled:
        lines.append("- (nada ainda)")
    if journey["name"] and skip != "journey.name":
        lines += ["", f"Nome da Jornada: {journey['name']}"]
    if journey["description"] and skip != "journey.description":
        lines += ["", f"Descrição da Jornada: {journey['description']}"]
    if idea:
        lines += ["", f"Ideia do jogador para o personagem (use como guia): {idea}"]
    return "\n".join(lines)


def _object_schema(properties: dict[str, Any], required: list[str] | None = None) -> dict[str, Any]:
    return {
        "type": "object",
        "properties": properties,
        "required": list(properties) if required is None else required,
        "additionalProperties": False,
    }


def _load(raw: Any, keys: tuple[str, ...]) -> dict[str, Any]:
    """Objeto JSON da resposta com exatamente ``keys`` (tolera a cerca de código Markdown)."""
    text = raw.strip() if isinstance(raw, str) else ""
    fenced = re.match(r"^```(?:json)?\s*\n(.*)\n```$", text, re.DOTALL)
    if fenced:
        text = fenced.group(1)
    try:
        data = json.loads(text)
    except (TypeError, ValueError, RecursionError) as exc:
        raise InvalidProposal("A resposta não é JSON válido.") from exc
    if not isinstance(data, dict):
        raise InvalidProposal("A resposta deve ser um objeto JSON.")
    missing = [k for k in keys if k not in data]
    extra = [str(k)[:40] for k in data if k not in keys]
    if missing:
        raise InvalidProposal(f"Faltam as chaves: {', '.join(missing)}.")
    if extra:
        raise InvalidProposal(f"Chaves desconhecidas: {', '.join(extra)}.")
    return data


def _text_plan(paths: list[str], context: str, *, current: Mapping[str, str]) -> tuple[list[ChatMessage], dict, Callable]:
    specs = [TEXT_SPECS[p] for p in paths]
    task = ["Sugira:"]
    for s in specs:
        extra = " (uma linha)" if s.single_line else ""
        task.append(f'- "{s.key}": {s.hint}; até {s.limit} caracteres{extra}.')
        if current.get(s.path):
            task.append(f"  Valor atual, que o jogador quer trocar (proponha outro): {current[s.path]}")
    task.append("Responda com o objeto JSON com essas chaves.")
    messages: list[ChatMessage] = [
        {"role": "system", "content": SYSTEM},
        {"role": "user", "content": f"{context}\n\n" + "\n".join(task)},
    ]
    schema = {"title": "preenchimento_textos",
              **_object_schema({s.key: {"type": "string", "minLength": 1, "maxLength": s.limit} for s in specs})}

    def parse(raw: str) -> dict[str, Any]:
        data = _load(raw, tuple(s.key for s in specs))
        values: dict[str, str] = {}
        for s in specs:
            errors: list[FieldError] = []
            value = data[s.key]
            if s.single_line and isinstance(value, str):
                value = " ".join(value.split())
            cleaned = check_text(errors, s.path, value, s.limit, s.label, single_line=s.single_line)
            if cleaned is None:
                raise InvalidProposal(f"'{s.key}': {errors[0].message}")
            values[s.path] = cleaned
        return {"values": values}

    return messages, schema, parse


def _describe_counts(counts: Mapping[int, int]) -> str:
    return ", ".join(f"{n} em {v}" for v, n in sorted(counts.items(), reverse=True) if n)


def _attributes_plan(character: CharacterContext, context: str) -> tuple[list[ChatMessage], dict, Callable]:
    fixed = dict(character.attributes)
    remaining = Counter(R.ATTRIBUTE_DISTRIBUTION) - Counter(fixed.values())
    if sum((Counter(fixed.values()) - Counter(R.ATTRIBUTE_DISTRIBUTION)).values()):
        raise FillInvalid("distribuicao_invalida", "Os Atributos já escolhidos não cabem na distribuição da criação.",
                          [FieldError("character.attributes", "distribuicao_invalida", "Valores além da distribuição.")])
    if len(fixed) == len(R.ATTRIBUTES):
        raise FillInvalid("nada_a_preencher", "Todos os Atributos já têm valor.")
    lines = [
        "Distribua os valores dos Atributos do personagem, de acordo com quem ele é.",
        f"A distribuição completa é {_describe_counts(Counter(R.ATTRIBUTE_DISTRIBUTION))}: cada Atributo recebe "
        "exatamente um valor e cada valor é usado exatamente essa quantidade de vezes.",
        "Atributos:",
    ]
    for a in R.ATTRIBUTES:
        keep = f" — já escolhido: {fixed[a.id]} (mantenha)" if a.id in fixed else ""
        lines.append(f'- "{a.id}" ({a.name}): {a.description}{keep}')
    lines.append(f"Valores que faltam distribuir: {_describe_counts(remaining)}.")
    lines.append('Responda {"attributes": {"<id>": valor, ...}} com os seis Atributos.')
    values = sorted(set(R.ATTRIBUTE_DISTRIBUTION))
    props = {a.id: ({"const": fixed[a.id]} if a.id in fixed else {"type": "integer", "enum": values}) for a in R.ATTRIBUTES}
    schema = {"title": "preenchimento_atributos", **_object_schema({"attributes": _object_schema(props)})}

    def parse(raw: str) -> dict[str, Any]:
        data = _load(raw, ("attributes",))
        got = data["attributes"]
        if not isinstance(got, dict):
            raise InvalidProposal("'attributes' deve ser um objeto.")
        changed = [k for k, v in fixed.items() if got.get(k) != v]
        if changed:
            raise InvalidProposal(f"Os Atributos já escolhidos mudaram: {', '.join(changed)}; mantenha-os.")
        checked, errors = validate_attributes(got)
        if checked is None:
            raise InvalidProposal(" ".join(e.message for e in errors[:3]))
        return {"attributes": {a: checked[a] for a in R.ATTRIBUTE_IDS}}

    messages: list[ChatMessage] = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": f"{context}\n\n" + "\n".join(lines)}]
    return messages, schema, parse


def _skills_plan(character: CharacterContext, context: str) -> tuple[list[ChatMessage], dict, Callable]:
    profile = R.SKILL_PROFILES_BY_ID.get(character.skill_profile or "")
    fixed = dict(character.skills) if profile else {}
    if profile:
        over = Counter(fixed.values()) - Counter(profile.counts)
        if sum(over.values()):
            raise FillInvalid("distribuicao_invalida", "As Perícias já escolhidas não cabem no perfil.",
                              [FieldError("character.skills", "distribuicao_invalida", "Valores além do perfil.")])
        if Counter(fixed.values()) == Counter(profile.counts):
            raise FillInvalid("nada_a_preencher", "Todas as Perícias do perfil já têm valor.")
    profiles = [profile] if profile else list(R.SKILL_PROFILES)
    lines = ["Escolha as Perícias do personagem, de acordo com quem ele é."]
    if profile:
        lines.append(f'O perfil já escolhido é "{profile.id}" ({profile.name}): {_describe_counts(profile.counts)}; mantenha-o.')
    else:
        lines.append("Escolha um perfil de Perícias:")
        lines += [f'- "{p.id}" ({p.name}): {p.total_skills} Perícias, {_describe_counts(p.counts)}' for p in profiles]
    lines.append("Cada valor do perfil vai para uma Perícia diferente, exatamente na quantidade do perfil; as demais ficam em 0.")
    lines.append("Perícias:")
    attr_names = {a.id: a.name for a in R.ATTRIBUTES}
    for s in R.SKILLS:
        keep = f" — já escolhida: {fixed[s.id]} (mantenha)" if s.id in fixed else ""
        lines.append(f'- "{s.id}" ({s.name}, {attr_names[s.attribute]}): {s.description}{keep}')
    if character.attributes:
        lines.append("Atributos já escolhidos: " + ", ".join(f"{attr_names[k]} {v}" for k, v in character.attributes.items()) + ".")
    lines.append('Responda {"skill_profile": "<id>", "skills": {"<id>": valor, ...}} só com as Perícias acima de 0.')
    skill_props: dict[str, Any] = {
        s.id: ({"const": fixed[s.id]} if s.id in fixed else {"type": "integer", "minimum": 1, "maximum": R.CREATION_MAX})
        for s in R.SKILLS
    }
    schema = {
        "title": "preenchimento_pericias",
        **_object_schema({
            "skill_profile": {"const": profile.id} if profile else {"type": "string", "enum": [p.id for p in profiles]},
            "skills": _object_schema(skill_props, required=list(fixed)),
        }),
    }

    def parse(raw: str) -> dict[str, Any]:
        data = _load(raw, ("skill_profile", "skills"))
        chosen = data["skill_profile"]
        if profile and chosen != profile.id:
            raise InvalidProposal(f"O perfil escolhido é '{profile.id}'; mantenha-o.")
        got = data["skills"]
        if not isinstance(got, dict):
            raise InvalidProposal("'skills' deve ser um objeto.")
        changed = [k for k, v in fixed.items() if got.get(k) != v]
        if changed:
            raise InvalidProposal(f"As Perícias já escolhidas mudaram: {', '.join(changed)}; mantenha-as.")
        checked_profile, checked, errors = validate_skills(chosen, got)
        if checked is None or checked_profile is None:
            raise InvalidProposal(" ".join(e.message for e in errors[:3]))
        return {"skill_profile": checked_profile, "skills": {k: v for k, v in checked.items() if v > 0}}

    messages: list[ChatMessage] = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": f"{context}\n\n" + "\n".join(lines)}]
    return messages, schema, parse


_TAG = re.compile(r"<\s*/?\s*(p|h2|h3|strong|em|u|s|ul|ol|li|blockquote|b|i)\b", re.IGNORECASE)


def _rich(text: str) -> tuple[str, str]:
    """HTML saneado e texto puro da resposta (texto sem tags vira parágrafos)."""
    rich = sanitize(text if _TAG.search(text) else paragraphs_html(text))
    return rich.html, rich.plain


def _history_plan(character: CharacterContext, context: str, mode: str) -> tuple[list[ChatMessage], dict, Callable]:
    limit = R.TEXT_LIMITS["history"]
    previous_html, previous = character.history_html, character.history
    continuing = mode == "continue"
    if continuing and not previous.strip():
        raise FillInvalid("nada_a_continuar", "Escreva algo na História antes de pedir para continuar.")
    room = limit - len(previous) - 1 if continuing else limit
    if continuing and room < HISTORY_CONTINUE_MIN:
        raise FillInvalid("historia_no_limite", f"A História já está perto do limite de {limit} caracteres.")
    if continuing:
        task = (
            f"Continue a História do personagem a partir do ponto onde ela parou, sem repetir nada do que já foi "
            f"escrito: um ou dois parágrafos, até {min(room, 1500)} caracteres.\n\nHistória até aqui:\n{previous}"
        )
    elif previous.strip():
        task = (
            "Desenvolva a História do personagem a partir do que o jogador já escreveu: mantenha os fatos, os nomes e "
            f"o sentido, e dê mais corpo ao texto. Até {min(limit, 3000)} caracteres.\n\nTexto do jogador:\n{previous}"
        )
    else:
        task = f"Escreva a História do personagem: de onde vem e o que viveu até aqui. Até {min(limit, 3000)} caracteres."
    task += (
        "\n\nUse HTML simples: <p> para cada parágrafo, <h3> para um subtítulo, se quiser, e <strong> ou <em> com "
        'moderação. Responda {"history": "..."}.'
    )
    schema = {"title": "preenchimento_historia",
              **_object_schema({"history": {"type": "string", "minLength": 1, "maxLength": HISTORY_HTML_OUT_MAX}})}

    def parse(raw: str) -> dict[str, Any]:
        data = _load(raw, ("history",))
        text = data["history"]
        if not isinstance(text, str) or len(text) > HISTORY_HTML_OUT_MAX:
            raise InvalidProposal("'history' deve ser um texto de até 16.000 caracteres.")
        added_html, added = _rich(text)
        if not added.strip():
            raise InvalidProposal("'history' não pode ser vazio.")
        html = (previous_html + added_html) if continuing else added_html
        rich = sanitize(html)
        if len(rich.plain) > limit:
            raise InvalidProposal(
                f"A História passou de {limit} caracteres (tem {len(rich.plain)}); escreva um texto mais curto."
            )
        return {"history_html": rich.html, "history": rich.plain}

    messages: list[ChatMessage] = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": f"{context}\n\n{task}"}]
    return messages, schema, parse


def prepare(body: dict[str, Any]) -> FillPlan:
    """Confere o pedido e monta o plano. Levanta :class:`FillInvalid` (422)."""
    errors: list[FieldError] = []
    kind = body.get("kind")
    if kind not in KINDS:
        raise FillInvalid("pedido_invalido", f"'kind' deve ser um de: {', '.join(KINDS)}.",
                          [FieldError("kind", "tipo_invalido", "Tipo de pedido desconhecido.")])
    idea = _text(errors, "idea", body.get("idea"), IDEA_MAX)
    world = _read_group(errors, body.get("world"), "world", WORLD_KEYS, CONTEXT_MAX)
    journey_raw = body.get("journey")
    journey = _read_group(errors, journey_raw, "journey", JOURNEY_KEYS, JOURNEY_DESCRIPTION_MAX)
    character = _read_character(errors, body.get("character"))
    if errors:
        raise FillInvalid("pedido_invalido", "O pedido ao Narrador tem erros.", errors)
    current = {**character.texts, "journey.name": journey["name"], "journey.description": journey["description"]}

    if kind == "field":
        field = body.get("field")
        if field not in TEXT_SPECS:
            raise FillInvalid("pedido_invalido", "Campo desconhecido para o Narrador sugerir.",
                              [FieldError("field", "campo_desconhecido", "Campo desconhecido.")])
        context = _context_block(world, character, journey, idea, skip=field)
        messages, schema, parse = _text_plan([field], context, current=current)
    elif kind == "missing":
        tab = body.get("tab")
        if tab not in TABS:
            raise FillInvalid("pedido_invalido", f"'tab' deve ser um de: {', '.join(TABS)}.",
                              [FieldError("tab", "tipo_invalido", "Aba desconhecida.")])
        blank = [p for p in TAB_FIELDS[tab] if not current[p]]
        if not blank:
            raise FillInvalid("nada_a_preencher", "Os campos desta aba já estão preenchidos.")
        context = _context_block(world, character, journey, idea)
        messages, schema, parse = _text_plan(blank, context, current={})
    elif kind == "attributes":
        messages, schema, parse = _attributes_plan(character, _context_block(world, character, journey, idea))
    elif kind == "skills":
        messages, schema, parse = _skills_plan(character, _context_block(world, character, journey, idea))
    else:
        mode = body.get("mode")
        if mode not in HISTORY_MODES:
            raise FillInvalid("pedido_invalido", f"'mode' deve ser um de: {', '.join(HISTORY_MODES)}.",
                              [FieldError("mode", "tipo_invalido", "Modo desconhecido.")])
        context = _context_block(world, character, journey, idea, skip="history")
        messages, schema, parse = _history_plan(character, context, mode)
    return FillPlan(kind=kind, messages=messages, schema=schema, parse=parse)


__all__ = [
    "FillInvalid",
    "FillPlan",
    "IDEA_MAX",
    "KINDS",
    "REQUEST_FIELDS",
    "TAB_FIELDS",
    "TEXT_SPECS",
    "prepare",
]
