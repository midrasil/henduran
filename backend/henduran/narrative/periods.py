"""Períodos do dia (ADR-073 e ADR-076, item 9). O período é do motor, não do Narrador.

Os ids são os mesmos da interface (``app/src/ui/SkyBackdrop/sky.ts``). A lista
ainda será confirmada no ADR de passagem do tempo; o tempo é contado em
períodos, não em horas.
"""

from __future__ import annotations

import random

DAY_PERIODS = ("madrugada", "amanhecer", "manha", "tarde", "entardecer", "noite")

PERIOD_LABELS = {
    "madrugada": "Madrugada",
    "amanhecer": "Amanhecer",
    "manha": "Manhã",
    "tarde": "Tarde",
    "entardecer": "Entardecer",
    "noite": "Noite",
}


def draw_day_period(rng: random.Random | None = None) -> str:
    """Sorteia o período inicial de uma Jornada, com peso igual entre os períodos."""
    return (rng or random).choice(DAY_PERIODS)


__all__ = ["DAY_PERIODS", "PERIOD_LABELS", "draw_day_period"]
