# Handoff — estado atual do Henduran

Atualizado em 2026-11-22 após a tarefa `esbocos-ui-mvp`.

## Estado

- Tarefa: análise dos esboços visuais e fechamento de decisões do escopo do MVP.
- Resultado: documentação; nenhum código. Escopo do MVP aprovado pelo responsável, com pontos em aberto listados.
- Branch: `docs/esbocos-ui-mvp` (PR aberto contra `main`), com as 3 imagens de esboço incluídas por decisão do responsável.

## Decisões vigentes

- **Stack (ADR-001):** Tauri, React + TypeScript, PixiJS, Python, só Windows. Scaffolding e prova de conceito exigem instrução explícita.
- **UI (ADR-069):** pixel art em CSS com tokens próprios, sem tileset; resolução e acessibilidade no ADR-068.
- **IA local (ADR-070 a 072):** `llama-server` + GGUF, local gratuito primeiro e API paga depois; `NarratorProvider`; HTTP local com SSE.
- **Caliope:** uso autorizado pelo autor; ordem de importação `llm.py`, `runtime.py` + `hardware.py`, `modelhub.py`; todas as skills entram.
- **MVP (`docs/main/planejamento/ESCOPO-MVP.md`):** itens PROPOSTO aprovados em 2026-11-22. Chatbot sobre o loop de gameplay, gerador simples de mundo, criação de personagem sem atributos, dois Narradores (o Geral abre as Cenas). Sem combate, mapas, economia nem testes.
- **Narrador Geral:** opção C (painel recolhido no canto inferior direito + `@` na Cena). Desenho proposto em `docs/ui-ux/esbocos/ANALISE-ESBOCOS.md`, seção 3.
- **Esboços:** referência visual não normativa, só para dar a ideia da UI.

## Pendências relevantes

- Origem das ilustrações (menu, cenas, retratos): placeholders no MVP até decidir.
- Campos do gerador de mundo e nome final do Narrador Geral.
- Detalhes do `@` e quais telas e abas entram.
- Reconciliar `docs/ui-ux/03-mapa-de-telas.md` e `04-wireframes.md` com o escopo.
- Revisar exemplos do ferreiro restantes em 01, 02 e GDD.
- Registrar por escrito a autorização do Caliope e pedir `LICENSE`.
- Backlog autoritativo: `docs/backlog.md`.

## Próximo passo recomendado

⭐ Fechar os pontos em aberto da seção 6 do escopo e dar a instrução explícita de scaffolding para o dev começar o esqueleto Tauri + React + Python.
