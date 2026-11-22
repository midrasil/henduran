# Insumos para ADR-068 — Resolução-base, breakpoints/redimensionamento e acessibilidade formal

Slug: `adr-068-resolucao-base`
Branch: `docs/adr-068-resolucao-base`
Tipo: levantamento de fatos e alternativas. **Não é o ADR e não escolhe nenhuma alternativa.** A recomendação da seção 6 é PROPOSTA.

Legenda: **CONFIRMADO** = está no repositório (arquivo e linha citados) ou foi reconferido por contagem no manifesto. **PROPOSTO** = sugestão de documento ou de agente, sem aprovação. **PENDENTE** = não existe no repositório.

Limite da verificação: o diretório `assets/tilesets/ui/franuka/` não existe nesta árvore de trabalho (glob `assets/**` sem resultado), e não há `package.json`, `Cargo.toml` nem código de aplicação (`05-qa.md` linha 40). Portanto nenhuma medida de layout, DPI ou contraste foi feita em execução. Os números abaixo vêm de documentos ou do manifesto JSON.

---

## 1. Fatos que restringem a decisão

### 1.1 Escalas e grade nativa Franuka

- **CONFIRMADO:** pacote v1.8, grade nominal de 16 px em 1x, 32 px em 2x e 48 px em 3x; 1.917 arquivos. (`docs/ui-ux/01-inventario-franuka.md` linha 5.)
- **CONFIRMADO (reconferido no manifesto):** a contagem por escala é 632 arquivos em `1x`, 632 em `2x`, 632 em `3x` e 21 sem escala (raiz, exemplos, fontes). Soma 1.917. (`docs/ui-ux/franuka-manifest.json`, campo `"scale"`, contagens por grep.)
- **CONFIRMADO (reconferido no manifesto):** `BGbox_01A.png` mede 48×48 em 1x (linhas 298–307), 96 de largura em 2x (linha 7870–7873) e 144 de largura em 3x (linha 15442–15445). A proporção 1x/2x/3x é de 16 px nominais por unidade de arte.
- **CONFIRMADO:** as dimensões em 1x não seguem a grade de 16 px para todas as famílias. Exemplos: `BGbox` 48², `Banner` 48×16 ou 48×32, `Divider` 48×16 até 144×48, `Button` 16–96 px de largura e 16–48 px de altura. (`01-inventario-franuka.md` linhas 13–26 e 41.) A grade de 16 px é uma unidade de arte, não um tamanho de componente.
- **CONFIRMADO (decisão já aprovada em documento):** `--pixel-scale` inteiro; variantes 1x/2x/3x escolhidas por densidade ou layout, não por zoom fracionário. (`docs/ui-ux/02-design-system.md` linha 43, marcado como token proposto.)
- **CONFIRMADO:** "Selecionar 1x/2x/3x por escala inteira e tamanho alvo. Não interpolar entre variantes." (`docs/ui-ux/06-guia-implementacao.md` linha 31.) A regra é PROPOSTA no guia.
- **CONFIRMADO:** "Evitar filtros, blur e transform fracionário." (`06-guia-implementacao.md` linha 36.)
- **CONFIRMADO:** `image-rendering: pixelated` aplica-se a raster escalado, não a texto DOM. (`06-guia-implementacao.md` linha 49.)

### 1.2 Grade de layout (8 px) e conflito com a grade de arte (16 px)

- **CONFIRMADO:** "layout em grade de 8 px, com sprites alinhados à grade nativa de 16 px". Marcado como PROPOSTO. (`02-design-system.md` linha 5.)
- **PROPOSTO (aritmética, não medido):** com DPI fracionário do Windows, uma unidade de arte de 1x não vira um número inteiro de pixels físicos.
  - 125%: 16 CSS px viram 20 px físicos (1,25×); a unidade de arte vira 1,25 px.
  - 150%: 16 CSS px viram 24 px físicos (1,5×).
  - 200%: 16 CSS px viram 32 px físicos (2×, inteiro).
  - Conclusão: escala inteira de arte em CSS px só é garantida em 100% e 200%. Em 125% e 150%, a escala inteira precisa ser calculada em pixels físicos, o que o layout web não controla diretamente.
