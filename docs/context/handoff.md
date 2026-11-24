# Handoff — estado atual do Henduran

Atualizado em 2026-11-24 após `ajustes-ficha-jornada`. Branch de trabalho: `feat/ajustes-ficha-jornada`. PR [#46](https://github.com/midrasil/henduran/pull/46) aberto contra `main`.
- Elaborado por: opencode

## Estado

- A ficha expandida da personagem agora tem três abas: `Visão geral`, `Convicções` e `Descrição`.
- `Visão geral` mostra trilhas, atributos e as 22 Perícias em duas colunas.
- `Convicções` mostra Objetivos no topo e Convicções abaixo.
- A ficha expandida tem altura fixa, com rolagem interna do conteúdo e adaptação responsiva para telas estreitas.
- A documentação da tela da Jornada foi sincronizada com a nova organização.

## Validações

- `cd app; npm run typecheck` passou.
- `cd app; npm run test -- src/screens/MainMenu.test.tsx` passou: 17 testes.
- `cd app; npm run test -- --run` passou: 37 arquivos, 330 testes.
- `git diff --check` passou.

## Pendências

- Conferir visualmente a ficha no app Tauri em 1280×800, 1024×768 e tela estreita, especialmente a rolagem da Visão geral e da aba Convicções.
- Conferir acessibilidade, leitor de tela e DPI de 125% a 200%.
- Aprovado e não feito: seletor nativo de pasta do Windows na tela Modelos.
- Permanecem pendências do produto em `docs/backlog.md`, incluindo Estado da Cena, Diário, pontos de retorno e demais rodadas da tela Modelos.

## Próximo passo recomendado

⭐ Revisar visualmente a ficha expandida no app real após o PR; depois seguir para a rodada 2 da tela Modelos e o seletor nativo de pasta.
