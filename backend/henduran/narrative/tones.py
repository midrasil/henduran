"""Tons de partida da Cena inicial (ADR-076, item 4; lista aprovada em 2026-11-23).

O motor sorteia um tom, com peso igual, e o entrega ao Narrador, que decide o
resto (situação, motivo, participantes). O tom orienta, mas não impõe combate
nem teste.
"""

from __future__ import annotations

import random
from dataclasses import dataclass


@dataclass(frozen=True)
class Tone:
    id: str
    name: str
    description: str  # texto curto entregue ao Narrador


TONES: tuple[Tone, ...] = (
    Tone("em_movimento", "Em movimento", "o personagem já está a caminho: viagem, fuga, perseguição, travessia ou estrada."),
    Tone("chegada", "Chegada", "o personagem acaba de chegar ao lugar."),
    Tone("encontro", "Encontro", "alguém procura ou aborda o personagem."),
    Tone("rotina_interrompida", "Rotina interrompida", "um dia comum é quebrado por algo inesperado."),
    Tone(
        "em_apuros",
        "Em apuros",
        "o personagem já está numa situação difícil (preso, perdido, devendo ou ferido apenas na narrativa), "
        "sem nenhum dano nas regras.",
    ),
    Tone("consequencia", "Consequência", "a situação nasce de algo do histórico escrito pelo jogador."),
)

TONES_BY_ID = {t.id: t for t in TONES}


def draw_tone(rng: random.Random | None = None) -> Tone:
    """Sorteia um tom de partida, com peso igual entre os tons."""
    return (rng or random).choice(TONES)


__all__ = ["TONES", "TONES_BY_ID", "Tone", "draw_tone"]
