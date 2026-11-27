# Handoff do opencode — estado atual dos ajustes e tarefas menores

Atualizado em 2026-11-27. Branch: `feat/pontos-de-retorno`, baseada em `feat/biblioteca-jornadas`. PR #51 aberto (https://github.com/midrasil/henduran/pull/51), aguardando revisão; merge não autorizado.

## Estado

- Pontos de retorno na biblioteca e no menu da Jornada. Limites: 20 manuais e 5 automáticos, contando **Antes de carregar**.
- Save padrão listado como primeira linha: **Jogo salvo** na biblioteca e **Jogando agora** na Jornada aberta, com etiqueta **Atual**; somente leitura, sem contagem de mensagens e sem alteração no backend.
- Exceção ao ADR-041 aprovada: carregar substitui o estado ativo e mantém a referência à versão fixa do Mundo-base. A imagem do retrato acompanha o SQLite restaurado.
- Artefatos principais: `backend/henduran/services/return_points.py`, migração `journey/0007`, `app/src/screens/ReturnPoints.tsx` e `docs/ui-ux/15-jornadas.md`.

## Validações e pendências

- Typecheck, 34 testes direcionados e a suíte frontend completa (342 testes) passaram; `git diff --check` limpo. Os 32 testes de backend (Pontos de retorno, criação e migrações) seguem passando; a suíte backend completa ainda não terminou por tempo.
- Ajustes posteriores: sem mensagens técnicas nem botão de retry; o save padrão permanece visível mesmo com lista vazia ou falha na consulta.
- ⭐ Próximo passo: validar salvar, carregar e desfazer no Tauri para Windows, conforme `docs/backlog.md`.
