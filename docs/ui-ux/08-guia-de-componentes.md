# 08 — Guia de componentes da UI (pixel art em CSS)

**Data:** 2026-11-23
**Status:** implementado em `app/src/styles/` e `app/src/ui/` (ADR-069, ADR-068). Os valores abaixo são a primeira versão e podem ser ajustados por revisão visual.

> **`02-design-system.md` (baseado no pacote Franuka) não vale mais para os tokens.** Paleta, bordas, espaçamento e fontes são os deste guia e de `app/src/styles/tokens.css`. Aquele documento fica como consulta (contratos de componentes e acessibilidade).

## 1. Tokens (`app/src/styles/tokens.css`)

Duas camadas: primitivos (`--px-*`, a paleta) e semânticos (`--color-*`, que os componentes usam). Os componentes também leem variáveis de contexto (`--fg`, `--fg-muted`, `--fg-danger`, `--focus-ring`, `--input-*`), definidas pela superfície em volta: `.surface-dark` (padrão) ou `.surface-parchment`.

- **Bordas:** `--border-thin` 2 px, `--border-frame` 4 px, `--bevel` 2 px, sombra dura `--shadow-drop` 4 px. **Raio zero.** Sem blur.
- **Espaçamento:** múltiplos de 8 px (`--space-1` a `--space-6`).
- **Texto:** `--text-scale` multiplica todos os `--font-size-*` sem mexer em moldura nem espaçamento (ADR-068).
- **Alvos:** `--target-primary` 44 px (botões e abas), `--target-min` 24 px.
- **Camadas:** `--z-sky`, `--z-base`, `--z-raised`, `--z-sticky`, `--z-overlay`, `--z-dialog`.
- **Movimento:** `--duration-fast`, `--duration-crossfade`; `prefers-reduced-motion` e a classe `.motion-reduced` no `<html>` zeram animações.

### 1.1 Paleta: amostrada e escolhida

Amostragem por script (Pillow, mediana de recortes 7x7 em pontos escolhidos e quantização *median cut* de 16 cores por imagem) sobre os três esboços de `esbocos/`. Valores amostrados principais:

| Elemento do esboço | Amostra |
| --- | --- |
| Fundo geral / barra superior / barra de status | `#170f1a`, `#231b29`, `#221b25` |
| Cartão escuro / título de painel | `#251e27`, `#2e1f2b` |
| Botão desativado | `#432e4a` |
| Botões roxos (Enviar, Avançar, Continuar, passo ativo) | `#5d277f`, `#591b7c`, `#562279`, `#4d1671` |
| Dourado (moldura e títulos, faixas de cor) | `#f8c858`, `#f8d868`, `#e8b878`, `#d89848`, `#a66a18` |
| Pergaminho | `#f5daba`, `#f7debe`, `#eecca6`, `#efcfa9`, `#f1dab3` |
| Céu do menu (roxo, laranja, sol) | `#5e487b`, `#fc995f`, `#fcf3a3` |

Escolhidos (primitivos):

| Papel | Token | Valor |
| --- | --- | --- |
| Fundo | `--px-ink-900` | `#170f1a` |
| Superfície escura | `--px-ink-800` | `#221a26` |
| Superfície elevada / botão secundário | `--px-ink-700` | `#2e2233` |
| Borda escura, desativado | `--px-ink-600` | `#432e4a` |
| Contorno e sombra | `--px-ink-950` | `#0e0911` |
| Roxo primário / hover / ativo | `--px-purple-600/500/800` | `#5a2380` / `#6e3197` / `#45186a` |
| Dourado destaque / claro / moldura / escuro | `--px-gold-400/200/600/700` | `#f0c050` / `#f8d878` / `#a8701c` / `#7a4e12` |
| Pergaminho / claro / fundo | `--px-parchment-200/100/300` | `#f5dbbb` / `#f8e4c8` / `#e8c69c` |
| Texto sobre escuro / atenuado | `--px-ivory-100/400` | `#f4e8d4` / `#c8b8ac` |
| Texto sobre pergaminho / atenuado | `--px-brown-900/700` | `#2a1b14` / `#5c4230` |
| Perigo (fundo / texto no escuro / no pergaminho) | `--px-red-700`, `--px-red-300`, `--px-red-800` | `#8f2121`, `#ff8f80`, `#8a1c12` |
| Sucesso, atenção | `--px-green-*`, `--px-amber-*` | ver arquivo |
| Foco no escuro / no pergaminho | `--px-cyan-300`, `--px-blue-700` | `#6ee7ff`, `#1f4fa8` |

