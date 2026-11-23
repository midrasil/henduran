"""Dados e constantes das regras da fatia 1 (versão ``fatia-1``), conforme a wiki ``rules/``.

Fonte: ``rules/02-atributos.md``, ``rules/03-pericias.md``, ``rules/04-vida.md``,
``rules/05-vontade.md``, ``rules/06-conviccoes-e-pilares.md``,
``rules/07-ambicao-e-desejo.md`` e ``rules/09-criacao-de-personagem.md``.

Os ids são *slugs* sem acento (estáveis, gravados nos bancos); os nomes de
exibição ficam em português. **Fora desta fatia**: Competências, Capacidades,
equipamento, XP e Conhecimento Específico (não existem aqui).

Os limites de tamanho dos textos (``TEXT_LIMITS``) não vêm das regras: são uma
defesa do serviço, aprovada no plano da tarefa.
"""

from __future__ import annotations

from dataclasses import dataclass
from types import MappingProxyType

RULES_VERSION = "fatia-1"


@dataclass(frozen=True)
class Category:
    id: str
    name: str


@dataclass(frozen=True)
class Attribute:
    id: str
    name: str
    category: str  # id da categoria
    description: str


@dataclass(frozen=True)
class Skill:
    id: str
    name: str
    attribute: str  # id do Atributo ligado
    description: str


@dataclass(frozen=True)
class SkillProfile:
    id: str
    name: str
    # (valor, quantidade de Perícias com esse valor), do maior valor ao menor.
    distribution: tuple[tuple[int, int], ...]

    @property
    def counts(self) -> dict[int, int]:
        return dict(self.distribution)

    @property
    def total_skills(self) -> int:
        return sum(count for _, count in self.distribution)


@dataclass(frozen=True)
class Derived:
    id: str
    name: str
    base: int
    attribute: str  # id do Atributo somado à base

    @property
    def formula(self) -> str:
        return f"{self.base} + {ATTRIBUTES_BY_ID[self.attribute].name}"


# --------------------------------------------------------------- Atributos (02)
CATEGORIES: tuple[Category, ...] = (
    Category("fisico", "Físico"),
    Category("espiritual", "Espiritual"),
)

ATTRIBUTES: tuple[Attribute, ...] = (
    Attribute("forca", "Força", "fisico", "potência física"),
    Attribute("agilidade", "Agilidade", "fisico", "coordenação, reflexos, precisão"),
    Attribute("vigor", "Vigor", "fisico", "resistência e robustez"),
    Attribute("carisma", "Carisma", "espiritual", "presença e influência"),
    Attribute("determinacao", "Determinação", "espiritual", "foco e estabilidade mental"),
    Attribute("astucia", "Astúcia", "espiritual", "conhecimento, raciocínio, percepção"),
)
ATTRIBUTES_BY_ID = MappingProxyType({a.id: a for a in ATTRIBUTES})
ATTRIBUTE_IDS: tuple[str, ...] = tuple(a.id for a in ATTRIBUTES)

# Escala dos Atributos de personagens (02): 1 a 5.
ATTRIBUTE_MIN = 1
ATTRIBUTE_MAX = 5

