"""Gerador de mundo por código: determinístico por semente, sem IA e sem rede.

``generate_world(seed)`` devolve ``{"seed": int, "content": {...}}`` com o
conteúdo no **esquema v1** (ver :mod:`henduran.worldgen.schema`). A mesma semente
gera sempre o mesmo conteúdo (``random.Random(seed)``, versão das tabelas fixa).
Sem semente, uma é sorteada e devolvida, para o jogador poder repetir o sorteio.
"""

from __future__ import annotations

import random
from typing import Any

from henduran.worldgen import data as D
from henduran.worldgen.schema import (
    MONTHS_MAX,
    MONTHS_MIN,
    MONTH_DAYS_MAX,
    MONTH_DAYS_MIN,
    PLACES_MAX,
    PLACES_MIN,
    RELIGIONS_MAX,
    RELIGIONS_MIN,
    SCHEMA_VERSION,
    SEED_MAX,
    WEEKDAYS_MAX,
    WEEKDAYS_MIN,
)

YEAR_MIN = 100
YEAR_MAX = 1500
_NAME_ATTEMPTS = 200


def new_seed() -> int:
    """Semente aleatória entre 0 e ``SEED_MAX`` (inteiro seguro em JavaScript)."""
    return random.SystemRandom().randint(0, SEED_MAX)


def make_name(rng: random.Random, used: set[str]) -> str:
    """Nome inventado (prefixo + meio opcional + sufixo), único em ``used`` e fora de :data:`BLOCKED_NAMES`."""
    for _ in range(_NAME_ATTEMPTS):
        middle = rng.choice(D.NAME_MIDDLES) if rng.random() < 0.45 else ""
        name = rng.choice(D.NAME_PREFIXES) + middle + rng.choice(D.NAME_SUFFIXES)
        key = name.casefold()
        if key not in used and key not in D.BLOCKED_NAMES:
            used.add(key)
            return name
    raise RuntimeError("não foi possível gerar um nome único")  # improvável: há milhares de combinações


def _calendar(rng: random.Random, used: set[str]) -> dict[str, Any]:
    template = rng.choice(D.CALENDAR_NAME_TEMPLATES)
    name = template.format(nome=make_name(rng, used)) if "{nome}" in template else template
    months = rng.sample(D.MONTH_NAMES, rng.randint(MONTHS_MIN, MONTHS_MAX))
    weekdays = rng.sample(D.WEEKDAY_NAMES, rng.randint(WEEKDAYS_MIN, WEEKDAYS_MAX))
    base_days = rng.randint(24, 36)
    year = rng.randint(YEAR_MIN, YEAR_MAX)
    return {
        "name": name,
        "year": year,
        "era_label": f"Ano {year} {rng.choice(D.YEAR_EPOCHS)}",
        "months": [
            {
                "name": m,
                "days": max(MONTH_DAYS_MIN, min(MONTH_DAYS_MAX, base_days + rng.randint(-4, 4))),
            }
            for m in months
        ],
        "weekdays": list(weekdays),
    }


def _religions(rng: random.Random, used: set[str]) -> list[dict[str, str]]:
    count = rng.randint(RELIGIONS_MIN, RELIGIONS_MAX)
    domains = rng.sample(D.DOMAINS, count)
    out = []
    for domain, phrase in domains:
        deity = make_name(rng, used)
        practice = rng.choice(D.RELIGION_PRACTICES)
        out.append(
            {
                "name": rng.choice(D.RELIGION_NAME_TEMPLATES).format(nome=deity),
                "domain": domain,
                "description": f"Venera {deity}, que rege {phrase}. {practice}",
            }
        )
    return out


def _places(rng: random.Random, used: set[str]) -> list[dict[str, str]]:
    count = rng.randint(PLACES_MIN, PLACES_MAX)
    kinds = rng.sample(D.PLACE_TYPES, count)
    out = []
    for i, (kind, openings) in enumerate(kinds, start=1):
        name = make_name(rng, used)
        details = rng.sample(D.PLACE_DETAILS, 2 if rng.random() < 0.5 else 1)
        description = " ".join([rng.choice(openings).format(nome=name), *details])
        out.append({"id": f"lugar-{i}", "name": name, "type": kind, "description": description})
    return out


def generate_world(seed: int | None = None) -> dict[str, Any]:
    """Gera um Mundo. ``seed`` entre 0 e ``SEED_MAX``; ``None`` sorteia uma."""
    if seed is None:
        seed = new_seed()
    if isinstance(seed, bool) or not isinstance(seed, int) or not 0 <= seed <= SEED_MAX:
        raise ValueError(f"a semente deve ser um inteiro entre 0 e {SEED_MAX}")
    rng = random.Random(seed)
    used: set[str] = set()
    world_name = rng.choice(D.WORLD_NAME_TEMPLATES).format(nome=make_name(rng, used))
    era_name, era_description = rng.choice(D.ERAS)
    tone_name, tone_description = rng.choice(D.TONES)
    content = {
        "schema": SCHEMA_VERSION,
        "name": world_name,
        "era": {"name": era_name, "description": era_description},
        "tone": {"name": tone_name, "description": tone_description},
        "calendar": _calendar(rng, used),
        "religions": _religions(rng, used),
        "places": _places(rng, used),
    }
    return {"seed": seed, "content": content}


__all__ = ["generate_world", "make_name", "new_seed"]
