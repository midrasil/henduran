# ADR-019 — Escala regional dos hexágonos do mapa-múndi

- **Estado:** Aprovada (escala conceitual; medidas pendentes)
- **Data:** 2026-11-22
- **Questão do GDD:** P-12
- **Origem:** Escolha explícita da opção B pelo responsável pelo Henduran

## Contexto

O Henduran é centrado no chat e usa um mapa-múndi hexagonal para exploração Fora de Cena. Um mapa excessivamente fragmentado exigiria muitos movimentos; já uma escala regional permite associar vários lugares a uma mesma área e contar viagens de maneira mais legível.

## Decisão aprovada

**Os hexágonos do mapa-múndi representarão áreas geográficas regionais e poderão conter múltiplos pontos de interesse internos**, como assentamentos, ruínas, estradas ou locais de interesse.

A **medida exata de cada hexágono permanece pendente**. Não foram aprovadas distâncias, velocidades, custos por terreno ou densidade de pontos de interesse.

## Consequências

1. O hexágono é uma unidade espacial regional, não um único local nem uma Cena.
2. Um mesmo hexágono pode conter diferentes locais persistentes, com identidades e coordenadas/associações próprias a especificar.
3. O mapa-múndi é independente dos mapas localizados, exclusivos de situações táticas (ADR-005).
4. A geração híbrida do mundo (ADR-018) deve preservar os pontos descobertos, seu vínculo regional e alterações oficiais após revisitas.
5. A navegação e a descoberta de pontos de interesse ainda exigem especificação própria; esta decisão não fixa regras de encontro ou de viagens.

## Critérios de aceite futuros (propostos)

- O sistema pode associar mais de um ponto de interesse à mesma região hexagonal.
- Dois pontos de interesse na mesma região permanecem distintos após salvar e reabrir.
- Viajar a uma região não obriga gerar um mapa localizado em uma Cena narrativa.
- Gerar detalhes novos não substitui pontos de interesse já canonizados.

## Em aberto

- Distância exata representada por cada hexágono.
- Movimento manual/automático, custo de terreno, tempo e velocidade de viagem.
- Visibilidade, neblina de exploração e descoberta de pontos de interesse.
- Quantidade e distribuição dos locais em cada região.
- Orientação da grade, limites do mapa e algoritmo de geração.

## Relações

ADR-005 (mapas localizados somente táticos), ADR-007 (persistência), ADR-018 (mundo híbrido).