- **PROPOSTO:** o guia já pede testes em 100%, 125%, 150% e 200% do Windows e admite "aceitar layout CSS nítido sem deformar raster" em escalas fracionárias (`06-guia-implementacao.md` linhas 54 e 58). O guia não diz como equilibrar esses dois pontos.

### 1.3 Tamanhos de componentes (dimensões propostas, não normativas)

Todos estes valores são **PROPOSTO** em `02-design-system.md`, exceto onde indicado:

| Componente | Valor | Linha |
|---|---|---|
| Button | altura ≥ 32 CSS px; alvo ≥ 44 px proposto | 13 |
| IconButton | 32–48 px visual | 14 |
| Window | 480–960 px, responsivo | 16 |
| Tooltip | máx. 320 px | 19 |
| TextInput | altura ≥ 36 | 20 |
| Tabs | altura ≥ 32 | 18 |
| ProgressBar | 8–16 sprite px escalada | 23 |
| InventorySlot | 32/48 CSS px em escala inteira | 25 |
| ItemCard | ≥ 240×96 PROPOSTO | 26 |
| CharacterCard | ≥ 280 px, fluido | 27 |
| ChatMessage | linha 45–80 caracteres (proposta) | 29 |
| ChatInput | 1–6 linhas propostas | 30 |

- **CONFIRMADO (conflito interno):** Button tem altura mínima de 32 CSS px na linha 13 e alvo de 44 px na mesma linha. TextInput exige 36 px. A norma de alvo e a de altura não estão alinhadas. (Ver seção 3b.)
- **CONFIRMADO (conflito no inventário):** Resource orbs aparecem com faixa de 48–240 px na linha 20 da categoria, e com 48–80 px na linha 42 da família `Orb_*`. Uma das faixas está errada, ou as duas medem coisas diferentes. Precisa ser reconferido no manifesto antes de usar.

### 1.4 Tipografia

- **CONFIRMADO no inventário:** fontes FantasyRPG em 12, 17 e 20 pt a 72 ppi (`01-inventario-franuka.md` linha 43, sem marcação de status).
- **CONFIRMADO no guia, sem origem rotulada:** "texto em múltiplos de 12 pt, título 17 pt e contorno 20 pt a 72 ppi, com antialiasing desabilitado conforme licença" (`06-guia-implementacao.md` linha 60). A regra de antialiasing depende da licença (`LICENSE` do pacote), que não está acessível nesta árvore. **Falta:** leitura da licença para confirmar.
- **PROPOSTO:** pixel font só para títulos e rótulos curtos; fonte de sistema para chat, editor e configurações (`06-guia` linha 60; `02-design-system` linha 44).
- **PENDENTE:** tamanho de texto base do chat, escala de texto do usuário e teste de português com acentos em 200%. Nenhum número existe nos docs.

### 1.5 Mapa e Pixi

- **CONFIRMADO:** mapas hexagonais e tático em PixiJS; overlays textuais, tooltips, menus e chat ficam no DOM (`06-guia` linha 75).
- **CONFIRMADO:** "Resize do canvas usa `ResizeObserver`, atualiza renderer e preserva câmera; DOM mede o espaço, Pixi não governa o shell." (`06-guia` linha 56.) PROPOSTO.
- **PENDENTE:** dimensão mínima do viewport tático; escala do mapa; tamanho do token-moeda; distância por hex (`docs/main/design/HENDURAN-GDD.md`, seção de mapas, linha 332).

### 1.6 Wireframes assumidos

