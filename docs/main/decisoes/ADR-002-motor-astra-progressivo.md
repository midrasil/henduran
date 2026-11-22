# ADR-002 — Implementação progressiva do motor Astra adaptado

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Referência:** P-04 do GDD
- **Origem da decisão:** Aprovação explícita do responsável pelo Henduran

## Contexto

O Henduran é um RPG solo AI-first com uma adaptação própria do sistema Astra. Desenvolver simultaneamente todas as regras, o Narrador IA, as Cenas, a interface pixel art e o combate tático elevaria o risco de integração e retrabalho.

## Decisão

**Implementar o motor de regras de forma progressiva, mantendo como objetivo final o conjunto de regras Astra aplicáveis ao Henduran, com suas adaptações próprias.**

Esta é uma estratégia de **sequenciamento da implementação**, não uma aprovação para simplificar permanentemente as regras.

As decisões anteriores continuam válidas:
- Competências e Capacidades não fazem parte da implementação inicial.
- O Henduran terá uma wiki interna das regras adaptadas, que será sua referência mecânica.
- Conceitos baseados em sessões de mesa, incluindo Ambição e Desejo, serão adaptados à Jornada contínua.
- O motor determinístico, não o texto gerado pelo Narrador IA, determina resultados mecânicos.

## Consequências

- A primeira versão executável pode conter somente um subconjunto das regras previstas para o produto completo.
- Cada subsistema só será considerado implementado após testes e documentação correspondente na wiki interna.
- A ausência temporária de uma regra não autoriza a IA a substituí-la por uma mecânica inventada.
- Integrações e dados devem permitir acrescentar subsistemas posteriormente, evitando dependências circulares entre interface e regras.

## Sequência candidata (não aprovada como divisão definitiva de marcos)

1. Ficha básica, Atributos, Perícias e resolução de testes.
2. Vida, Vontade, inventário, equipamentos básicos e persistência.
3. Cenas táticas, iniciativa, combate, movimento, condições e NPCs selecionados.
4. Progressão e demais mecânicas aplicáveis com adaptações próprias.

## Ainda pendente

- Detalhes da matriz de implementação e critérios de aceite por subsistema.
- P-05: tratamento de NPCs do Astra que possuem Capacidades.
- P-02/P-03: unidade temporal e adaptação de Ambição/Desejo.
- P-08: permissões do Narrador e confirmação de ações com efeitos.
