/**
 * Dados de jogo para os testes, gerados a partir do serviço real
 * (`creation_catalog()`, `limits()`, `generate_world(476)` e o rascunho válido
 * de `backend/tests/drafts.py`). Só para testes: a interface lê tudo do servidor.
 */
import type { CharacterDraft, CreationRules, WorldContent, WorldSchema } from "../api/journeys";

export const RULES: CreationRules = {
  "rules_version": "fatia-1",
  "categories": [
    {
      "id": "fisico",
      "name": "Físico"
    },
    {
      "id": "espiritual",
      "name": "Espiritual"
    }
  ],
  "attributes": [
    {
      "id": "forca",
      "name": "Força",
      "category": "fisico",
      "description": "potência física",
      "skills": [
        "arremessar",
        "atletismo"
      ]
    },
    {
      "id": "agilidade",
      "name": "Agilidade",
      "category": "fisico",
      "description": "coordenação, reflexos, precisão",
      "skills": [
        "acrobacia",
        "atirar",
        "cavalgar",
        "furtividade",
        "lutar",
        "prestidigitacao"
      ]
    },
    {
      "id": "vigor",
      "name": "Vigor",
      "category": "fisico",
      "description": "resistência e robustez",
      "skills": []
    },
    {
      "id": "carisma",
      "name": "Carisma",
      "category": "espiritual",
      "description": "presença e influência",
      "skills": [
        "empatia_animal",
        "intimidar",
        "mentir",
        "performance",
        "persuadir"
      ]
    },
    {
      "id": "determinacao",
      "name": "Determinação",
      "category": "espiritual",
      "description": "foco e estabilidade mental",
      "skills": []
    },
    {
      "id": "astucia",
      "name": "Astúcia",
      "category": "espiritual",
      "description": "conhecimento, raciocínio, percepção",
      "skills": [
        "conhecimento_geral",
        "consertar",
        "curar",
        "erudicao",
        "navegar",
        "ocultismo",
        "perceber",
        "pesquisar",
        "sobrevivencia"
      ]
    }
  ],
  "skills": [
    {
      "id": "acrobacia",
      "name": "Acrobacia",
      "attribute": "agilidade",
      "description": "esquivar, equilibrar-se, amortecer quedas"
    },
    {
      "id": "arremessar",
      "name": "Arremessar",
      "attribute": "forca",
      "description": "lançar armas e objetos com o corpo"
    },
    {
      "id": "atirar",
      "name": "Atirar",
      "attribute": "agilidade",
      "description": "disparar arcos, bestas e similares"
    },
    {
      "id": "atletismo",
      "name": "Atletismo",
      "attribute": "forca",
      "description": "correr, saltar, escalar, nadar"
    },
    {
      "id": "cavalgar",
      "name": "Cavalgar",
      "attribute": "agilidade",
      "description": "montar e conduzir animais montados"
    },
    {
      "id": "conhecimento_geral",
      "name": "Conhecimento Geral",
      "attribute": "astucia",
      "description": "saber comum do mundo e da cultura"
    },
    {
      "id": "consertar",
      "name": "Consertar",
      "attribute": "astucia",
      "description": "reparar, montar e desmontar mecanismos e estruturas"
    },
    {
      "id": "curar",
      "name": "Curar",
      "attribute": "astucia",
      "description": "tratar ferimentos, doenças e condições físicas"
    },
    {
      "id": "empatia_animal",
      "name": "Empatia Animal",
      "attribute": "carisma",
      "description": "acalmar, adestrar e criar laços com animais"
    },
    {
      "id": "erudicao",
      "name": "Erudição",
      "attribute": "astucia",
      "description": "história, ciências, cultura letrada"
    },
    {
      "id": "furtividade",
      "name": "Furtividade",
      "attribute": "agilidade",
      "description": "mover-se sem ser notado e agir em silêncio"
    },
    {
      "id": "intimidar",
      "name": "Intimidar",
      "attribute": "carisma",
      "description": "coagir por ameaça, pressão ou postura"
    },
    {
      "id": "lutar",
      "name": "Lutar",
      "attribute": "agilidade",
      "description": "combate corpo a corpo, desarmado ou armado"
    },
    {
      "id": "mentir",
      "name": "Mentir",
      "attribute": "carisma",
      "description": "enganar, blefar e sustentar falsidades"
    },
    {
      "id": "navegar",
      "name": "Navegar",
      "attribute": "astucia",
      "description": "orientar-se e traçar rotas"
    },
    {
      "id": "ocultismo",
      "name": "Ocultismo",
      "attribute": "astucia",
      "description": "conhecimento sobrenatural, rituais e mistérios"
    },
    {
      "id": "perceber",
      "name": "Perceber",
      "attribute": "astucia",
      "description": "notar detalhes e presenças; ler pessoas"
    },
    {
      "id": "performance",
      "name": "Performance",
      "attribute": "carisma",
      "description": "entreter, atuar, cantar, dançar"
    },
    {
      "id": "persuadir",
      "name": "Persuadir",
      "attribute": "carisma",
      "description": "convencer por argumento, apelo ou lábia"
    },
    {
      "id": "pesquisar",
      "name": "Pesquisar",
      "attribute": "astucia",
      "description": "investigar, buscar informações, analisar pistas"
    },
    {
      "id": "prestidigitacao",
      "name": "Prestidigitação",
      "attribute": "agilidade",
      "description": "furtar, esconder objetos, truques de mão"
    },
    {
      "id": "sobrevivencia",
      "name": "Sobrevivência",
      "attribute": "astucia",
      "description": "caçar, rastrear, abrigar-se e achar recursos"
    }
  ],
  "attribute_distribution": [
    4,
    3,
    3,
    2,
    2,
    1
  ],
  "skill_profiles": [
    {
      "id": "generalista",
      "name": "Generalista",
      "distribution": [
        {
          "value": 3,
          "count": 1
        },
        {
          "value": 2,
          "count": 6
        },
        {
          "value": 1,
          "count": 6
        }
      ],
      "total_skills": 13
    },
    {
      "id": "equilibrado",
      "name": "Equilibrado",
      "distribution": [
        {
          "value": 3,
          "count": 2
        },
        {
          "value": 2,
          "count": 4
        },
        {
          "value": 1,
          "count": 6
        }
      ],
      "total_skills": 12
    },
    {
      "id": "especialista",
      "name": "Especialista",
      "distribution": [
        {
          "value": 4,
          "count": 1
        },
        {
          "value": 3,
          "count": 2
        },
        {
          "value": 2,
          "count": 2
        },
        {
          "value": 1,
          "count": 2
        }
      ],
      "total_skills": 7
    }
  ],
  "creation_max": 4,
  "ranges": {
    "attribute": {
      "min": 1,
      "max": 5
    },
    "skill": {
      "min": 0,
      "max": 5
    }
  },
  "derived": [
    {
      "id": "vida",
      "name": "Vida",
      "base": 3,
      "attribute": "vigor",
      "formula": "3 + Vigor"
    },
    {
      "id": "vontade",
      "name": "Vontade",
      "base": 3,
      "attribute": "determinacao",
      "formula": "3 + Determinação"
    }
  ],
  "convictions": {
    "count": 3
  },
  "text_limits": {
    "name": 200,
    "concept": 300,
    "ambition": 300,
    "desire": 300,
    "conviction_text": 300,
    "conviction_pillar": 300,
    "appearance": 4000,
    "history": 4000,
    "age": 100,
    "height": 100,
    "origin": 200,
    "personality": 1000
  },
  "fields": [
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
    "personality"
  ]
};

