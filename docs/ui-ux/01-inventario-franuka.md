# Inventário Franuka

## Resultado executivo

**CONFIRMADO por inspeção local:** pacote v1.8, grade nominal de 16 px em 1x, 32 px em 2x e 48 px em 3x; 1.917 arquivos (1.907 PNG, 6 GIF, 3 TTF e 1 TXT). Há três folhas agregadas, arquivos individuais nas três escalas, exemplos, folha de referência e licença. Não há `.json`, `.xml`, `.plist`, `.atlas` ou outro atlas formal.

O [manifesto JSON](franuka-manifest.json) é a relação exaustiva: caminho relativo, extensão, bytes, dimensões, escala, categoria, família e estado de cada arquivo. A tabela abaixo consolida famílias para uso humano; não omite arquivos do manifesto.

## Estrutura e cobertura

| Categoria | Arquivos | Famílias | Dimensões observadas | Estados nomeados | Uso sugerido |
|---|---:|---:|---|---|---|
| Background boxes | 39 | 13 | 48², 96², 144² | padrão | painéis/janelas; candidatos explícitos a composição |
| Buttons | 834 | 114 | 16–96 px de largura, 16–48 px de altura | Normal, Selected, Pressed e compostos | botões e prompts de entrada |
| Checkboxes | 54 | 18 | 16², 32², 48² | variações por arquivo | check/radio; sem semântica embutida |
| Cursors | 117 | 39 | 16², 32², 48² | variações | cursor contextual, apenas onde não prejudicar SO/acessibilidade |
| Dividers | 33 | 11 | 48×16, 96×32, 144×48 | padrão | separadores horizontais |
| Item slots | 99 | 33 | 16², 32², 48² | Default, Empty | inventário/equipamento |
| Mini icons | 288 | 32 | 16², 32², 48² | Default, Selected, Outline | ícones genéricos; significado deve ser validado |
| Resource orbs | 33 | 11 | 48–240 px | Default, Empty | recurso destacado; não assumir HP/MP como regra Henduran |
| Sliders & Bars | 90 | 30 | 16–144 px | partes de barra/controle | progresso, recurso ou slider conforme semântica |
| Spellbook & Tabs | 174 | 29 | 16×176 a 96² por parte | Normal, Selected e animações | diário/livro, tabs e dobras |
| Title banners | 108 | 24 | 48–144 px | Normal, Selected, Pressed | títulos e botões ornamentais |
| Fonts | 27 | 11 | 3 TTF + amostras PNG | — | títulos e texto curto em múltiplos nativos |
| Examples | 15 | 15 | 10×128 a 2560×2304 | GIF demonstrativo | referência; não usar como componente |
| Raiz | 6 | 6 | sheets/referência/arte | — | auditoria; `Scarred Roseblade...` tem função incerta |

## Famílias e estados relevantes

| Identificador/família | Caminho relativo representativo | Dimensão 1x | Categoria | Estados | Uso sugerido | Limitações |
|---|---|---:|---|---|---|---|
| `BGbox_01..08` | `Individual files/1x/Background boxes/` | 48×48 | painel | padrão | Panel/Window | referência indica centro, lados e cantos tileáveis; validar por variante |
| `Button_01..06` | `Individual files/1x/Buttons/` | varia | botão | Normal/Selected/Pressed | Button/IconButton | sem Disabled/Focus/Error; adicionar CSS |
| `Input_*` | mesmo diretório | 16–32 px | prompt | Normal/Selected/Pressed ou composto | ajuda de teclado/controle | muitas famílias são específicas de gamepad; não são navegação principal confirmada |
| `Checkbox*` | `Individual files/1x/Checkboxes/` | 16×16 | seleção | variantes visuais | checkbox/radio | mapear checked/indeterminate por inspeção antes do componente |
| `ItemSlot_*` | `Individual files/1x/Item slots/` | 16×16 | slot | Default/Empty | inventário/equipamento | ícones corporais não confirmam regras de equipamento |
| `Icon_01..32` | `Individual files/1x/Mini icons/` | 16×16 | ícone | normal/selected/outline | ações/estado | significado semântico incerto: criar registro de ícones antes de usar |
| `Slider01..03` | `Individual files/1x/Sliders & Bars/` | partes 16/48 px | barra | oito cores + box/button | ProgressBar/ResourceBar | preencher via recorte/máscara; não esticar a tampa |
| `Spellbook*` | `Individual files/1x/Spellbook & Tabs/` | composição | livro | base, opening/closing/page | diário/editor | dimensões e animações fixas; DOM precisa sobrepor texto acessível |
| `Tab01..15` | mesmo diretório | varia | tab | Normal/Selected | Tabs | orientação esquerda/direita/inferior varia; sem foco/disabled |
| `Banner*` | `Individual files/1x/Title banners/` | 48×16 ou 48×32 | banner | alguns Normal/Selected/Pressed | título/ação | ornamentação reduz área útil |
| `Orb_*` | `Individual files/1x/Resource orbs/` | 48–80 px | recurso | conteúdo/frame/empty | recurso importante | nomes HP/MP/Energy são do pacote, não mecânicas aprovadas |
| `FantasyRPG*` | `Fonts/` | 12/17/20 pt @72 ppi | fonte | texto/título/contorno | títulos curtos | antialiasing deve estar desligado segundo licença; chat longo exige fallback proposto |

