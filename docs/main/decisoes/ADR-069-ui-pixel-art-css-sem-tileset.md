# ADR-069 — UI pixel art em CSS com tokens próprios, sem tileset no MVP

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Substitui:** ADR-017 (na parte que adota o RPG UI Pack da Franuka como base visual)
- **Origem:** Decisão explícita do responsável pelo Henduran

## Contexto

O ADR-017 definiu a UI a partir dos sprites do RPG UI Pack da Franuka. Três fatores levaram a rever essa base: a licença do pacote não permite, sem verificação, publicá-lo no Git nem embarcá-lo no executável; molduras em sprite combinam mal com layout fluido, texto escalável e alvos de interação do ADR-068; e o conteúdo do pacote nunca foi confirmado contra as necessidades do jogo (chat longo, inventário, barras). O responsável ainda possui o pacote, e a decisão não é definitiva.

A direção visual não muda: a UI deve parecer a de um **jogo de RPG em pixel art**, e não um sistema web.

## Decisão

1. **A UI do MVP não usa tileset nem sprites de moldura.** O visual pixel art é produzido em **CSS**, a partir de **tokens próprios**.
2. **Os tokens são a identidade visual.** Definir, antes dos componentes: paleta limitada, espessura de borda em pixels CSS inteiros (2 a 4 px), sombra dura sem blur, raio zero com cantos em degraus (`clip-path` ou `box-shadow`), espaçamento em múltiplos de 8 px (ADR-068) e tipografia.
3. **Os componentes são reutilizáveis e agnósticos à origem da moldura.** Panel, Button, Bar, Slot, Window e demais componentes consomem tokens e *variantes de estilo*. Hoje a variante é CSS. Uma variante futura (9-slice próprio ou Franuka) deve entrar sem alterar as telas.
4. **Texto sempre em DOM**, com escala independente (ADR-068). Fonte pixel apenas em títulos e HUD; texto longo (chat, descrições) usa fonte legível. A escolha das fontes fica para tarefa própria.
5. **Aparência de jogo, não de site.** Sem blur, gradientes suaves, sombras difusas nem cantos arredondados. Estados com feedback discreto e em degraus, respeitando reduced motion (ADR-068).
6. **Os critérios de acessibilidade do ADR-068 continuam valendo integralmente.** Contraste é medido no DOM com as cores efetivas.
7. **O tileset Franuka sai do caminho crítico.** Os arquivos permanecem locais, fora do Git, e servem apenas de referência visual. O catálogo e o inventário em `docs/ui-ux/` ficam como material de consulta, sem efeito normativo.

## O que permanece do ADR-017

Biblioteca de componentes React/TypeScript reutilizáveis, sem duplicação visual entre telas, com exemplos de uso, testes de comportamento, validação visual e verificação de textos longos e foco por teclado. A restrição de não publicar assets comerciais sem licença confirmada continua.

## Relação com o ADR-068

O ADR-068 permanece. Os trechos sobre sprites 1x/2x/3x passam a valer **somente para o mapa e os tokens em PixiJS** e para eventuais variantes futuras de moldura. Na UI em DOM, a escala usa pixels CSS inteiros dos tokens, sem zoom fracionário.

## Consequências

- Vantagens: sem dependência de licença no MVP, redimensionamento natural, iteração rápida, menos pipeline de assets.
- Custos: acabamento menos artesanal que o de um tileset desenhado; a qualidade visual depende do cuidado nos tokens e na tipografia.
- A prova visual inicial passa a ser uma **página de componentes** (panel, botão, barra, slot, janela, chat), e não um catálogo de sprites.

## Em aberto

- Paleta, tokens numéricos e fontes.
- Quando e se adotar molduras 9-slice próprias ou o pacote Franuka como variante.
- Propagação nos documentos que citam o ADR-017 (GDD IX, P-18, D-033; `docs/ui-ux/`; ADR-020).