export const WORLD_SCHEMA: WorldSchema = {
  "schema": 1,
  "content_max_bytes": 262144,
  "seed_max": 9007199254740991,
  "name_max": 100,
  "description_max": 1000,
  "short_name_max": 40,
  "domain_max": 60,
  "year": {
    "min": 1,
    "max": 100000
  },
  "months": {
    "min": 8,
    "max": 14
  },
  "month_days": {
    "min": 20,
    "max": 40
  },
  "weekdays": {
    "min": 5,
    "max": 8
  },
  "religions": {
    "min": 1,
    "max": 3
  },
  "places": {
    "min": 3,
    "max": 5
  },
  "place_id_pattern": "^[a-z0-9][a-z0-9-]{0,39}$"
};

export const WORLD_SEED = 476;

export const WORLD: WorldContent = {
  "schema": 1,
  "name": "Planícies de Rosilha",
  "era": {
    "name": "Era dos Exilados",
    "description": "Um império caído espalhou seus nobres e sábios pelas terras vizinhas, em busca de abrigo."
  },
  "tone": {
    "name": "Decadência",
    "description": "Um passado glorioso se desfaz aos poucos, entre ruínas, dívidas e memórias."
  },
  "calendar": {
    "name": "Cômputo de Perova",
    "year": 1065,
    "era_label": "Ano 1065 da Coroa",
    "months": [
      {
        "name": "Geadar",
        "days": 32
      },
      {
        "name": "Alvorim",
        "days": 24
      },
      {
        "name": "Florel",
        "days": 26
      },
      {
        "name": "Fornalha",
        "days": 31
      },
      {
        "name": "Nevário",
        "days": 24
      },
      {
        "name": "Ventânio",
        "days": 29
      },
      {
        "name": "Trevoso",
        "days": 29
      },
      {
        "name": "Brotário",
        "days": 29
      },
      {
        "name": "Colheral",
        "days": 24
      },
      {
        "name": "Degelo",
        "days": 26
      },
      {
        "name": "Semeador",
        "days": 29
      },
      {
        "name": "Estiado",
        "days": 30
      },
      {
        "name": "Vindimar",
        "days": 25
      },
      {
        "name": "Orvalim",
        "days": 29
      }
    ],
    "weekdays": [
      "Brasal",
      "Lavradia",
      "Sereno",
      "Cintila",
      "Fecho",
      "Estrelim",
      "Terrâneo",
      "Solário"
    ]
  },
  "religions": [
    {
      "name": "Ordem de Araria",
      "domain": "Inverno",
      "description": "Venera Araria, que rege o frio, a resistência e a espera pela primavera. Os fiéis fazem peregrinação a um santuário distante ao menos uma vez na vida."
    },
    {
      "name": "Círculo de Galilha",
      "domain": "Colheita",
      "description": "Venera Galilha, que rege as colheitas e os celeiros. Seus fiéis acendem lamparinas a cada lua nova."
    }
  ],
  "places": [
    {
      "id": "lugar-1",
      "name": "Norilunde",
      "type": "estalagem",
      "description": "Norilunde é uma estalagem de pedra à beira da estrada, famosa pela cerveja e pelas brigas. Há pouco tempo, um crime sem solução abalou a região."
    },
    {
      "id": "lugar-2",
      "name": "Vinarunde",
      "type": "cidade",
      "description": "Vinarunde é uma cidade murada, com mercados barulhentos e ruas estreitas. O lugar vive de uma feira que atrai gente de longe."
    },
    {
      "id": "lugar-3",
      "name": "Rosedor",
      "type": "montanha",
      "description": "Rosedor é uma montanha solitária, cercada de histórias e de desfiladeiros. A colheita deste ano foi fraca, e o povo anda inquieto."
    }
  ]
};

