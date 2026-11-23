"""Data da Jornada no calendário do Mundo (ADR-076, item 16). A data é do motor, não do Narrador.

O calendário vem do conteúdo do Mundo (esquema v1): ``year``, ``months: [{name, days}]``
e ``weekdays``. A Jornada grava ano, mês (índice 1..N) e dia (1..dias do mês). Na
criação, o motor sorteia o mês (peso igual entre os meses) e depois o dia (peso igual
entre os dias daquele mês); o ano é o ``year`` do calendário. A data só muda quando
existir o ADR de passagem de tempo.

**Dia da semana** (calculado, nunca gravado)::

    dia_absoluto = (ano - calendar.year) * dias_do_ano + soma(dias dos meses antes do mês) + (dia - 1)
    dia_da_semana = weekdays[dia_absoluto mod len(weekdays)]

Ou seja, o dia 1 do mês 1 do ano do calendário é o primeiro dia da semana da lista; no
ano do calendário (o único usado enquanto o tempo não passa), é o dia absoluto desde o
dia 1 do mês 1 do ano, módulo o número de dias da semana.
"""

from __future__ import annotations

import random
from typing import Any


def _calendar(world: dict[str, Any] | None) -> dict[str, Any] | None:
    cal = (world or {}).get("calendar") if isinstance(world, dict) else None
    if not isinstance(cal, dict) or not cal.get("months") or not cal.get("weekdays"):
        return None
    return cal


def draw_date(calendar: dict[str, Any], rng: random.Random | None = None) -> tuple[int, int, int]:
    """Sorteia ``(ano, mês, dia)`` no calendário: mês com peso igual, depois o dia no mês."""
    r = rng or random
    months = calendar["months"]
    month = r.randrange(len(months)) + 1
    day = r.randrange(int(months[month - 1]["days"])) + 1
    return int(calendar["year"]), month, day


def is_valid_date(calendar: dict[str, Any], year: Any, month: Any, day: Any) -> bool:
    months = calendar.get("months") or []
    if not all(isinstance(v, int) and not isinstance(v, bool) for v in (year, month, day)):
        return False
    return year >= 1 and 1 <= month <= len(months) and 1 <= day <= int(months[month - 1]["days"])


def weekday_index(calendar: dict[str, Any], year: int, month: int, day: int) -> int:
    """Índice (0..len(weekdays)-1) do dia da semana, pela fórmula do módulo."""
    months = calendar["months"]
    year_length = sum(int(m["days"]) for m in months)
    absolute = (year - int(calendar["year"])) * year_length + sum(int(m["days"]) for m in months[: month - 1]) + day - 1
    return absolute % len(calendar["weekdays"])


def date_view(world: dict[str, Any] | None, year: Any, month: Any, day: Any) -> dict[str, Any] | None:
    """``{year, month, month_name, day, weekday, weekday_name, era_label}`` ou ``None`` se não houver data válida."""
    cal = _calendar(world)
    if cal is None or not is_valid_date(cal, year, month, day):
        return None
    index = weekday_index(cal, year, month, day)
    return {
        "year": year,
        "month": month,
        "month_name": cal["months"][month - 1].get("name"),
        "day": day,
        "weekday": index + 1,
        "weekday_name": cal["weekdays"][index],
        "era_label": cal.get("era_label"),
    }


def date_text(view: dict[str, Any] | None) -> str | None:
    """Texto curto para o contexto do Narrador (ex.: "12 de Alvorim, Solário, Ano 476 da Fundação")."""
    if view is None:
        return None
    return f"{view['day']} de {view['month_name']}, {view['weekday_name']}, {view.get('era_label') or view['year']}"


__all__ = ["date_text", "date_view", "draw_date", "is_valid_date", "weekday_index"]
