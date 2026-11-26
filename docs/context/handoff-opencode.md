# Handoff do opencode — estado atual dos ajustes e tarefas menores

Atualizado em 2026-11-26 após `instalador-esteira-claude`. Branch: `chore/instalador-esteira-claude`. [PR da entrega](https://github.com/midrasil/henduran/pulls?q=head%3Achore%2Finstalador-esteira-claude), contra `main`.
- Elaborado por: opencode

## Estado

- `AGENTS.md` explicita o handoff do OpenCode e orienta a escrita de PRs em português. O instalador `scripts/instalar-esteira-claude.ps1` aplica a mesma esteira no Claude Code; instruções em `scripts/README.md`. Instalação local concluída.
- O PR [#49](https://github.com/midrasil/henduran/pull/49) já foi integrado à `main`.
- Os indicadores visuais azuis de foco foram removidos temporariamente da interface.
- O foco funcional e a navegação por teclado continuam implementados; apenas os contornos e destaques visuais foram desativados.
- A remoção cobre o indicador global e os estilos específicos de botões, abas, campos, diálogos, rádio, modelos, Nova Jornada, Composer e editor de histórico.
- Tokens de foco foram preservados para futura reimplementação configurável.

## Validações

- Instalador: `-WhatIf` não gravou; instalação nova, atualização com backup e preservação do texto externo ao bloco, e reexecução sem duplicação verificadas no PowerShell.
- Validações do PR #49:
- `cd app; npm run typecheck` passou.
- `cd app; npm run test` passou: 37 arquivos, 330 testes.
- `git diff --check` passou.

## Pendências

- Conferir visualmente no app Tauri se nenhum destaque azul aparece ao clicar e navegar com `Tab`/`Shift+Tab`.
- Conferir acessibilidade, leitor de tela e DPI de 125% a 200%, considerando que o foco visual está temporariamente desativado.
- Permanecem pendências do produto em `docs/backlog.md`, incluindo Estado da Cena, Diário, pontos de retorno e demais rodadas da tela Modelos.

## Próximo passo recomendado

⭐ Abrir uma nova sessão do Claude Code para conferir a esteira instalada. Na frente de UI, validar visualmente o foco no app real.
