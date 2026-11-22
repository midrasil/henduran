# Jornal da esteira

Registro cronológico, cumulativo e conciso da execução do projeto. Este arquivo documenta o que aconteceu; `docs/backlog.md` continua sendo a lista autoritativa e ordenada de pendências.

## 2026-11-22 — `mapeamento-ui-ux`

- Rota: PM → Tech Lead → Dev → Revisor → QA → Entrega.
- Resultado: mapeamento completo de UI/UX, sem implementação de telas definitivas e sem alteração de gameplay ou ADRs.
- Inventário: 1.917 arquivos Franuka — 1.907 PNG, 6 GIF, 3 TTF e 1 TXT; nenhum atlas ou metadado formal encontrado.
- Entregáveis: sete documentos em `docs/ui-ux/`, manifesto exaustivo, catálogo HTML local e inspetor determinístico.
- Revisão: aprovada na segunda rodada após corrigir a classificação da stack candidata e esclarecer o escopo da validação de escalas.
- QA: passou nos 12 critérios; 1.262 comparações dimensionais sem exceções no escopo documentado, zero links quebrados e geração determinística.
- Entrega: commits `1bfa7e3` e `08c2c6d`; PR [#1](https://github.com/midrasil/henduran/pull/1) aberto contra `main`.
- Ocorrência posterior: o Dev econômico ficou indisponível para integrar estes registros porque o executor externo bloqueou o envio do contexto; o ajuste foi assumido pelo Dev interno.

## 2026-11-22 — `reconciliar-stack`

- Rota: ADR/decisão → orquestrador escreve → Revisor → Entrega.
- Resultado: reconciliada a contradição entre o ADR-001 (stack aprovada) e `AGENTS.md`, `04-arquitetura.md`, `06-plano-inicial.md` e docs de UI/UX (que ainda diziam "candidata"). Nenhum ADR novo; nenhuma decisão de produto nova.
- Regra adotada: stack base (Tauri, React/TS, PixiJS, Python, só Windows) aprovada; motor Astra, protocolo frontend↔Python, empacotamento do Python, hardware e atualização seguem em aberto; scaffolding e prova de conceito exigem instrução explícita; a prova de conceito valida o ADR-001 e resolve motor, protocolo e empacotamento; demais itens em aberto (modelos, hardware, atualização, llama.cpp/GGUF) estão listados em `04-arquitetura.md`.
- Observação: os registros históricos em `docs/esteira/mapeamento-ui-ux/` foram preservados e ainda dizem "candidata".
- Ocorrência: o grafo foi gerado com `/graphify` (343 nós, 18 comunidades); o catálogo HTML Franuka ficou como parcial no cache.
- Revisão: reprovada na 1ª rodada (contradição nova com ADR-050 e resquício no GDD:449), aprovada na 2ª. Relatório em `docs/esteira/reconciliar-stack/04-revisao.md`. QA não aplicável (somente documentação).