- **CONFIRMADO:** os wireframes são "diagramas sem proporções normativas" (`docs/ui-ux/04-wireframes.md` linha 3). Nenhuma largura é fixada.
- **CONFIRMADO narrativa:** chat principal, contexto recolhível à direita, compositor no rodapé, barra de abas no topo (`04-wireframes.md` linhas 8–19). Em largura reduzida, o contexto vira drawer e o compositor e o histórico permanecem (linha 22). O limite de largura para o drawer **não está definido**.
- **CONFIRMADO tático:** mapa predominante à esquerda e coluna direita com participantes e chat secundário; detalhe da ação na faixa inferior (`04-wireframes.md` linhas 26–39). O chat pode expandir sem destruir o viewport (linha 41).
- **CONFIRMADO mapa-múndi:** mapa hexagonal regional à esquerda, painel de POI à direita, chat Fora de Cena na faixa inferior (linhas 45–57).
- **CONFIRMADO janelas:** Janela auxiliar com tabs, título e fechar (linhas 80–88). Biblioteca com lista e detalhe (linhas 63–76). Árvore de continuidades com lista alternativa obrigatória (linha 103).
- **PROPOSTO:** painel contextual recolhível e prompt de teste inline (`04-wireframes.md` linha 22; `docs/main/design/HENDURAN-GDD.md` linha 464).

### 1.7 Decisões já aprovadas que delimitam a decisão

- **CONFIRMADO ADR-001:** Tauri (contêiner), React + TypeScript (UI), PixiJS (mapas), Python (IA). Somente Windows. Aceite técnico inicial: aplicativo Tauri inicializando no Windows, UI React com sprites, chat com streaming (`docs/main/decisoes/ADR-001-stack-desktop-windows.md` linhas 14–18 e 37).
- **CONFIRMADO ADR-001, limite:** a aprovação não determina suporte mínimo de hardware (linha 22).
- **CONFIRMADO ADR-017:** convenções de escala, resolução-base e fonte para textos longos estão **em aberto** (`docs/main/decisoes/ADR-017-biblioteca-ui-pixel-art.md` linha 41). Critérios de aceite de implementação incluem "textos longos, foco por teclado, zoom e escalonamento de sprites são verificados" (linha 35).
- **CONFIRMADO ADR-020:** mapa predominante em tática, chat secundário e acessível. Fora do escopo: proporções, posição do chat, requisitos de resolução, responsividade, foco (`docs/main/decisoes/ADR-020-mapa-predominante-chat-secundario.md` linhas 28–30).
- **CONFIRMADO GDD:** "nenhuma decisão obriga React, WebView2, Godot ou MonoGame" (`docs/main/design/HENDURAN-GDD.md` linha 449). WebView2 é citado como motor de renderização possível, não como decisão.

### 1.8 Verificação e ausência de medição

- **CONFIRMADO:** sem browser automatizado nem aplicativo para teste visual responsivo (`docs/esteira/mapeamento-ui-ux/05-qa.md` linha 54).
- **CONFIRMADO:** sem `package.json`, `pyproject.toml` nem `Cargo.toml` (`05-qa.md` linha 40).
- **CONFIRMADO:** a acessibilidade formal e a resolução-base continuam propostas, não aprovadas (`05-qa.md` linha 55).

---

## 2. O que está PENDENTE e quais telas e componentes dependem