# --------------------------------------------------------------- Perícias (03)
SKILLS: tuple[Skill, ...] = (
    Skill("acrobacia", "Acrobacia", "agilidade", "esquivar, equilibrar-se, amortecer quedas"),
    Skill("arremessar", "Arremessar", "forca", "lançar armas e objetos com o corpo"),
    Skill("atirar", "Atirar", "agilidade", "disparar arcos, bestas e similares"),
    Skill("atletismo", "Atletismo", "forca", "correr, saltar, escalar, nadar"),
    Skill("cavalgar", "Cavalgar", "agilidade", "montar e conduzir animais montados"),
    Skill("conhecimento_geral", "Conhecimento Geral", "astucia", "saber comum do mundo e da cultura"),
    Skill("consertar", "Consertar", "astucia", "reparar, montar e desmontar mecanismos e estruturas"),
    Skill("curar", "Curar", "astucia", "tratar ferimentos, doenças e condições físicas"),
    Skill("empatia_animal", "Empatia Animal", "carisma", "acalmar, adestrar e criar laços com animais"),
    Skill("erudicao", "Erudição", "astucia", "história, ciências, cultura letrada"),
    Skill("furtividade", "Furtividade", "agilidade", "mover-se sem ser notado e agir em silêncio"),
    Skill("intimidar", "Intimidar", "carisma", "coagir por ameaça, pressão ou postura"),
    Skill("lutar", "Lutar", "agilidade", "combate corpo a corpo, desarmado ou armado"),
    Skill("mentir", "Mentir", "carisma", "enganar, blefar e sustentar falsidades"),
    Skill("navegar", "Navegar", "astucia", "orientar-se e traçar rotas"),
    Skill("ocultismo", "Ocultismo", "astucia", "conhecimento sobrenatural, rituais e mistérios"),
    Skill("perceber", "Perceber", "astucia", "notar detalhes e presenças; ler pessoas"),
    Skill("performance", "Performance", "carisma", "entreter, atuar, cantar, dançar"),
    Skill("persuadir", "Persuadir", "carisma", "convencer por argumento, apelo ou lábia"),
    Skill("pesquisar", "Pesquisar", "astucia", "investigar, buscar informações, analisar pistas"),
    Skill("prestidigitacao", "Prestidigitação", "agilidade", "furtar, esconder objetos, truques de mão"),
    Skill("sobrevivencia", "Sobrevivência", "astucia", "caçar, rastrear, abrigar-se e achar recursos"),
)
SKILLS_BY_ID = MappingProxyType({s.id: s for s in SKILLS})
SKILL_IDS: tuple[str, ...] = tuple(s.id for s in SKILLS)

# Escala das Perícias (03): 0 a 5.
SKILL_MIN = 0
SKILL_MAX = 5

# --------------------------------------------------------------- Criação (09)
# Atributos: um em 4, dois em 3, dois em 2 e um em 1.
ATTRIBUTE_DISTRIBUTION: tuple[int, ...] = (4, 3, 3, 2, 2, 1)

SKILL_PROFILES: tuple[SkillProfile, ...] = (
    SkillProfile("generalista", "Generalista", ((3, 1), (2, 6), (1, 6))),
    SkillProfile("equilibrado", "Equilibrado", ((3, 2), (2, 4), (1, 6))),
    SkillProfile("especialista", "Especialista", ((4, 1), (3, 2), (2, 2), (1, 2))),
)
SKILL_PROFILES_BY_ID = MappingProxyType({p.id: p for p in SKILL_PROFILES})

# Teto na criação: nenhum Atributo ou Perícia passa de 4 (o 5 só vem com XP, fatia 2).
CREATION_MAX = 4

CONVICTION_COUNT = 3

# --------------------------------------------------------------- Derivadas (04, 05, 09)
DERIVED: tuple[Derived, ...] = (
    Derived("vida", "Vida", 3, "vigor"),
    Derived("vontade", "Vontade", 3, "determinacao"),
)

# --------------------------------------------------------------- Limites dos textos
# Defesa do serviço (não são regras): curtos até 200; Conceito, Ambição, Desejo,
# Convicção e Pilar até 300; aparência e história até 4000 caracteres.
TEXT_LIMITS = MappingProxyType(
    {
        "name": 200,
        "concept": 300,
        "ambition": 300,
        "desire": 300,
        "conviction_text": 300,
        "conviction_pillar": 300,
        "appearance": 4000,
        "history": 4000,
        # Descrição opcional, sem efeito de regra (ADR-076; tela da Jornada, item 2.6).
        "age": 100,
        "height": 100,
        "origin": 200,
        "personality": 1000,
    }
)

__all__ = [
    "ATTRIBUTES",
    "ATTRIBUTES_BY_ID",
    "ATTRIBUTE_DISTRIBUTION",
    "ATTRIBUTE_IDS",
    "ATTRIBUTE_MAX",
    "ATTRIBUTE_MIN",
    "CATEGORIES",
    "CONVICTION_COUNT",
    "CREATION_MAX",
    "DERIVED",
    "RULES_VERSION",
    "SKILLS",
    "SKILLS_BY_ID",
    "SKILL_IDS",
    "SKILL_MAX",
    "SKILL_MIN",
    "SKILL_PROFILES",
    "SKILL_PROFILES_BY_ID",
    "TEXT_LIMITS",
    "Attribute",
    "Category",
    "Derived",
    "Skill",
    "SkillProfile",
]
