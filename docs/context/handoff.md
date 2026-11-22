# Handoff — estado atual do Henduran

Atualizado em 2026-11-22 após a tarefa `auditoria-caliope`.

## Estado

- Tarefa: auditoria técnica do Caliope (ADR-016) e registro das decisões de MVP e de IA local.
- Resultado: relatório escrito; nenhum código; ADRs das decisões novas ainda por formalizar.
- Branch: `docs/auditoria-caliope` (PR aberto contra `main`).

## Decisões vigentes

- **Stack (ADR-001):** Tauri, React + TypeScript, PixiJS, Python, só Windows. Scaffolding e prova de conceito exigem instrução explícita.
- **UI (ADR-069):** pixel art em CSS com tokens próprios, sem tileset; ADR-068 para resolução e acessibilidade.
- **IA (aprovado na auditoria, a formalizar em ADR):** llama-server (llama.cpp) + GGUF, local gratuito primeiro e API paga por chave depois; interface `NarratorProvider`; protocolo frontend↔Python por HTTP com SSE.
- **Caliope:** o autor autorizou o uso do código (confirmação verbal; registrar por escrito). Importar `llm.py`, depois `runtime.py` + `hardware.py`, depois `modelhub.py`. Não importar `engine.py` nem regras. **Todas as skills entram**, inclusive conteúdo adulto, preservando licenças e atribuições.
- **MVP:** sobre o loop de gameplay, com menu inicial, mundo genérico, criação de personagem e somente chatbot, sem combate nem mapa global. O caso do ferreiro foi retirado dos planos.

## Artefatos

- `docs/main/auditoria-caliope.md`.
- Clone de leitura do Caliope (commit `1cab9e0`) só na pasta temporária da sessão; não está no repositório.

## Pendências relevantes

- Formalizar os três ADRs de IA e ajustar `04-arquitetura.md`.
- Detalhar o escopo do MVP e ajustar os docs que citam o ferreiro.
- Registrar a autorização do Caliope por escrito e pedir `LICENSE`.
- Backlog autoritativo: `docs/backlog.md`.

## Próximo passo recomendado

⭐ Escrever os ADRs de IA local e detalhar o escopo do MVP; depois dar a instrução explícita de scaffolding para o dev importar `llm.py`, `runtime.py` e `hardware.py`.