| Pendência | Fonte | Dependem dela |
|---|---|---|
| Resolução-base / resolução alvo | GDD linha 464; ADR-017 linha 41; ADR-020 linha 29; guia linha 55 | Todas as telas; `Window`, `Dialog`, `Tooltip`, `ItemCard`; escala de sprites |
| Dimensões mínimas da janela e modo janela | GDD linha 464 | Layout narrativo (drawer), tática (viewport), biblioteca |
| Breakpoints e comportamento em resoluções menores | GDD linha 490; guia linha 55 | Narrativa (drawer do contexto), tática (chat secundário), mapa-múndi |
| Proporção entre painéis | GDD linha 490; ADR-020 linha 29 | Narrativa, tática, mapa-múndi |
| Expansão e recolhimento do chat | GDD linha 490; wireframes linha 41 | Tática (chat secundário), narrativa (contexto recolhível) |
| Foco do teclado e atalhos | GDD linhas 464 e 490; ADR-020 linha 29; 05-fluxos linha 58 | Todos; `DicePrompt`, `ContextMenu`, `Dialog` |
| Requisitos formais de acessibilidade | GDD linha 42 e 474; PRD mapeamento (dúvidas) | Todos os componentes de `02-design-system`, que hoje têm campo "acessibilidade" sem nível |
| Leitores de tela | GDD linha 474 | Chat (live region), mapa tático (lista alternativa), árvore de continuidades |
| Escala de texto do usuário (zoom) | GDD linha 474 (PROPOSTO) | Chat, editor, `ChatMessage`, `TextArea`, `CharacterSheet` |
| Modo de DicePrompt (card inline ou modal) | `02-design-system` linha 31 | Narrativa e fluxos mecânicos |
| Tamanho real do token-moeda, hex e escala do mapa | GDD linha 332; 04-wireframes linha 43 | Tática, mapa-múndi |
| Política de movimento e animações | GDD linha 490; guia linha 32 | Livro/diário, `ProgressBar`, transições de modo |
| Fonte para chat e editor | `06-guia` linha 60 (PROPOSTO) | `ChatMessage`, `TextArea`, editor de diário |

Telas do mapa de telas que dependem dos itens acima: 1 narrativa, 8 tática, mapa-múndi, biblioteca e criação, ficha, inventário, diário, continuidades, DicePrompt. (`docs/ui-ux/03-mapa-de-telas.md`, tabela de telas, linha 18 para a tática.)

---

## 3. Alternativas de resolução-base e política de redimensionamento

Os valores de exemplo (como 1280×720 ou 1920×1080) são ilustrações para comparar a forma da política. Não são recomendados. O repositório não tem alvo definido (GDD linha 464).

### Alternativa A — Resolução lógica fixa, escala inteira e letterbox

- **Descrição:** a UI é desenhada em uma resolução lógica fixa (ex.: 1280×720 CSS px). O conteúdo é escalado por um fator inteiro (×1, ×2…) e o espaço sobrante recebe letterbox.
- **Prós:** arte de pixel perfeita por construção; layout previsível; testes visuais em poucos tamanhos; fácil de documentar.
- **Contras:** em telas com outra proporção sobra espaço; escala inteira pode ser grande demais ou pequena demais (passos discretos); em DPI 125% ou 150% a escala inteira de janela não coincide com escala inteira de pixel físico; o chat ocupa a mesma proporção em qualquer janela, o que conflita com "chat utilizável" em janela pequena; a janela não redimensiona de forma natural.
- **Riscos:** legibilidade de texto DOM se o fator inteiro escalar o texto de forma grande; texto de chat e alvo de toque ficam exagerados ou pequenos; em janela estreita o compositor fica inutilizável se a resolução lógica for pequena.
- **Pixel-perfect:** alto, desde que o fator seja aplicado em pixels físicos; isso exige integração com DPI do Windows. **PROPOSTO.**
- **Legibilidade e acessibilidade:** texto DOM não deveria ser escalado por letterbox; exige escala de texto separada. Zoom de texto (WCAG 1.4.4) fica dificil de cumprir se o layout inteiro escala junto.
- **Impacto nos wireframes:** narrativa e tática seriam desenhadas em um único canvas lógico; drawer e breakpoints deixam de existir, porque o tamanho é fixo.

### Alternativa B — Layout fluido em CSS, painéis em múltiplos de 8 px e sprites em escala discreta

