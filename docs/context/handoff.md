# Handoff — estado atual do Henduran

Atualizado em 2026-11-22 após a tarefa `reconciliar-stack`.

## Estado

- Tarefa: reconciliar a contradição sobre a stack (ADR-001 aprovada vs documentos que ainda a chamavam de candidata).
- Resultado: documentação alinhada; nenhum ADR novo; nenhum código ou scaffolding.
- Branch: `docs/reconciliar-stack` (PR a abrir contra `main` pela entrega).

## Regra vigente sobre a stack

- **Aprovada (ADR-001):** Tauri, React + TypeScript, PixiJS, Python; somente Windows na fase inicial.
- **Em aberto:** lista completa em `docs/main/04-arquitetura.md` (motor Astra, protocolo, empacotamento do Python, modelos, hardware, atualização, llama.cpp/GGUF). Banco: SQLite aprovado no ADR-050.
- **Scaffolding e prova de conceito exigem instrução explícita.** A prova de conceito valida o ADR-001 e resolve motor, protocolo e empacotamento; se inviabilizar algo, registra-se novo ADR.

## Artefatos principais

- `AGENTS.md`, `docs/main/04-arquitetura.md`, `docs/main/06-plano-inicial.md`, `docs/ui-ux/README.md`, `docs/ui-ux/02-design-system.md`, `docs/ui-ux/06-guia-implementacao.md`.
- Registros históricos em `docs/esteira/mapeamento-ui-ux/` preservados (ainda dizem "candidata").
- Grafo local em `graphify-out/` (fora do git); o catálogo HTML Franuka está marcado como parcial no cache do graphify.

## Pendências relevantes

- Resolução-base, breakpoints e acessibilidade formal (ADR).
- Distribuição legal dos assets Franuka.
- Frames e duração dos seis GIFs Franuka não foram extraídos (só dimensões).
- ADR-049:28 ainda diz que SQLite é candidato; o ADR-050 já o aprovou.
- O backlog autoritativo permanece em `docs/backlog.md`.

## Próximo passo recomendado

Decidir e registrar resolução-base, breakpoints e acessibilidade formal (ADR), primeiro item do backlog.