export const VALID_DRAFT: CharacterDraft = {
  "name": "Ilsa Corvalho",
  "concept": "Mercenária endividada que busca redenção",
  "appearance": "Alta, cabelo raspado, cicatriz no queixo.",
  "history": "Cresceu numa vila de pescadores.\nPartiu cedo para a guerra.",
  "ambition": "Vingar o irmão morto na Ponte Velha",
  "desire": "Concluir o contrato de escolta atual",
  "convictions": [
    {
      "text": "Nunca abandonar quem luta ao meu lado",
      "pillar": "Bram, meu antigo sargento"
    },
    {
      "text": "Pagar todas as minhas dívidas",
      "pillar": "O anel da minha mãe"
    },
    {
      "text": "Proteger os mais fracos",
      "pillar": "A vila onde nasci"
    }
  ],
  "attributes": {
    "forca": 2,
    "agilidade": 4,
    "vigor": 3,
    "carisma": 1,
    "determinacao": 3,
    "astucia": 2
  },
  "skill_profile": "equilibrado",
  "skills": {
    "lutar": 3,
    "perceber": 3,
    "atletismo": 2,
    "furtividade": 2,
    "sobrevivencia": 2,
    "persuadir": 2,
    "acrobacia": 1,
    "atirar": 1,
    "curar": 1,
    "navegar": 1,
    "intimidar": 1,
    "mentir": 1
  }
};