- **Descrição:** layout em CSS fluido com tamanho mínimo de janela definido. Painéis, chat e mapa usam grade de 8 CSS px. Os sprites são escolhidos entre 1x, 2x e 3x por faixa de tamanho alvo e DPI efetivo. Não há escala inteira global. Pixi redimensiona por `ResizeObserver`.
- **Prós:** alinha com o que o guia já prevê (`06-guia` linhas 36, 53–56, 75); chat e compositor se adaptam; a janela pode ser redimensionada; texto DOM fica nítido em qualquer DPI; é o caminho mais comum em app desktop com DOM.
- **Contras:** pixel perfeito só vale nos tamanhos de variante; entre variantes, a relação entre arte e pixel físico varia (ver 1.2); precisa de testes em mais tamanhos; mais regras de breakpoint a documentar.
- **Riscos:** em 125% e 150% pode haver pixels de arte com espessura desigual se um sprite for exibido fora de uma variante inteira; isso tem de ser checado visualmente; breakpoints mal escolhidos podem tornar a tática apertada.
- **Pixel-perfect:** médio. Garante escala inteira só nas variantes e nos DPIs inteiros (100%, 200%).
- **Legibilidade e acessibilidade:** boa para texto, zoom de texto e reflow; alvos e foco dependem de CSS, que é a parte mais controlável.
- **Impacto nos wireframes:** exige definir largura mínima para narrativa e tática; exige decidir o ponto de drawer do contexto e o ponto em que o chat secundário vira painel recolhível.

### Alternativa C — Unidade de escala de UI (um token global `--ui-unit`) e layout em múltiplos dessa unidade

- **Descrição:** uma única unidade de escala de interface (ex.: 1 unidade = 8 CSS px × fator) é usada por todo espaçamento e tamanho. O fator é escolhido por DPI e pelo ajuste do usuário, em passos inteiros. Sprites usam a mesma unidade, e o layout se ajusta por breakpoints discretos (ex.: pequeno, médio, grande).
- **Prós:** um único controle para pixel-scale e para zoom da interface; escala de sprites e espaçamento ficam coerentes; facilita a checagem visual em poucas variantes.
- **Contras:** o zoom global afeta o texto DOM junto com a arte, o que conflita com a recomendação de zoom de texto sem distorcer todo o UI (`GDD` linha 474); mais complexo de implementar; passos discretos podem deixar a interface grande demais em um DPI intermediário.
- **Riscos:** o usuário de visão reduzida precisa de zoom de texto independente da arte; se o token global for o único controle, a acessibilidade fica limitada.
- **Pixel-perfect:** alto, se o fator for inteiro em pixels físicos.
- **Legibilidade e acessibilidade:** risco médio; resolve bem a arte, mas exige controle separado de texto.
- **Impacto nos wireframes:** os wireframes continuam válidos, mas as proporções precisam ser expressas em unidades, não em pixels.

### Alternativa D — Pixel perfeito no dispositivo: layout e arte em pixels físicos, com DPI tratado no runtime

- **Descrição:** o runtime mede o DPI efetivo da janela e calcula o fator de arte em pixels físicos. Pixi renderiza o canvas em resolução física. O layout DOM continua fluido, mas os sprites são expostos em tamanhos múltiplos de pixels físicos sempre que possível. Em fatores fracionários, o sprite é escolhido pela variante mais próxima, sem interpolar.
- **Prós:** aproxima do pixel perfeito em todos os DPIs, inclusive 125% e 150%; coerente com o objetivo de preservar nitidez; mantém texto DOM independente.
- **Contras:** complexidade maior; o DPI muda ao mover a janela entre monitores; mais testes; pode haver sprites com tamanhos físicos não inteiros mesmo assim, porque a arte nativa é de 16 px e não tem variante 1,25×.
- **Riscos:** bugs de redimensionamento ao trocar de monitor; custo de manutenção; a tática precisa recalcular o canvas em cada troca de DPI.
- **Pixel-perfect:** o mais alto possível, mas não garante integridade total, porque a grade de 16 px não tem variantes para todos os fatores de DPI.
- **Legibilidade e acessibilidade:** texto DOM nítido; zoom de texto independente.
- **Impacto nos wireframes:** nenhum direto; o impacto é de implementação. Breakpoints continuam sendo necessários.

