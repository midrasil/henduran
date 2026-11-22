# Handoff — estado atual do Henduran

Atualizado em 2026-11-22 após a tarefa `mvp-fatias-astra`.

## Estado

- Tarefa: recorte das regras do Astra no MVP, em fatias.
- Resultado: documentação; nenhum código; regras do Astra ainda não adaptadas nem aprovadas.
- Branch: `docs/mvp-fatias-astra` (PR aberto contra `main`).

## Decisões vigentes

- **Stack (ADR-001):** Tauri, React + TypeScript, PixiJS, Python, só Windows. Scaffolding exige instrução explícita.
- **UI (ADR-069):** pixel art em CSS com tokens próprios; ADR-068 para resolução e acessibilidade; ambiente de dia e noite em código (`docs/ui-ux/07-ambiente-dia-noite.md`).
- **IA local (ADR-070 a 072):** `llama-server` + GGUF, local primeiro e API paga depois; `NarratorProvider`; HTTP com SSE.
- **Caliope:** uso autorizado pelo autor; ordem de importação `llm.py`, `runtime.py` + `hardware.py`, `modelhub.py`; todas as skills entram.
- **MVP (`docs/main/planejamento/ESCOPO-MVP.md`):** chatbot sobre o loop de gameplay, com dois Narradores (o Geral, **Aduran**, abre as Cenas), gerador de mundo e regras do Astra em **três fatias**: (1) chat, ficha e testes; (2) equipamento, progressão e descansos; (3) combate sem mapa e NPCs por orçamento.
- **NPCs:** montados por orçamento (Capanga, Par, Veterano, Elite), Narrador propõe e motor valida; sem Competências, Capacidades nem Pontos de Capacidade.
- **Fora do MVP:** Competências e Capacidades, grid, mapas, Diário, Bestiário pronto, NPCs Lendários.
- **Ambição e Desejo:** longo prazo e curto prazo, 1 de cada por vez.

## Astra (leitura feita)

Clone de leitura em pasta temporária (commit `1c51aea`), fora do repositório. Lidos: Readme, Reserva de Dados, criação de personagem, índice de Personagens, Ambição e Desejo, Criação de NPCs, A Cena, Cenas Táticas, Ação. Não lidos: Perícias, Vida, Vontade, Condições, Equipamentos, Confrontar, Manobras, Aguardar, Movimentação, Progressão.

## Pendências relevantes

- Ler e adaptar a fatia 1 do Astra e criar `rules/` com aprovação por seção; resolver "sessão" vs "Cena" na regra de Ambição.
- Condições, tipos de dano e Ações avançadas por fatia.
- Telas sem decisão: Mundos no menu, Mapa, Inventário; histórico do painel do Aduran; marcas de escrita do chat; detalhes do ambiente de dia e noite.
- Confirmar *arandu* com dicionário ou falante de guarani.
- Reconciliar `docs/ui-ux/03-mapa-de-telas.md` e `04-wireframes.md`; revisar exemplos do ferreiro em 01, 02 e GDD.
- Registrar a autorização do Caliope por escrito e pedir `LICENSE`.
- Backlog autoritativo: `docs/backlog.md`.

## Próximo passo recomendado

⭐ Ler a fatia 1 do Astra (Atributos, Perícias, Vida, Vontade, Convicções e Pilares) e preparar as seções adaptadas para aprovação. Depois, instrução explícita de scaffolding.