O foco usa ciano (e azul no pergaminho) de propósito, para não se confundir com o dourado das molduras.

### 1.2 Contraste (teste automatizado)

`app/src/styles/tokens.test.ts` lê `tokens.css`, resolve os `var()` e verifica cada par declarado nos comentários `@contrast <frente> on <fundo> min <razão>` (WCAG 2.2 AA: 4,5 para texto; 3 para bordas de controles e anel de foco). Hoje são 51 pares, todos aprovados; os mais justos: `--color-input-border` sobre `--color-surface-raised` 3,59:1 (mín. 3), `--color-frame` sobre `--color-surface` 4,02:1 (mín. 3), `--color-focus-on-parchment` sobre `--color-parchment-deep` 4,74:1 (mín. 3) e `--color-text-on-parchment-muted` sobre `--color-parchment-deep` 5,70:1. O mesmo teste confere raio zero, bordas de 2 a 4 px, espaçamento em múltiplos de 8, fontes ligadas a `--text-scale` e a ausência de `blur(` e de sombras com desfoque em todas as folhas de `src/`.

Ao criar uma cor nova usada como texto ou borda de controle, declare o par em `tokens.css`.

## 2. Fontes

Arquivos locais em `app/src/assets/fonts/` (subconjuntos latin e latin-ext do Fontsource 5.3.0), com a licença ao lado (`OFL.txt`), declarados em `app/src/styles/fonts.css`. Licença: **SIL Open Font License 1.1** nas duas.

| Uso | Família | Pesos | Token |
| --- | --- | --- | --- |
| Títulos, abas, botões, HUD, etiquetas | **Pixelify Sans** | 400, 600 | `--font-pixel` |
| Texto longo (chat, descrições, campos) | **Crimson Pro** | 400, 400 itálico, 600, 600 itálico | `--font-serif` |

Escolha: Pixelify Sans tem minúsculas e é a mais legível das candidatas pixel em tamanhos de 14 a 18 px (Silkscreen só tem maiúsculas; Press Start 2P é larga demais). Crimson Pro tem altura-x maior que EB Garamond e lê melhor em tela no mesmo tamanho. As cinco candidatas cobrem `áàâãéêíóôõúüç ÁÀÂÃÉÊÍÓÔÕÚÜÇ ªº«»—…` (conferido pelo `cmap` das fontes). Para trocar, mude os arquivos, o `fonts.css` e os tokens `--font-pixel`/`--font-serif`.

## 3. Moldura em pixel

Classe `.px-frame` (em `base.css`): bordas desenhadas por `box-shadow` deslocado, sem desfoque. Uma linha interna (`--frame-inner`, 2 px) e um contorno externo (`--frame-outer`, 2 px) com o canto "em degrau", bisel interno (`--frame-hi`/`--frame-lo`) e sombra dura embaixo (`--frame-drop`). Não usa `clip-path`, então o anel de foco não é cortado. A moldura fica fora da caixa: **deixe 8 px de espaço** entre vizinhos e **folga** dentro de áreas com rolagem. As variantes só mudam as variáveis; uma futura moldura 9-slice pode substituir a classe sem mudar as telas.

## 4. Componentes (`app/src/ui/`)

Todos exportados por `app/src/ui/index.ts`, com testes (Vitest + Testing Library, por papel e rótulo).

