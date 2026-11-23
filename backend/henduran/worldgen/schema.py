"""Esquema v1 do conteúdo de um Mundo e a sua validação (defesa do servidor).

O jogador pode **editar** o conteúdo sorteado antes de confirmar; por isso tudo
o que chega é revalidado aqui, com limites de tamanho e de contagem. Esquema::

    {
      "schema": 1,
      "name": "Terras de Valória",                       # 1..100 caracteres
      "era":  {"name": "...", "description": "..."},     # nome 1..100, descrição 1..1000
      "tone": {"name": "...", "description": "..."},
      "calendar": {
        "name": "Calendário de ...",                     # 1..100
        "year": 476,                                     # inteiro 1..100000
        "era_label": "Ano 476 da Fundação",              # 1..100
        "months": [{"name": "Alvorim", "days": 30}],     # 8..14 meses; nome 1..40; dias 20..40
        "weekdays": ["Solário", "..."]                   # 5..8 dias; nome 1..40
      },
      "religions": [{"name", "domain", "description"}],  # 1..3; nome 1..100, domínio 1..60
      "places": [{"id", "name", "type", "description"}]  # 3..5; id ^[a-z0-9][a-z0-9-]{0,39}$, tipo 1..40
    }

Nomes de meses, de dias da semana, de lugares e ids de lugares são únicos no
Mundo (sem diferenciar maiúsculas). Campos desconhecidos são recusados. O JSON
inteiro tem no máximo ``CONTENT_MAX_BYTES`` (256 KB, UTF-8). Textos são dados:
normalizados (NFC, pontas sem espaços), sem caracteres de controle (as
descrições aceitam quebra de linha e tabulação).
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any

from henduran.rules.creation import FieldError, check_text

SCHEMA_VERSION = 1
CONTENT_MAX_BYTES = 256 * 1024
SEED_MAX = 2**53 - 1  # inteiro seguro em JavaScript

NAME_MAX = 100
DESCRIPTION_MAX = 1000
SHORT_NAME_MAX = 40
DOMAIN_MAX = 60
YEAR_LIMITS = (1, 100_000)
MONTHS_MIN, MONTHS_MAX = 8, 14
MONTH_DAYS_MIN, MONTH_DAYS_MAX = 20, 40
WEEKDAYS_MIN, WEEKDAYS_MAX = 5, 8
RELIGIONS_MIN, RELIGIONS_MAX = 1, 3
PLACES_MIN, PLACES_MAX = 3, 5
PLACE_ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,39}$")

_TOP_KEYS = ("schema", "name", "era", "tone", "calendar", "religions", "places")
_LABELED_KEYS = ("name", "description")
_CALENDAR_KEYS = ("name", "year", "era_label", "months", "weekdays")
_MONTH_KEYS = ("name", "days")
_RELIGION_KEYS = ("name", "domain", "description")
_PLACE_KEYS = ("id", "name", "type", "description")


@dataclass
class WorldValidation:
    errors: list[FieldError] = field(default_factory=list)
    content: dict[str, Any] | None = None  # normalizado, quando válido

    @property
    def valid(self) -> bool:
        return not self.errors

    def error_dicts(self) -> list[dict[str, str]]:
        return [e.to_dict() for e in self.errors]


def _is_int(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


class _Checker:
    def __init__(self) -> None:
        self.errors: list[FieldError] = []

    def add(self, path: str, code: str, message: str) -> None:
        self.errors.append(FieldError(path, code, message))

    def obj(self, path: str, value: Any, keys: tuple[str, ...], label: str) -> dict[str, Any] | None:
        if value is None:
            self.add(path, "obrigatorio", f"{label} é obrigatório(a).")
            return None
        if not isinstance(value, dict):
            self.add(path, "tipo_invalido", f"{label} deve ser um objeto.")
            return None
        for key in list(value)[:32]:
            if key not in keys:
                self.add(f"{path}.{str(key)[:40]}" if path else str(key)[:40], "campo_desconhecido", "Campo desconhecido.")
        return value

    def text(self, path: str, value: Any, limit: int, label: str, *, multiline: bool = False) -> str | None:
        return check_text(self.errors, path, value, limit, label, single_line=not multiline)

    def items(self, path: str, value: Any, low: int, high: int, label: str) -> list[Any] | None:
        if value is None:
            self.add(path, "obrigatorio", f"{label}: informe de {low} a {high}.")
            return None
        if not isinstance(value, list):
            self.add(path, "tipo_invalido", f"{label} deve ser uma lista.")
            return None
        if not low <= len(value) <= high:
            self.add(path, "quantidade_invalida", f"{label}: são de {low} a {high} (recebidos {len(value)}).")
            return None
        return value

    def unique(self, path: str, names: list[tuple[int, str]], label: str) -> None:
        seen: dict[str, int] = {}
        for i, name in names:
            key = name.casefold()
            if key in seen:
                self.add(f"{path}[{i}]", "duplicado", f"{label} repetido: {name}.")
            else:
                seen[key] = i


def _labeled(c: _Checker, path: str, value: Any, label: str) -> dict[str, str] | None:
    obj = c.obj(path, value, _LABELED_KEYS, label)
    if obj is None:
        return None
    name = c.text(f"{path}.name", obj.get("name"), NAME_MAX, f"O nome de {label.lower()}")
    desc = c.text(f"{path}.description", obj.get("description"), DESCRIPTION_MAX, f"A descrição de {label.lower()}", multiline=True)
    if name is None or desc is None:
        return None
    return {"name": name, "description": desc}


def _calendar(c: _Checker, value: Any) -> dict[str, Any] | None:
    obj = c.obj("calendar", value, _CALENDAR_KEYS, "O calendário")
    if obj is None:
        return None
    before = len(c.errors)
    name = c.text("calendar.name", obj.get("name"), NAME_MAX, "O nome do calendário")
    year = obj.get("year")
    if year is None:
        c.add("calendar.year", "obrigatorio", "O ano atual é obrigatório.")
    elif not _is_int(year):
        c.add("calendar.year", "tipo_invalido", "O ano deve ser um número inteiro.")
    elif not YEAR_LIMITS[0] <= year <= YEAR_LIMITS[1]:
        c.add("calendar.year", "fora_do_intervalo", f"O ano deve estar entre {YEAR_LIMITS[0]} e {YEAR_LIMITS[1]}.")
    era_label = c.text("calendar.era_label", obj.get("era_label"), NAME_MAX, "O nome do ano")
    months_out: list[dict[str, Any]] = []
    months = c.items("calendar.months", obj.get("months"), MONTHS_MIN, MONTHS_MAX, "Os meses")
    for i, month in enumerate(months or []):
        path = f"calendar.months[{i}]"
        m = c.obj(path, month, _MONTH_KEYS, "O mês")
        if m is None:
            continue
        mname = c.text(f"{path}.name", m.get("name"), SHORT_NAME_MAX, "O nome do mês")
        days = m.get("days")
        if days is None:
            c.add(f"{path}.days", "obrigatorio", "Informe o número de dias do mês.")
        elif not _is_int(days):
            c.add(f"{path}.days", "tipo_invalido", "O número de dias deve ser inteiro.")
        elif not MONTH_DAYS_MIN <= days <= MONTH_DAYS_MAX:
            c.add(f"{path}.days", "fora_do_intervalo", f"Um mês tem de {MONTH_DAYS_MIN} a {MONTH_DAYS_MAX} dias.")
        elif mname is not None:
            months_out.append({"name": mname, "days": days})
    c.unique("calendar.months", [(i, m["name"]) for i, m in enumerate(months_out)], "Mês")
    weekdays_out: list[str] = []
    weekdays = c.items("calendar.weekdays", obj.get("weekdays"), WEEKDAYS_MIN, WEEKDAYS_MAX, "Os dias da semana")
    for i, day in enumerate(weekdays or []):
        text = c.text(f"calendar.weekdays[{i}]", day, SHORT_NAME_MAX, "O nome do dia da semana")
        if text is not None:
            weekdays_out.append(text)
    c.unique("calendar.weekdays", list(enumerate(weekdays_out)), "Dia da semana")
    if len(c.errors) != before:
        return None
    return {"name": name, "year": year, "era_label": era_label, "months": months_out, "weekdays": weekdays_out}


def _religions(c: _Checker, value: Any) -> list[dict[str, str]] | None:
    items = c.items("religions", value, RELIGIONS_MIN, RELIGIONS_MAX, "As religiões")
    if items is None:
        return None
    before = len(c.errors)
    out = []
    for i, item in enumerate(items):
        path = f"religions[{i}]"
        obj = c.obj(path, item, _RELIGION_KEYS, "A religião")
        if obj is None:
            continue
        name = c.text(f"{path}.name", obj.get("name"), NAME_MAX, "O nome da religião")
        domain = c.text(f"{path}.domain", obj.get("domain"), DOMAIN_MAX, "O domínio")
        desc = c.text(f"{path}.description", obj.get("description"), DESCRIPTION_MAX, "A descrição da religião", multiline=True)
        out.append({"name": name, "domain": domain, "description": desc})
    return None if len(c.errors) != before else out


def _places(c: _Checker, value: Any) -> list[dict[str, str]] | None:
    items = c.items("places", value, PLACES_MIN, PLACES_MAX, "Os lugares iniciais")
    if items is None:
        return None
    before = len(c.errors)
    out = []
    for i, item in enumerate(items):
        path = f"places[{i}]"
        obj = c.obj(path, item, _PLACE_KEYS, "O lugar")
        if obj is None:
            continue
        pid = obj.get("id")
        if pid is None:
            c.add(f"{path}.id", "obrigatorio", "O lugar precisa de um id.")
        elif not isinstance(pid, str) or not PLACE_ID_RE.match(pid):
            c.add(f"{path}.id", "id_invalido", "O id do lugar usa letras minúsculas sem acento, números e hífens (até 40).")
            pid = None
        name = c.text(f"{path}.name", obj.get("name"), NAME_MAX, "O nome do lugar")
        kind = c.text(f"{path}.type", obj.get("type"), SHORT_NAME_MAX, "O tipo do lugar")
        desc = c.text(f"{path}.description", obj.get("description"), DESCRIPTION_MAX, "A descrição do lugar", multiline=True)
        out.append({"id": pid, "name": name, "type": kind, "description": desc})
    c.unique("places", [(i, p["id"]) for i, p in enumerate(out) if p["id"]], "Id de lugar")
    c.unique("places", [(i, p["name"]) for i, p in enumerate(out) if p["name"]], "Nome de lugar")
    return None if len(c.errors) != before else out


def validate_world_content(content: Any) -> WorldValidation:
    """Valida o conteúdo de Mundo no esquema v1. Devolve todos os erros ou o conteúdo normalizado."""
    result = WorldValidation()
    c = _Checker()
    result.errors = c.errors
    try:
        size = len(json.dumps(content, ensure_ascii=False, allow_nan=False).encode("utf-8"))
    except (TypeError, ValueError, RecursionError):
        c.add("", "conteudo_invalido", "O conteúdo do Mundo deve ser JSON válido.")
        return result
    if size > CONTENT_MAX_BYTES:
        c.add("", "muito_grande", f"O conteúdo do Mundo passa de {CONTENT_MAX_BYTES // 1024} KB.")
        return result
    top = c.obj("", content, _TOP_KEYS, "O conteúdo do Mundo")
    if top is None:
        return result
    schema = top.get("schema")
    if schema != SCHEMA_VERSION or not _is_int(schema):
        c.add("schema", "esquema_desconhecido", f"Esquema de Mundo desconhecido; este app usa o esquema {SCHEMA_VERSION}.")
        return result
    name = c.text("name", top.get("name"), NAME_MAX, "O nome do Mundo")
    era = _labeled(c, "era", top.get("era"), "A era")
    tone = _labeled(c, "tone", top.get("tone"), "O tom")
    calendar = _calendar(c, top.get("calendar"))
    religions = _religions(c, top.get("religions"))
    places = _places(c, top.get("places"))
    if c.errors:
        return result
    result.content = {
        "schema": SCHEMA_VERSION,
        "name": name,
        "era": era,
        "tone": tone,
        "calendar": calendar,
        "religions": religions,
        "places": places,
    }
    return result


def limits() -> dict[str, Any]:
    """Limites do esquema v1, para a interface do editor de Mundo."""
    return {
        "schema": SCHEMA_VERSION,
        "content_max_bytes": CONTENT_MAX_BYTES,
        "seed_max": SEED_MAX,
        "name_max": NAME_MAX,
        "description_max": DESCRIPTION_MAX,
        "short_name_max": SHORT_NAME_MAX,
        "domain_max": DOMAIN_MAX,
        "year": {"min": YEAR_LIMITS[0], "max": YEAR_LIMITS[1]},
        "months": {"min": MONTHS_MIN, "max": MONTHS_MAX},
        "month_days": {"min": MONTH_DAYS_MIN, "max": MONTH_DAYS_MAX},
        "weekdays": {"min": WEEKDAYS_MIN, "max": WEEKDAYS_MAX},
        "religions": {"min": RELIGIONS_MIN, "max": RELIGIONS_MAX},
        "places": {"min": PLACES_MIN, "max": PLACES_MAX},
        "place_id_pattern": PLACE_ID_RE.pattern,
    }


__all__ = [
    "CONTENT_MAX_BYTES",
    "SCHEMA_VERSION",
    "SEED_MAX",
    "WorldValidation",
    "limits",
    "validate_world_content",
]
