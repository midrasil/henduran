# ADR-068 — Política de resolução, redimensionamento e acessibilidade da UI

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Questão:** pendências de resolução-base, redimensionamento e acessibilidade formal declaradas nas ADR-017 e ADR-020; complementa as questões P-13 e P-18 do GDD, que ficaram resolvidas com essas ressalvas
- **Origem:** Escolha explícita do responsável pelo Henduran, entre as alternativas B (resolução) e AC-2 (acessibilidade) apresentadas no levantamento técnico `docs/esteira/adr-068-resolucao-base/02-plano-tecnico.md`

## Contexto

O Henduran é um aplicativo desktop Windows (ADR-001) centrado em chat, com interface pixel art do pacote Franuka (ADR-017) e mapa predominante apenas em situações táticas (ADR-020). O pacote traz as variantes 1x, 2x e 3x (grade nominal de 16, 32 e 48 px). O design system propõe layout em grade de 8 px e `--pixel-scale` inteiro. Em DPI fracionário do Windows (125% e 150%), a unidade de arte de 16 px não vira escala inteira em pixels físicos; só em 100% e 200% isso é garantido (aritmética proposta, não medida). Nenhuma medição de layout existe, pois ainda não há aplicativo.

O GDD (seção de processo, linhas 642–644) encerrou a rodada sequencial de perguntas críticas. Este ADR é uma exceção pontual: trata de pendências de UI/UX que o mapeamento de interface tornou explícitas e que bloqueiam a implementação das telas.

## Decisão aprovada

### Resolução e redimensionamento: layout fluido com variantes discretas de sprite

1. **Não haverá resolução lógica fixa nem letterbox.** A janela pode ser redimensionada; o layout é fluido em CSS, com painéis e espaçamentos em múltiplos de 8 CSS px.
2. **Os sprites usam variantes inteiras 1x, 2x ou 3x**, escolhidas pelo DPI efetivo e pela faixa de tamanho-alvo, **nunca por zoom fracionário e sem interpolar entre variantes**. Evitar filtros, blur e transform fracionário sobre raster.
3. **O texto DOM não é escalado junto com a arte.** Haverá um controle independente de escala de texto do usuário, separado da escala dos sprites.
4. O DOM governa o shell e mede o espaço; o canvas PixiJS é redimensionado por observação do contêiner e preserva a câmera.
5. Pixel perfeito é garantido apenas nas variantes inteiras e nos DPIs inteiros (100% e 200%). Em 125% e 150% o objetivo é nitidez sem deformar o raster, verificada visualmente.

### Acessibilidade: nível AA no DOM com alvo de 44 px

1. A interface **DOM** deve atender **WCAG 2.2 nível AA**: contraste de texto 4,5:1 e de componentes não textuais 3:1, foco visível, teclado completo, texto ampliável a 200% sem perda de conteúdo (SC 1.4.4), reflow sem rolagem bidirecional em 320 CSS px de largura (SC 1.4.10, com a exceção prevista para conteúdo 2D como mapas) e mensagens que não dependam apenas de cor.
2. **Alvo de interação ≥ 44 CSS px para controles primários** (requisito interno, acima do mínimo AA); **demais alvos ≥ 24 CSS px**, conforme o AA (SC 2.5.8). Este ADR não define a altura visual dos controles nem quais são os "controles primários" (ver Pendências).
3. **`prefers-reduced-motion` é obrigatório**, não ornamental: animações são reduzidas ou removidas quando o usuário pedir.
4. **Toda informação essencial do canvas** (mapas, tokens, árvore de continuidades quando renderizada em canvas) deve ter equivalente em DOM navegável por teclado (lista, painel ou tooltip). O canvas PixiJS em si fica fora da conformidade formal.
5. Contraste é medido no DOM, com as cores efetivamente usadas; a paleta do pacote Franuka não é normativa.

## Alternativas consideradas

