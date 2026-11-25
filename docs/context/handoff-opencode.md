# Handoff do opencode — estado atual dos ajustes e tarefas menores

Atualizado em 2026-11-24 após `remodelar-atributos-ficha`. Branch de trabalho: `fix/ficha-atributos-tamanho`. PR será aberto contra `main`.
- Elaborado por: opencode

## Estado

- A ficha resumida da Jornada mantém a coluna direita com largura de 360px.
- A seção de Atributos agora usa duas listas lado a lado, sem títulos de categoria.
- Cada atributo mostra o nome na primeira linha, os marcadores na linha abaixo e o valor numérico alinhado à direita.
- Os atributos continuam agrupados pelas categorias oficiais e ordenados alfabeticamente dentro de cada lista.
- A ficha expandida permanece com as abas Visão geral, Convicções e Descrição.

## Validações

- `cd app; npm run typecheck` passou.
- `cd app; npm run test -- src/screens/MainMenu.test.tsx src/screens/journey/JourneyScreen.test.tsx` passou: 31 testes.
- `git diff --check` passou.

## Pendências

- Conferir visualmente a ficha no app Tauri em 1280×800, 1024×768 e tela estreita.
- Conferir acessibilidade, leitor de tela e DPI de 125% a 200%.
- Aprovado e não feito: seletor nativo de pasta do Windows na tela Modelos.
- Permanecem pendências do produto em `docs/backlog.md`, incluindo Estado da Cena, Diário, pontos de retorno e demais rodadas da tela Modelos.

## Próximo passo recomendado

⭐ Revisar visualmente a ficha no app real e revisar o PR; depois seguir para a rodada 2 da tela Modelos e o seletor nativo de pasta.
