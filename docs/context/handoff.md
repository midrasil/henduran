# Handoff — estado atual do Henduran

Atualizado em 2026-11-22 após a entrega `mapeamento-ui-ux`.

## Estado

- Tarefa: mapeamento completo de UI/UX do Henduran.
- Resultado: documentação, inventário e catálogo local concluídos; nenhuma tela definitiva foi implementada.
- Branch: `docs/mapeamento-ui-ux`.
- Commits: `1bfa7e3` e `08c2c6d`.
- PR: [#1 — Mapeamento completo de UI/UX](https://github.com/midrasil/henduran/pull/1), aberto contra `main`.

## Artefatos principais

- Especificação e índice: `docs/ui-ux/README.md` e documentos `01` a `06`.
- Manifesto exaustivo: `docs/ui-ux/franuka-manifest.json`.
- Catálogo local: `docs/ui-ux/catalogo-franuka.local.html`.
- Inspetor reproduzível: `scripts/ui-ux/inspect-franuka.ps1`.
- Registros da esteira: `docs/esteira/mapeamento-ui-ux/`.

## Validação

- Revisor: aprovado na segunda rodada.
- QA: passou nos 12 critérios de aceite.
- Inventário: 1.917 arquivos únicos e nenhuma imagem sem dimensão.
- Escalas: 1.262 comparações dimensionais sem exceções no escopo documentado.
- Catálogo e manifesto: geração determinística, sem incorporar ou copiar assets comerciais.

## Pendências relevantes

- Definir resolução-base, breakpoints e requisitos formais de acessibilidade.
- Validar a forma de distribuição dos assets comerciais no executável e em eventual repositório público.
- Frames e duração dos seis GIFs não foram extraídos; somente suas dimensões foram registradas.
- O backlog autoritativo permanece em `docs/backlog.md`.

## Próximo passo recomendado

Implementar o primeiro slice da interface principal da Jornada a partir da especificação UI/UX, seguindo a rota completa de feature registrada no backlog.