## Folhas, animações e metadados

- `UI assets (1x|2x|3x).png`: sheets visuais sem coordenadas. **PROPOSTO:** usar arquivos individuais no runtime; coordenadas das sheets ficam **PENDENTES** até atlas gerado internamente sem redistribuição.
- `Reference sheet.png`: demonstra categorias e marca explicitamente centro/lados/cantos tileáveis para background boxes e centro/lados para banners. Isso prova a intenção de composição, não insets universais.
- 6 GIFs em `Examples/`: demonstrações de livro, página, botões, orbs, sliders e atualização v1.6. O inspetor lê dimensões; contagem/duração de frames fica **PENDENTE**, pois a rotina portátil não interpreta blocos GIF com segurança.
- As animações também possuem PNGs de estados/frames nomeados (opening, closing, next/previous), preferíveis para atlas interno futuro.

## 9-slice e escala

**CONFIRMADO:** a folha de referência marca partes tileáveis para caixas e banners. **PROPOSTO:** modelar `PixelFrame` com nove regiões somente após teste visual por família; insets são tokens por variante, não um valor global. `BGbox_*`, banners e alguns botões largos são candidatos. Orbs, slots, ícones, cursores e livro são escala fixa; barras devem usar trilho + preenchimento recortado + tampa; superfícies de texto longo podem usar CSS sólido com borda sprite.

Não esticar imagens arbitrariamente. Escalonar 1x/2x/3x ou múltiplos inteiros; escolher o arquivo que corresponda ao fator de escala e manter `image-rendering: pixelated` para sprites.

## Paleta e linguagem visual

Amostra visual: folha de referência, sheet 1x e mockup. Paleta observada, aproximada e **não normativa**: ameixa/vinho escuro para contornos, salmão/rosa envelhecido para superfícies, azul ardósia para seleção, dourado/laranja para destaque, vermelho para alerta, ciano/verde para estados alternativos e pergaminho claro. Padrões: contorno de 1–3 pixels, highlights pontuais, sombras duras, cantos ornamentais, baixa suavização e formas legíveis em grade de 16 px.

**PROPOSTO:** tokens CSS semânticos devem ser extraídos por amostragem controlada em uma prova visual; não acoplar “vermelho = HP” ou “azul = MP” sem regra aprovada. Contraste do texto deve ser medido no DOM.

## Ausências e incertezas

- não há componentes específicos de chat, árvore, mapa hexagonal, token-moeda, editor de texto, seletor de arquivo, streaming, skeleton ou provider de IA;
- não há estados Disabled, Focus-visible, Loading, Error ou Success completos;
- não há atlas formal, metadados de pivô ou insets de 9-slice;
- a função semântica de mini ícones, cursores e `Scarred Roseblade at the Tavern Bar.png` não deve ser inferida pelo desenho;
- elementos ausentes serão CSS/DOM acessível ou assets adicionais licenciados/autoriais, nunca uso forçado de sprite inadequado.

## Integridade e licença

O catálogo e manifesto contêm apenas texto/caminhos. Nenhum raster foi copiado. Reexecute o inspetor e compare hash/contagens; `git diff -- assets/tilesets/ui/franuka` deve permanecer vazio. Não publicar assets ou capturas do catálogo sem autorização.

