# Handoff — estado atual do Henduran

Atualizado em 2026-11-22 após a tarefa `rules-fatia-1-aprovada`.

## Estado

- Tarefa: aprovação e publicação das regras da fatia 1 do Astra em `rules/`.
- Resultado: documentação; nenhum código. As regras da fatia 1 estão **aprovadas** e publicadas em `rules/` (versão `fatia-1`).
- Branch: `docs/rules-fatia-1-aprovada` (PR aberto contra `main`).

## Decisões vigentes

- **Stack (ADR-001):** Tauri, React + TypeScript, PixiJS, Python, só Windows. Scaffolding exige instrução explícita.
- **UI (ADR-069):** pixel art em CSS com tokens próprios; ADR-068 para resolução e acessibilidade; ambiente de dia e noite em código (`docs/ui-ux/07-ambiente-dia-noite.md`).
- **IA local (ADR-070 a 072):** `llama-server` + GGUF, local primeiro e API paga depois; `NarratorProvider`; HTTP com SSE.
- **Caliope:** uso autorizado pelo autor; ordem de importação `llm.py`, `runtime.py` + `hardware.py`, `modelhub.py`; todas as skills entram.
- **MVP (`docs/main/planejamento/ESCOPO-MVP.md`):** chatbot sobre o loop de gameplay, dois Narradores (o Geral, **Aduran**, abre as Cenas), gerador de mundo e regras do Astra em três fatias: (1) chat, ficha, testes, Vontade, Convicções e Descanso; (2) equipamento, Carga e Progressão; (3) combate sem mapa e NPCs por orçamento sem Capacidades.
- **Dia do Mundo (ADR-073):** limitador de benefícios, começando no Amanhecer; o gatilho continua sendo o acontecimento validado (ADR-010, 012, 013). Ambição e Desejo podem ser trocados quando deixarem de fazer sentido, sem recompensa pela troca.
- **Fatia 1:** 22 Perícias de mundo medieval (sem Dirigir, Pilotar e Conhecimento Específico); sem dano de Vida, Tratamento e Condições; rerrolagem gratuita por Convicção excluída (ADR-013); testes fora de combate com confirmação do jogador (ADR-006).

## Pendências relevantes

- Pendentes de regra: faixa de Dificuldade proposta pelo Narrador; critério de "progresso significativo" e de "defender" uma Convicção; política de avanço de tempo e definição de Amanhecer; testes de equilíbrio dos tetos por Dia.
- Fatias 2 e 3 do Astra: ler e adaptar (equipamento, Carga, Progressão; Cena Tática sem mapa, Ações, dano, NPCs por orçamento, Condições necessárias).
- Telas sem decisão: Mundos no menu, Mapa, Inventário; histórico do painel do Aduran; marcas de escrita do chat.
- Confirmar *arandu* com dicionário ou falante de guarani.
- Reconciliar `docs/ui-ux/03-mapa-de-telas.md` e `04-wireframes.md`; revisar exemplos do ferreiro em 01, 02 e GDD.
- Registrar a autorização do Caliope por escrito e pedir `LICENSE`.
- Backlog autoritativo: `docs/backlog.md`.

## Próximo passo recomendado

⭐ Instrução explícita de scaffolding para começar o código do MVP (esqueleto Tauri + React + Python, `NarratorProvider` e importação dos módulos do Caliope). A leitura da fatia 2 do Astra pode seguir em paralelo.
