# Handoff — estado atual do Henduran

Atualizado em 2026-11-22 após a tarefa `adr-068-resolucao-base`.

## Estado

- Tarefa: ADR-068 (política de resolução, redimensionamento e acessibilidade da UI).
- Resultado: decisão registrada; nenhum código; valores numéricos ainda pendentes.
- Branch: `docs/adr-068-resolucao-base` (PR a abrir contra `main`), construída sobre a `main` que já contém o PR #2 (reconciliação da stack).

## Decisões vigentes

- **Stack (ADR-001, reconciliada no PR #2):** Tauri, React + TypeScript, PixiJS, Python, só Windows. Itens em aberto em `docs/main/04-arquitetura.md`. Scaffolding e prova de conceito exigem instrução explícita.
- **Resolução (ADR-068):** layout fluido, sprites 1x/2x/3x por DPI efetivo, sem zoom fracionário, texto DOM com escala independente.
- **Acessibilidade (ADR-068):** WCAG 2.2 AA no DOM; alvo de interação ≥ 44 CSS px para controles primários (requisito interno) e ≥ 24 px nos demais; reduced motion obrigatório; equivalente DOM para informação essencial do canvas.

## Artefatos

- `docs/main/decisoes/ADR-068-resolucao-redimensionamento-acessibilidade-ui.md`.
- `docs/esteira/adr-068-resolucao-base/` (plano técnico, revisão, entrega).
- Entrega: PR do ADR-068 aberto pela etapa `entrega` (ver `06-entrega.md`).

## Pendências relevantes

- Propagar o ADR-068 nos documentos relacionados (lista completa no backlog), sem converter o alvo de 44 px em altura mínima de Button.
- Conciliar janela mínima e breakpoints com o SC 1.4.10; definir "controles primários".
- Prova de conceito (com instrução explícita) para fixar valores numéricos.
- Backlog autoritativo: `docs/backlog.md`.

## Próximo passo recomendado

Propagar o ADR-068 nos documentos que o referenciam (primeiro item do backlog).
