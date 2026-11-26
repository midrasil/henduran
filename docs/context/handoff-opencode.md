# Handoff do opencode — estado atual dos ajustes e tarefas menores

Atualizado em 2026-11-26. Branch: `feat/biblioteca-jornadas`, entrega sem PR por solicitação do responsável.

## Estado

- Biblioteca redesenhada com a API existente: busca, filtros, cartões, painel de detalhes e atalhos para continuar, criar, restaurar ou excluir.
- Ajustes de revisão: tela usa toda a área útil, estado vazio tem fundo opaco e um só botão, busca e filtros não rolam com os cartões, e o painel de detalhes tem fundo opaco e rolagem no conteúdo.
- Artefatos principais: `app/src/screens/JourneysScreen.tsx`, `JourneysScreen.css`, `JourneysScreen.test.tsx` e `docs/ui-ux/15-jornadas.md`.

## Validações e pendências

- `npm run typecheck` passou; a suíte completa passou com 333 testes antes dos ajustes finais; depois deles, os 11 testes de Jornadas passaram.
- Pontos de retorno seguem pendentes no backlog. A tela exibe aviso de indisponibilidade.
- ⭐ Próximo passo: conferir contraste, filtros e rolagem no Tauri em janela larga e estreita.