---

## 3b. Alternativas de requisitos de acessibilidade

Os itens abaixo são PROPOSTO. Os critérios WCAG citados são referência externa (WCAG 2.2) e não estão nos docs do projeto. Eles precisam de validação antes de virar requisito.

### Pontos de partida já documentados

- **CONFIRMADO:** "navegação por teclado, foco visível, contraste suficiente e mensagens não dependentes apenas de cor" (`HENDURAN-GDD.md` linha 474, PROPOSTO).
- **CONFIRMADO:** requisitos formais de acessibilidade, leitores de tela, dublagem e plataformas alvo estão PENDENTES (GDD linha 474; linha 42 para "acessibilidade mínima").
- **CONFIRMADO:** sprite decorativo com `aria-hidden` quando o DOM já comunica a função (`02-design-system` linha 7).
- **CONFIRMADO:** alternativa por lista ou teclado para informação essencial de canvas (`06-guia` linha 75).
- **CONFIRMADO:** `prefers-reduced-motion` desativa animações ornamentais (`02-design-system` linha 45; `06-guia` linha 32).
- **CONFIRMADO:** foco de alto contraste fora do raster (`02-design-system` linha 45); CSS `outline` de 3 px com offset de 2 px (`06-guia` linhas 43–46, exemplo).
- **CONFIRMADO:** contraste "deve ser medido no DOM" (`01-inventario-franuka.md` linha 62). Paleta do pacote é "não normativa" (linha 60).

### Alternativa AC-1 — Nível alvo WCAG 2.2 AA para toda a interface DOM, com canvas coberto por alternativa textual

- **Descrição:** a interface DOM atende WCAG 2.2 AA. O canvas Pixi (mapas) tem alternativa textual e por teclado para toda informação essencial.
- **Verificável:** sim, em grande parte. Contraste de texto 4,5:1 e de componente não textual 3:1 (SC 1.4.3 e 1.4.11), calculados a partir de cores no DOM; foco visível (2.4.7); reflow e zoom 200% (1.4.4, 1.4.10); alvo mínimo 24×24 CSS px (2.5.8); teclado completo (2.1.1). Teste manual com leitor de tela (NVDA ou Narrator) em fluxos principais.
- **Riscos:** exige mais trabalho em componentes de canvas; alvo de 24 px é menor que o 44 px já proposto; a conformidade formal exige auditoria.

### Alternativa AC-2 — Nível AA apenas para DOM, com alvo de 44 px e reduced motion obrigatório

- **Descrição:** igual a AC-1, com alvo de 44 CSS px como padrão (que já aparece como proposta no design system) e `prefers-reduced-motion` como requisito obrigatório, não ornamental.
- **Verificável:** sim, com as mesmas medições de AC-1, mais medição de tamanho de alvo no DOM.
- **Riscos:** o alvo de 44 px pode forçar os sprites de 16–32 px a serem exibidos maiores e ocupar mais tela; isso conflita com densidade de tática e chat.

### Alternativa AC-3 — Requisitos internos mínimos, sem conformidade formal declarada

- **Descrição:** teclado completo, foco visível, contraste de texto 4,5:1 medido, zoom de texto testado em 200%, mensagens não só por cor. Sem declaração de conformidade WCAG e sem teste com leitor de tela na v1.
- **Verificável:** sim, com checklist e medições.
- **Riscos:** não cobre leitores de tela; não atende o GDD se o público incluir usuários de leitor de tela; a decisão precisa ser registrada como fora de escopo da v1.

### Alternativa AC-4 — AA no DOM mais suporte a leitor de tela como requisito de release

