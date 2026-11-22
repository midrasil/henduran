# Handoff — estado atual do Henduran

Atualizado em 2026-11-22 após a tarefa `adr-ui-pixel-art-css`.

## Estado

- Tarefa: ADR-069 (UI pixel art em CSS com tokens próprios, sem tileset no MVP).
- Resultado: decisão registrada; nenhum código; tokens e fontes ainda não definidos.
- Branch: `docs/adr-ui-pixel-art-css` (PR aberto contra `main`).

## Decisões vigentes

- **Stack (ADR-001):** Tauri, React + TypeScript, PixiJS, Python, só Windows. Itens em aberto em `docs/main/04-arquitetura.md`. Scaffolding e prova de conceito exigem instrução explícita.
- **UI (ADR-069, substitui parcialmente o ADR-017):** pixel art em CSS com tokens próprios; componentes agnósticos à origem da moldura; texto em DOM; fonte pixel só em títulos/HUD. Tileset Franuka fora do caminho crítico, mantido local como referência.
- **Resolução e acessibilidade (ADR-068):** layout fluido, WCAG 2.2 AA no DOM, alvo ≥ 44 CSS px nos controles primários, reduced motion. Sprites 1x/2x/3x valem só para mapa/tokens PixiJS.

## Artefatos

- `docs/main/decisoes/ADR-069-ui-pixel-art-css-sem-tileset.md`.
- `docs/main/decisoes/ADR-017-biblioteca-ui-pixel-art.md` (estado atualizado).
- `docs/backlog.md` (itens novos de propagação, tokens/fontes e página de componentes).

## Pendências relevantes

- Propagar ADR-068 e ADR-069 nos documentos relacionados (primeiro item do backlog).
- Definir tokens e fontes.
- Instrução explícita para scaffolding do MVP.
- Backlog autoritativo: `docs/backlog.md`.

## Próximo passo recomendado

⭐ Dar a instrução explícita de scaffolding e do primeiro MVP (chat com o Narrador e o caso do ferreiro). Em paralelo, propagar os ADRs 068 e 069 nos documentos.
