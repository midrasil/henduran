# Handoff do opencode — estado atual dos ajustes e tarefas menores

Atualizado em 2026-11-26 após `remover-destaque-foco`. Branch de trabalho: `fix/remover-destaque-foco`. PR [#49](https://github.com/midrasil/henduran/pull/49) aberto contra `main`.
- Elaborado por: opencode

## Estado

- Os indicadores visuais azuis de foco foram removidos temporariamente da interface.
- O foco funcional e a navegação por teclado continuam implementados; apenas os contornos e destaques visuais foram desativados.
- A remoção cobre o indicador global e os estilos específicos de botões, abas, campos, diálogos, rádio, modelos, Nova Jornada, Composer e editor de histórico.
- Tokens de foco foram preservados para futura reimplementação configurável.

## Validações

- `cd app; npm run typecheck` passou.
- `cd app; npm run test` passou: 37 arquivos, 330 testes.
- `git diff --check` passou.

## Pendências

- Conferir visualmente no app Tauri se nenhum destaque azul aparece ao clicar e navegar com `Tab`/`Shift+Tab`.
- Conferir acessibilidade, leitor de tela e DPI de 125% a 200%, considerando que o foco visual está temporariamente desativado.
- Permanecem pendências do produto em `docs/backlog.md`, incluindo Estado da Cena, Diário, pontos de retorno e demais rodadas da tela Modelos.

## Próximo passo recomendado

⭐ Revisar o PR e validar visualmente o foco no app real; depois decidir quando transformar o indicador em uma preferência configurável.