- **Descrição:** AC-2 mais teste manual de leitor de tela (NVDA e Narrator) nos fluxos principais como critério de release.
- **Verificável:** parcialmente; testes manuais de leitor de tela não são automatizáveis no repositório hoje.
- **Riscos:** custo de teste; PixiJS não expõe semântica de canvas por padrão; o suporte depende da lista alternativa ser completa.

### Pontos específicos de contexto Tauri, WebView2 e PixiJS

- **PROPOSTO (a verificar em prova):** o canvas Pixi não produz árvore de acessibilidade própria. Informações do mapa precisam de DOM paralelo (lista, tooltip ou painel), como já prevê o guia (linha 75).
- **PROPOSTO (a verificar em prova):** a exposição de WebView2 a leitores de tela e o comportamento de zoom de texto do sistema Windows dentro do WebView2 precisam ser testados. Não há dado no repositório.
- **PROPOSTO (a verificar em prova):** escala de texto do sistema Windows e ajuste de DPI do Tauri podem não coincidir. A alternativa de zoom interna deve ser testada separadamente.
- **Verificável por medição:** DPI em 100%, 125%, 150% e 200% (`06-guia` linha 54); zoom 200% (`06-guia` linha 60); largura mínima da janela.

---

## 4. Lacunas de contexto e riscos para a decisão

1. Nenhuma medição de layout existe. Todas as dimensões de janela e de breakpoint são propostas. **Falta:** prova de conceito com shell Tauri e as telas 1 e 8 em DPI diferentes.
2. Conflito 1.3: alvo de 32 px vs 44 px no botão; faixa de orbs 48–240 vs 48–80 no inventário. Antes do ADR, reconferir no manifesto.
3. **Falta:** leitura da licença do pacote para confirmar a regra de antialiasing da fonte (`06-guia` linha 60).
4. **Falta:** o diretório de assets não está no checkout. Reexecutar `scripts/ui-ux/inspect-franuka.ps1` (citado em `05-qa.md` linha 13) exige a cópia local do pacote.
5. Nenhum dado de uso do usuário (tamanho de monitor, DPI, uso de leitor de tela) existe nos docs. A decisão de alvo deve partir de hipótese declarada.
6. A grade de 8 px do design system e a grade de 16 px da arte não se alinham em 125% ou 150% (seção 1.2). Precisa ser resolvido pela política escolhida.
7. Acessibilidade formal: GDD linha 42 lista como PENDENTE. Sem nível escolhido, cada componente de `02-design-system` tem um campo "acessibilidade" sem critério de aceite.

---

## 5. Recomendação (PROPOSTA)

Escolher a **Alternativa B** para resolução e redimensionamento, com dois ajustes: (a) variantes de sprite selecionadas pelo DPI efetivo e por faixa de tamanho, nunca por zoom fracionário, como já prevê o guia; (b) controle independente de escala de texto DOM. Justificativa em poucas linhas:

- B é o único caminho que mantém o chat utilizável em janelas pequenas e grandes sem letterbox, respeitando a decisão de chat dominante (ADR-017, GDD linha 449).
- Preserva pixel art onde importa (variantes inteiras, 100% e 200%) e não força DPI fracionário a produzir arte desalinhada.
- Permite zoom de texto sem distorcer a arte, exigência já PROPOSTA no GDD (linha 474).

Para acessibilidade, a recomendação PROPOSTA é **AC-2**: AA no DOM, alvo de 44 CSS px nos controles primários, `prefers-reduced-motion` obrigatório, e alternativa textual para toda informação essencial do canvas. AC-4 fica como evolução, por custo de teste manual. Requer validação antes de virar requisito.

Esta recomendação não substitui o ADR. A decisão final cabe ao responsável pelo projeto, que deve escolher entre as alternativas com base na prova de conceito.

---

## 6. Documentos que precisarão ser atualizados após a decisão