| Componente | Variantes e estados | Notas de acessibilidade |
| --- | --- | --- |
| `Button` | `primary`, `secondary`, `danger`, `ghost`; `md` (44 px) e `sm` (32 px); hover, foco, ativo, desativado, `loading` | `type="button"` padrão; `loading` desativa e marca `aria-busy`; o rótulo continua sendo o nome |
| `Panel` | `dark`, `parchment`; barra de título opcional (`titleLevel`, `titleExtra`, `titleRef`) | com título vira região rotulada |
| `Tabs` + `TabPanel` | ativa, hover, foco | WAI-ARIA: setas, Home, End, ativação automática, tabulação só na ativa |
| `ProgressBar` | dourada, roxa, indeterminada | `role="progressbar"`, `aria-valuenow/min/max/valuetext`; largura por CSSOM |
| `ListCard` | normal, selecionado; título, meta, etiquetas, conteúdo, ações | `titleId` para `aria-describedby` das ações |
| `TextField`, `TextArea` | dica, erro, desativado, rótulo oculto, ação ao lado | rótulo associado; dica e erro na descrição; `aria-invalid` |
| `Badge` | `neutral`, `accent`, `success`, `warn`, `danger`, `info` | texto sempre presente; ícone decorativo |
| `Dialog` | `default`, `danger`; não dispensável | `role="dialog"`, `aria-modal`, foco preso, Esc, resto da página `inert`, foco devolvido (ou para `returnFocusRef`) |
| `StatusIndicator` | `ok`, `busy`, `error`, `idle` | ícone de forma diferente em cada tom; `role="status"` opcional |
| `ChatBubble` | `narrator` (pergaminho), `player`, `system`, `aside` (pontilhado, para `@Aduran`; só na galeria) | cursor de streaming decorativo |
| `SkyBackdrop` + `PeriodLabel` | 6 períodos | decorativo (`aria-hidden`); o período aparece em texto na barra de status |
| `PixelIcon` | ícones 8x8 em SVG desenhados por código | sempre `aria-hidden` |
| `Select` | com opção vazia, erro, desativado | `select` nativo (teclado do sistema); rótulo, dica e erro como no `TextField` |
| `RadioGroup` | `list` e `cards`; com dica e erro | `fieldset` + `legend`; o nome da opção é só o rótulo e a descrição fica em `aria-describedby`; alvo de 44 px |
| `FieldGroup` | com dica, erro e ações | `fieldset` + `legend`; dica e erro na descrição do grupo; a legenda pode receber foco |
| `Stepper` | passo concluído, atual e seguinte | `nav` + `ol`; `aria-current="step"`; estado também em texto; só os passos anteriores são botões |
| `TrailBoxes` | vazia, superficial (/), agravada (X), legenda | `role="img"` com texto equivalente ("Vida: 6 espaços; 0 superficiais…") |

### 4.1 Céu de dia e noite

`SkyBackdrop` recebe `period` (`madrugada | amanhecer | manha | tarde | entardecer | noite`) e desenha num `canvas` pequeno (1 pixel de arte = 4 px CSS, inteiro), ampliado com `image-rendering: pixelated`: bandas de cor discretas com linha pontilhada de transição, sol ou lua, estrelas de semente fixa, nuvens nos períodos de dia e silhueta de relevo e árvores. Redesenha só quando o período ou o tamanho mudam; sem laço de animação. A troca faz um *crossfade* de 640 ms em 4 degraus, imediato com movimento reduzido. As cores de cada período estão em `ui/SkyBackdrop/sky.ts` (decorativas, fora dos tokens). O período é estado do mundo; o app usa `entardecer` até existir Jornada.

## 5. Regras de uso

1. Telas usam componentes de `src/ui`; estilos específicos de tela ficam em `src/styles/screens.css`, só com tokens.
2. Nada de atributo `style` no HTML, `<style>` injetado nem CDN (CSP `style-src 'self'`). Valores dinâmicos: classe ou `element.style.setProperty` (CSSOM).
3. Texto nunca direto sobre o céu: painéis têm fundo sólido.
4. Pixel só em títulos e HUD; texto longo em serifa.
5. Controles principais com 44 px de alvo; os demais com pelo menos 24 px.
6. Chat: a conversa (`role="log"`) tem `aria-live="off"`; uma região à parte anuncia "O Narrador está respondendo…" e, ao fim, a resposta inteira. Erros saem por `role="alert"`.

## 6. Galeria

`npm run dev` e abra `http://localhost:5173/gallery.html` (só no servidor de desenvolvimento; o build usa apenas `index.html`). Mostra cores com a razão de contraste, tipografia, todos os componentes e estados, o céu nos 6 períodos com seletor, alternador de movimento reduzido e escala de texto (100% a 200%). `?secao=<id>` mostra uma seção só; `?secao=dialogo&aberto=1` abre o diálogo.

## 7. O que falta

- Ornamentos de canto, faixas e brasões (precisam de arte ou 9-slice próprio).
- Componentes ainda não feitos: Tooltip, IconButton, Checkbox estilizado (hoje nativo com `accent-color`, como os botões de opção do `RadioGroup`), Toast, Drawer do Narrador Geral, Slot de inventário.
- Controle de escala de texto nas configurações do jogo (hoje só na galeria).
- Teste com leitor de tela (NVDA/Narrador) e medição em DPI 125%, 150% e 200%.
- Reflow a 320 px de largura (SC 1.4.10) não foi medido; a janela mínima atual é 480 px.
- Ícones de período na barra superior e data do mundo dependem da Jornada.
