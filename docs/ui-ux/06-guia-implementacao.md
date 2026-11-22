# Guia de implementação para Codex

## Estado da recomendação

React + TypeScript, Tauri e PixiJS são a stack aprovada (ADR-001); a prova de conceito de `docs/main/04-arquitetura.md` valida a aprovação e resolve motor, protocolo e empacotamento. Este guia não autoriza scaffolding significativo: isso exige instrução explícita.

## Organização futura proposta

```text
src/
  app/                 # shell, rotas/modos, providers
  ui/
    primitives/        # Button, Panel, TextInput, ScrollArea...
    composites/        # DicePrompt, ChatInput, ItemCard...
    patterns/          # NarrativeLayout, TacticalLayout, WorldMapLayout
    sprites/           # registro tipado e metadados; sem lógica de jogo
    styles/            # tokens, foco, fontes, pixel-scale
  features/
    journey/ chat/ inventory/ character/ journal/ continuity/ settings/
  game-canvas/         # adapters Pixi, mapas e tokens
  engine-client/       # contratos de comandos/eventos; sem componentes
```

Componentes em `PascalCase`, hooks `useX`, eventos no passado (`rollResolved`), comandos imperativos (`confirmRoll`), tipos sem prefixo `I`. Não nomear sprite por semântica inventada: `Icon18` até o registro aprovar `SaveIcon`, por exemplo.

## Sprites e catálogo

1. Preferir arquivos individuais, pois as sheets não têm atlas formal.
2. Gerar em build local um registro tipado `spriteId → URL, tamanho, escala, estados, insets`; não commitar binários derivados em repositório público.
3. Centralizar URL em `Sprite`/`PixelFrame`; componentes não concatenam caminhos.
4. Selecionar 1x/2x/3x por escala inteira e tamanho alvo. Não interpolar entre variantes.
5. Animações de livro são ornamentais; lazy-load, reduzir/desligar por preferência e nunca bloquear conteúdo.

## CSS e 9-slice

Usar CSS para layout, superfícies de texto, foco, disabled, erro, loading e responsividade. Para frames validados, `border-image` ou nove elementos posicionados; testar cada família em larguras/alturas mínimas, longas e ímpares. Não declarar insets até prova visual. Barras usam trilho + preenchimento com `overflow: hidden`/clip + tampa fixa. Evitar filtros, blur e transform fracionário.

```css
.pixel-sprite {
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}
.focusable:focus-visible {
  outline: 3px solid var(--focus-ring);
  outline-offset: 2px;
}
```

`image-rendering` aplica-se a raster escalado, não ao texto DOM. Nunca use canvas para chat/editor apenas para “parecer pixel”.

## Pixel-perfect e resolução

- **PROPOSTO:** `--pixel-scale` inteiro; coordenadas e tamanhos raster resultam em inteiros físicos.
- Testar Windows em 100%, 125%, 150% e 200%; em escalas fracionárias, escolher arte apropriada e aceitar layout CSS nítido sem deformar raster.
- Resolução-base e proporções dos painéis estão **PENDENTES**. Definir breakpoints por conteúdo: chat/compositor nunca ficam inutilizáveis; tática mantém mapa dominante e chat acessível.
- Resize do canvas usa `ResizeObserver`, atualiza renderer e preserva câmera; DOM mede o espaço, Pixi não governa o shell.

## Tipografia

Fonte Franuka: texto em múltiplos de 12 pt, título 17 pt e contorno 20 pt a 72 ppi, com antialiasing desabilitado conforme licença. **PROPOSTO:** limitar pixel font a títulos/rótulos curtos; usar fonte de sistema legível no chat, editor e configurações. Testar português, acentos, seleção, cópia, zoom 200%, largura 45–80 caracteres e contraste WCAG como meta de validação, pois acessibilidade formal ainda está pendente.

## Estado interativo

Primitivos usam estado nativo e atributos ARIA; features usam máquinas de estado explícitas quando há proposta→confirmação→motor→resultado. Separar:

- estado efêmero de UI (painel, foco, rascunho, viewport);
- cache de leitura marcado por versão;
- estado oficial vindo do motor;
- streaming/narrativa, que nunca aplica mutação por conta própria.

Não usar optimistic update para moeda, inventário, rolagem, posição ou continuidade. Comandos persistentes têm chave idempotente e retorno estruturado. Retry da narrativa não repete comando.

## React e PixiJS

React hospeda `MapViewport`, controla layout e envia comandos semânticos. Adapter Pixi recebe snapshot/versionamento e emite intenção (`tokenSelected`, `hexActivated`); o engine-client decide validade e devolve atualização. Pixi renderiza mapa, grid, efeitos e tokens-moeda; overlays textuais, tooltip acessível, menus e chat ficam no DOM. Fornecer alternativa por lista/teclado para informações essenciais do canvas.

## Dependências

Não introduzir biblioteca até demonstrar necessidade. CSS, componentes React e APIs nativas cobrem o catálogo inicial. PixiJS é a renderização de mapa já aprovada no ADR-001. Para máquina de estados, atlas, acessibilidade ou virtualização, primeiro medir complexidade/performance e registrar decisão; evitar framework visual genérico que conflite com sprites.

## Sequência recomendada

1. ⭐ prova da interface principal da Jornada: shell + chat longo/streaming + compositor + contexto, com primitivos Button/Panel/inputs/ScrollArea;
2. DicePrompt fora da tática e fronteira real com motor fake determinístico;
3. ficha e inventário read-only, depois comandos validados;
4. mapa tático Pixi com token-moeda e chat secundário preservado;
5. mapa-múndi hexagonal separado;
6. bibliotecas/criação/configurações/backups;
7. diário/editor e árvore de continuidades, após contratos de dados.

## Critérios de aceitação visual

- nenhum raster borrado em escalas suportadas; sem transformação fracionária acidental;
- estados normal/hover/active/focus/disabled/loading/error distinguíveis, mesmo quando o pacote não os contém;
- texto longo selecionável, copiável e legível; foco e zoom não cortam ações;
- narrativa: chat visualmente dominante e nenhum mapa localizado; tática: mapa dominante e chat disponível; mapa-múndi distinto;
- sprite decorativo não substitui rótulo; cor/ícone não são único sinal;
- comparação visual nas variantes mínimas e amplas; `prefers-reduced-motion` respeitado.

## Critérios funcionais

- proposta de teste fora da tática não rola antes de confirmação específica;
- IA não altera estado; somente respostas validadas do motor atualizam UI;
- retry não duplica operação; erro conserva rascunho/histórico/estado oficial;
- alternar narrativa/tática preserva Cena; restaurar passado cria continuidade independente;
- backups não incluem segredos, modelos ou assets comerciais sem permissão;
- testes unitários de estado/teclado, integração UI↔engine e smoke visual nas escalas; registrar snapshots apenas de componentes próprios quando a política de licença permitir.

## Checklist antes de implementar uma tela

Fonte aprovada citada; componentes reutilizados; sprites verificados no manifesto; estados vazios/loading/erro definidos; teclado/foco/zoom cobertos; fronteira motor/IA explícita; dados persistentes e idempotência definidos; nenhuma mecânica **PENDENTE** transformada em comportamento.