Lista de documentos a revisar. Nenhum deles é alterado nesta tarefa.

1. `docs/main/decisoes/ADR-017-biblioteca-ui-pixel-art.md` — linha 41 ("Em aberto": resolução-base e fonte) passa a referenciar o ADR-068.
2. `docs/main/decisoes/ADR-020-mapa-predominante-chat-secundario.md` — linhas 28–30 (fora do escopo) podem apontar para a decisão de proporção e breakpoints.
3. `docs/main/design/HENDURAN-GDD.md` — seção IX.2 (linha 464), IX.4 (linha 474), IX.5 (linha 490), linha 42 (acessibilidade mínima), tabela de pendências P-13 (linha 743) e P-18 (linha 748), e histórico de versões (linha ~992).
4. `docs/ui-ux/02-design-system.md` — dimensões de Window (linha 16), alvo de Button (linha 13), `--pixel-scale` (linha 43), foco e reduced motion (linha 45), colunas de acessibilidade.
5. `docs/ui-ux/04-wireframes.md` — linha 22 (drawer), linhas 24–41 (tática), linha 3 (ausência de proporções normativas).
6. `docs/ui-ux/06-guia-implementacao.md` — linhas 53–55 (pixel-perfect e resolução PENDENTE), linha 60 (tipografia e zoom), linhas 93–98 (critérios visuais).
7. `docs/ui-ux/03-mapa-de-telas.md` — estados e regiões das telas 1 e 8.
8. `docs/ui-ux/05-fluxos-e-interacoes.md` — linha 58 (foco e Escape).
9. `docs/ui-ux/01-inventario-franuka.md` — linha 20 (faixa de orbs) e linha 42 (`Orb_*`), se a reconferência do manifesto confirmar o conflito.
10. `docs/ui-ux/README.md` — índice, se algum documento novo for criado.
11. `docs/main/04-arquitetura.md` — proposta de stack; a prova de conceito de resolução deve ser registrada aqui se houver.
12. `docs/backlog.md` — linhas 4 e 7 (fechar o item de decisão; abrir o item de validação em Windows).
13. `docs/context/handoff.md` e `docs/context/jornal.md` — registro obrigatório ao fechar a tarefa.

Opção para o usuário, ao final: atualizar o grafo com os documentos alterados (`/graphify . --update`). Consome tokens; só rodar com autorização.

---

## 7. Próximos passos sugeridos (para o orquestrador)

1. ⭐ Reconferir no manifesto a faixa de orbs e o alvo de Button, e registrar os conflitos antes do ADR (rota: Dev econômico ou leitura direta; sem escrita de produto).
2. Montar a prova de conceito mínima de shell Tauri com `Panel` e `ChatInput` em 100%, 125%, 150% e 200% do Windows, para medir a política escolhida (rota: feature média, esteira completa, já prevista no backlog como slice da interface principal).
3. Escrever o ADR-068 com as alternativas, a decisão do responsável e os critérios de aceite (rota: documento de decisão, `Revisor` confere coerência).

---

## 8. Resumo para o caller

- Fatos confirmados: 1.917 arquivos, 632 por escala 1x/2x/3x mais 21 sem escala; grade nominal 16/32/48 px; BGbox_01A em 48/96/144 px.
- Conflitos internos a resolver: alvo de Button (32 vs 44 px) e faixa de orbs (48–240 vs 48–80 px).
- Pendências que bloqueiam: resolução-base, dimensões mínimas, breakpoints, proporções de painel, foco, acessibilidade formal, leitores de tela, zoom de texto.
- Alternativas de resolução: A (lógica fixa + letterbox), B (layout fluido + sprites discretos), C (unidade de escala global), D (pixel perfeito no dispositivo).
- Alternativas de acessibilidade: AC-1 a AC-4, com o que é verificável em cada.
- Recomendação PROPOSTA: B para resolução; AC-2 para acessibilidade. Não é decisão.
