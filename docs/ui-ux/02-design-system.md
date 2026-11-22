# Design system pixel art

## Princípios

**CONFIRMADO:** chat domina a interface narrativa; mapa domina a situação tática sem remover o chat; a UI deve nascer de um inventário local e formar uma biblioteca reutilizável. **PROPOSTO:** implementar essa biblioteca em React/TypeScript, usar DOM para texto/controles acessíveis e PixiJS para mapas/tokens; adotar tokens semânticos CSS, foco de alto contraste e layout em grade de 8 px, com sprites alinhados à grade nativa de 16 px. A stack permanece candidata até a prova de conceito e ADR final.

Todo componente deve expor conteúdo semântico, teclado, foco visível, estado assíncrono e rótulo acessível. O sprite é decoração (`aria-hidden`) quando o DOM já comunica a função.

## Contratos de componentes

| Componente | Função | Sprite/composição | Dimensões recomendadas | Estados interativos | Comportamento | Reutilização | Acessibilidade |
|---|---|---|---|---|---|---|---|
| Button | ação textual | `Button_*` ou banner; foco/disabled em CSS | altura ≥32 CSS px; largura pelo texto | default, hover, active, focus, disabled, loading | `<button>`, ação única, não duplicar em keydown | diálogos, formulários, chat | nome, foco visível, alvo ≥44 px proposto, loading anunciado |
| IconButton | ação compacta | button quadrado + `Icon_*` validado | 32–48 px visual | mesmos do Button + selected | tooltip no hover/foco; não depender da cor | barras e painéis | `aria-label`; tooltip não substitui nome |
| Panel | agrupar conteúdo | `BGbox_*` 9-slice candidato ou CSS + borda sprite | mínimo definido pelo conteúdo | normal, busy, disabled opcional | não captura foco por padrão | regiões laterais, cards | landmark/heading quando necessário; contraste |
| Window | superfície sobre app | Panel + banner + botões | **PROPOSTO** 480–960 px, responsivo | open, closing, busy | foco contido só se modal; restaura foco | ficha, inventário, settings | título associado; Escape quando cancelável |
| Dialog | decisão bloqueante | Window compacta; CSS para severidade | largura legível, sem valor definitivo | info, confirm, danger, error, loading | confirmação explícita; ação destrutiva distinta | testes, conflito de importação | `role=dialog`, `aria-modal`, foco inicial seguro |
| Tabs | alternar painéis pares | `Tab01..15` Normal/Selected | altura ≥32; overflow rolável | selected, hover, focus, disabled | setas movem foco; Enter/Space ativa | ficha, diário, settings | padrão ARIA tabs e relação tab/panel |
| Tooltip | ajuda breve | caixa CSS ou BGbox simples | máx. **PROPOSTO** 320 px | hidden, hover/focus, pinned | atraso curto; não contém ação essencial | ícones/mapa | `role=tooltip`; dismissível; não só mouse |
| TextInput | texto curto | CSS sólido + borda coerente; sprite não forçado | altura ≥36; largura fluida | focus, invalid, disabled, readonly, loading | validação após interação; seleção nativa | nomes, filtros, API endpoint | `<label>`, erro associado, autocomplete adequado |
| TextArea | texto longo | CSS/DOM; cantos Franuka opcionais | ≥3 linhas; redimensionável | idem TextInput | preserva edição, desfazer e seleção | chat, editor, descrições | label, contador não exclusivo, sem fonte pixel obrigatória |
| ScrollArea | conteúdo longo | scrollbar CSS; partes `Slider*` só após prova | ocupa região disponível | idle, scrolling, edge, loading-more | scroll nativo e posição preservada | chat, listas, diário | teclado, wheel, sem scroll trap, `aria-live` separado |
| ProgressBar | progresso determinado | trilho + `Slider*_Bar*` recortado | altura 8–16 sprite px escalada | 0–100, indeterminate, error | animação respeita reduced motion | downloads, geração/exportação | `role=progressbar`, valor e texto |
| ResourceBar | estado mecânico validado | ProgressBar ou orb apenas se semântica aprovada | compacta, números sempre visíveis | normal, warning, critical, unknown | atualiza somente retorno do motor | personagem/tática | rótulo + valor textual; cor não exclusiva |
| InventorySlot | posição de item | `ItemSlot_*` Empty + conteúdo sobreposto | 32/48 CSS px em escala inteira | empty, occupied, selected, focus, disabled, drag-target | click/Enter abre ações; DnD tem alternativa | inventário/equipamento | nome/quantidade/estado acessível; ordem lógica |
| ItemCard | resumo de item | Panel + slot + texto DOM | **PROPOSTO** ≥240×96 | selected, unavailable, equipped, busy | ações no menu contextual explícito | inventário, comércio | heading, descrição e ações nomeadas |
| CharacterCard | resumo de protagonista/NPC | Panel + retrato opcional + recursos | ≥280 px, fluido | selected, active-turn, unavailable | não inventa retrato; abre ficha | jornada, tática, biblioteca | texto para todos os estados e recursos |
| CharacterSheet | consultar/editar ficha | Window + Tabs + dividers | janela ampla; conteúdo rolável | view/edit, dirty, saving, error | motor valida mutações; edição transacional | protagonista e entidades permitidas | headings, labels, erros, leitura linear |
| ChatMessage | mensagem contextual | DOM com separador/painel discreto; não balão ornamental rígido | largura fluida, linha 45–80 caracteres proposta | streaming, complete, error, retrying, corrected | seleção/cópia; distingue Narrador, jogador, sistema e motor | Fora de Cena/Cena/tática | autor/tempo/estado em texto; live region só para trecho novo |
| ChatInput | ação em linguagem natural | TextArea + Button/IconButton | rodapé fluido, 1–6 linhas propostas | idle, composing, sending, disabled, error | Enter/Shift+Enter configurável; cancela streaming sem apagar rascunho | todos chats | label, atalho configurável, status anunciado |
| DicePrompt | proposta de teste sem rolar | Panel/Dialog + parâmetros + Confirmar/Recusar | card inline ou modal **PENDENTE** | proposed, confirming, changed, expired, resolved, rejected | fora da tática exige confirmação; alteração invalida confirmação; motor rola | chat e fluxos mecânicos | parâmetros legíveis; foco seguro; recusa equivalente por teclado |
| Notification | feedback transitório/persistente | CSS + ícone validado; não bloquear | compacto, empilhável | info, success, warning, error, progress | toast só para complemento; erros importantes persistem | global | `status`/`alert` com parcimônia; pausa e histórico |
| ContextMenu | ações contextuais | Panel CSS/9-slice leve | pelo conteúdo, dentro da viewport | open, focus, disabled, submenu | botão/menu explícito; fecha por Escape/click externo | slot, card, árvore, mapa | padrão ARIA menu quando ações; alternativa sempre visível |

## Composição direta versus complementação

Diretamente suportados: Button, IconButton, Panel/Window decorativos, Tabs, ProgressBar/ResourceBar visual, InventorySlot, banners, dividers, checkboxes, ícones, orbs e livro/diário ornamental. Compostos com DOM/CSS: Dialog, Tooltip, inputs, ScrollArea, cards, ficha, chat, DicePrompt, Notification e ContextMenu. Ausentes e potencialmente novos: token-moeda Henduran, hex UI, árvore/conectores, indicadores de IA/streaming, ícones semânticos próprios e estados de acessibilidade.

## Tokens propostos

- espaço e tamanho em CSS px; arte em múltiplos inteiros;
- cores semânticas independentes dos nomes HP/MP do pacote;
- `--pixel-scale` inteiro; variantes 1x/2x/3x selecionadas por densidade/layout, não por zoom fracionário;
- tipografia pixel para títulos curtos; fonte de sistema/legível para chat e editor até teste comprovar o contrário;
- foco CSS de alto contraste fora do raster; `prefers-reduced-motion` desativa animações ornamentais.