- **Resolução:** (A) resolução lógica fixa com escala inteira e letterbox: pixel perfeito por construção, porém prejudica chat e zoom de texto e não coincide com DPI fracionário; (C) unidade de escala global única: arte e espaçamento coerentes, porém o zoom afeta o texto junto com a arte; (D) pixel perfeito no dispositivo, medindo DPI em runtime: maior fidelidade, porém maior complexidade e manutenção (troca de monitor) e, ainda assim, sem variante para todos os DPIs.
- **Acessibilidade:** (AC-1) WCAG 2.2 AA com alvo mínimo de 24 px, reduced motion não obrigatório e teste manual com leitor de tela: exige a mesma alternativa em DOM para o canvas, mas com requisito de release mais custoso; (AC-3) requisitos internos sem declarar conformidade: mais leve e menos verificável; (AC-4) AC-2 mais teste manual com leitor de tela como critério de release: fica como evolução possível pelo custo de teste manual. A AC-2 adotada **não** inclui esse teste manual.

Nenhuma foi declarada inviável para sempre; esta decisão é a referência até nova decisão formal.

## Consequências

- Positivas: chat utilizável em janelas pequenas e grandes; texto nítido em qualquer DPI; zoom de texto sem distorcer a arte; critérios de acessibilidade verificáveis por medição.
- Custos: mais tamanhos a testar; regras de breakpoint a documentar; alvo de 44 px pode exigir sprites exibidos maiores e disputar espaço com a densidade da tática e do chat.
- O critério de aceite de implementação da ADR-017 ("textos longos, foco por teclado, zoom e escalonamento de sprites são verificados") passa a ser medido contra esta decisão.
- O alvo de interação de 44 px para controles primários vem direto do AC-2. O design system trata 32 px como altura visual e 44 px como área de interação do Button; esta decisão não altera a altura visual, e IconButton, Tabs e InventorySlot seguem o mínimo de 24 px até definição específica.

## Pendências

- **Conciliar janela mínima e breakpoints com o SC 1.4.10** (reflow em 320 CSS px), sem fixar valor neste ADR.
- Definir o que são "controles primários" e a altura visual dos controles (Button, IconButton, Tabs, InventorySlot).
- **Valores numéricos não definidos por esta decisão:** tamanho mínimo da janela, pontos de breakpoint (por exemplo, quando o contexto vira drawer e quando o chat secundário da tática vira painel recolhível), proporção entre painéis, tamanho de texto base do chat e dimensão mínima do viewport tático. Devem ser medidos em prova de conceito com shell Tauri nas telas narrativa e tática, em 100%, 125%, 150% e 200% de DPI do Windows.
- Comportamento real do WebView2 com leitores de tela e com a escala de texto do Windows; teste manual com leitor de tela fica fora do requisito inicial (alternativa AC-4 como evolução).
- Conflito de faixa de dimensão das orbs de recurso (48–240 px contra 48–80 px) no inventário do pacote: reconferir no manifesto.
- Leitura da licença do pacote para confirmar a regra de antialiasing da fonte.
- Modo do DicePrompt (card inline ou modal), política detalhada de atalhos e foco, e fonte de chat e editor continuam em aberto.
- Atualizar após esta decisão: ADR-017 e ADR-020 (referência cruzada); GDD (IX.2, IX.4, IX.5, linha 42, P-13, P-18, contagem de ADRs na linha 644 e histórico de versões); `docs/ui-ux/` 01 (orbs, se o conflito se confirmar), 02, 03, 04, 05, 06 e README; `docs/main/04-arquitetura.md`.

## Relações

- Complementa: ADR-017 (biblioteca de UI pixel art) e ADR-020 (mapa predominante e chat secundário), cujas pendências de resolução, proporções e foco ficam parcialmente resolvidas aqui.
- Respeita: ADR-001 (stack e plataforma). Não define suporte mínimo de hardware.
