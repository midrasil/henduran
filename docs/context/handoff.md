# Handoff — estado atual do Henduran

Atualizado em 2026-11-22 após a tarefa `decisoes-narrador-ambiente`.

## Estado

- Tarefa: decisões sobre Narrador Geral, ambiente de dia e noite, gerador de mundo, nome e abas; entrada das regras do Astra no MVP.
- Resultado: documentação; nenhum código.
- Branch: `docs/decisoes-narrador-ambiente` (PR aberto contra `main`).

## Decisões vigentes

- **Stack (ADR-001):** Tauri, React + TypeScript, PixiJS, Python, só Windows. Scaffolding exige instrução explícita.
- **UI (ADR-069):** pixel art em CSS com tokens próprios, sem tileset; ADR-068 para resolução e acessibilidade.
- **IA local (ADR-070 a 072):** `llama-server` + GGUF, local primeiro e API paga depois; `NarratorProvider`; HTTP com SSE.
- **Caliope:** uso autorizado pelo autor; ordem de importação `llm.py`, `runtime.py` + `hardware.py`, `modelhub.py`; todas as skills entram.
- **MVP (`docs/main/planejamento/ESCOPO-MVP.md`):** chatbot sobre o loop de gameplay com menu inicial, gerador de mundo (sorteia e o jogador edita), criação de personagem, dois Narradores, persistência e **regras do Astra** (recorte a definir). Sem combate e sem mapas.
- **Narrador Geral:** chamado **Aduran** (anagrama de *arandu*, "sabedoria" em guarani; confirmar significado). Painel recolhido no canto inferior direito + `@Aduran` no chat da Cena, com resposta no próprio chat, destaque diferente e botão de ocultar; fora do contexto do Narrador da Cena (proposta).
- **Ambiente:** ciclo de dia e noite desenhado em código no lugar de ilustrações, refletindo a última Jornada (`docs/ui-ux/07-ambiente-dia-noite.md`). Retratos com iniciais.
- **Abas e painéis:** Objetivos e Anotações entram; Diário não entra.

## Pendências relevantes

- **Conversa sobre as regras do Astra no MVP:** recorte mínimo, mapeamento da wiki, aprovação por seção, criação do `rules/`.
- Telas sem decisão: Mundos no menu, Mapa, Inventário.
- Histórico do painel do Aduran; marcas de escrita do chat; detalhes do ambiente (períodos, paleta, como o tempo passa).
- Confirmar *arandu* com dicionário ou falante de guarani.
- Reconciliar `docs/ui-ux/03-mapa-de-telas.md` e `04-wireframes.md`; revisar exemplos do ferreiro em 01, 02 e GDD.
- Registrar a autorização do Caliope por escrito e pedir `LICENSE`.
- Backlog autoritativo: `docs/backlog.md`.

## Próximo passo recomendado

⭐ Conversar sobre as regras do Astra no MVP e fixar o recorte mínimo; depois dar a instrução explícita de scaffolding.
