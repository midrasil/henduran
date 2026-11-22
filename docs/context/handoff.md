# Handoff — estado atual do Henduran

Atualizado em 2026-11-22 após a tarefa `mvp-escopo-adrs-ia`.

## Estado

- Tarefa: ADRs de IA local (070 a 072) e escopo do primeiro MVP.
- Resultado: decisões registradas; nenhum código; escopo do MVP ainda com itens PROPOSTO a aprovar.
- Branch: `docs/mvp-escopo-adrs-ia` (PR aberto contra `main`).

## Decisões vigentes

- **Stack (ADR-001):** Tauri, React + TypeScript, PixiJS, Python, só Windows. Scaffolding e prova de conceito exigem instrução explícita.
- **UI (ADR-069):** pixel art em CSS com tokens próprios, sem tileset; resolução e acessibilidade no ADR-068.
- **IA local (ADR-070 a 072):** `llama-server` (llama.cpp) + GGUF, local gratuito primeiro e API paga depois; interface `NarratorProvider`; HTTP local com SSE.
- **Caliope:** autor autorizou o uso do código. Ordem de importação: `llm.py`, depois `runtime.py` + `hardware.py`, depois `modelhub.py`. Todas as skills entram, preservando licenças e atribuições. Auditoria em `docs/main/auditoria-caliope.md`.
- **MVP (`docs/main/planejamento/ESCOPO-MVP.md`):** chatbot sobre o loop de gameplay, com menu inicial, gerador simples de mundo (calendário, religiões, lugares iniciais, época, tom), criação de personagem sem atributos e **dois Narradores**: o Narrador Geral (Fora de Cena; declara ações, tira dúvidas, escolhe destino e **abre as Cenas**) e o Narrador da Cena. Sem combate, mapas, economia nem testes. Caso do ferreiro retirado como referência.

## Pendências relevantes

- Decidir a apresentação do Narrador Geral: chat recolhido no canto inferior direito, `@` no chat da Cena, ou as duas.
- O usuário vai colocar 3 esboços visuais em `docs/ui-ux/esbocos/` (referência visual, sem fidelidade total ao projeto).
- Aprovar os itens PROPOSTO do escopo, definir campos do gerador de mundo e o nome final do Narrador Geral.
- Revisar exemplos do ferreiro restantes em 01, 02 e GDD.
- Registrar por escrito a autorização do Caliope e pedir `LICENSE`.
- Backlog autoritativo: `docs/backlog.md`.

## Próximo passo recomendado

⭐ Ler os esboços e decidir a apresentação do Narrador Geral; depois fechar o escopo do MVP e dar a instrução explícita de scaffolding para o dev.
