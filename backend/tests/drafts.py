"""Rascunhos de personagem válidos para os testes (regras da fatia 1)."""

from __future__ import annotations

import copy
from typing import Any

from henduran.rules import fatia1 as R

# Atributos: um em 4, dois em 3, dois em 2, um em 1.
ATTRIBUTES = {"forca": 2, "agilidade": 4, "vigor": 3, "carisma": 1, "determinacao": 3, "astucia": 2}

# Perícias por perfil, nas contagens exatas.
SKILLS = {
    "generalista": {
        "lutar": 3,
        "atletismo": 2, "perceber": 2, "furtividade": 2, "sobrevivencia": 2, "persuadir": 2, "cavalgar": 2,
        "acrobacia": 1, "atirar": 1, "curar": 1, "navegar": 1, "intimidar": 1, "mentir": 1,
    },
    "equilibrado": {
        "lutar": 3, "perceber": 3,
        "atletismo": 2, "furtividade": 2, "sobrevivencia": 2, "persuadir": 2,
        "acrobacia": 1, "atirar": 1, "curar": 1, "navegar": 1, "intimidar": 1, "mentir": 1,
    },
    "especialista": {
        "lutar": 4,
        "atletismo": 3, "perceber": 3,
        "furtividade": 2, "sobrevivencia": 2,
        "acrobacia": 1, "intimidar": 1,
    },
}


def valid_draft(profile: str = "equilibrado", **overrides: Any) -> dict[str, Any]:
    draft: dict[str, Any] = {
        "name": "Ilsa Corvalho",
        "concept": "Mercenária endividada que busca redenção",
        "appearance": "Alta, cabelo raspado, cicatriz no queixo.",
        "history": "Cresceu numa vila de pescadores.\nPartiu cedo para a guerra.",
        "ambition": "Vingar o irmão morto na Ponte Velha",
        "desire": "Concluir o contrato de escolta atual",
        "convictions": [
            {"text": "Nunca abandonar quem luta ao meu lado", "pillar": "Bram, meu antigo sargento"},
            {"text": "Pagar todas as minhas dívidas", "pillar": "O anel da minha mãe"},
            {"text": "Proteger os mais fracos", "pillar": "A vila onde nasci"},
        ],
        "attributes": dict(ATTRIBUTES),
        "skill_profile": profile,
        "skills": dict(SKILLS[profile]),
    }
    draft.update(copy.deepcopy(overrides))
    return draft


assert set(ATTRIBUTES) == set(R.ATTRIBUTE_IDS)
