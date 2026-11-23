# Handoff — estado atual do Henduran

Atualizado em 2026-11-22 após a tarefa `baixar-modelos`.

## Estado

- Tarefa: baixar modelos de dentro do app (Tarefa B), sobre o motor local da Tarefa A.
- Resultado: `backend/` (250 testes, 1 pulado) e `app/` (53 testes) passam. Teste real do dev: busca, download com retomada e SHA-256, chat, pasta extra e remoção, sem processo órfão. O responsável testou e confirmou que funciona, mas a interface está num estágio inicial e a busca e o funcionamento ainda estão longe do nível do Caliope. Só modo dev: o empacotamento do Python segue em aberto.
- Branch: `feat/baixar-modelos` (PR aberto contra `main`).

## Decisões vigentes

- **Stack (ADR-001):** Tauri, React + TypeScript, PixiJS, Python, só Windows. Scaffolding exige instrução explícita.
- **UI (ADR-069):** pixel art em CSS com tokens próprios; ADR-068 para resolução e acessibilidade; ambiente de dia e noite em código (`docs/ui-ux/07-ambiente-dia-noite.md`).
- **IA local (ADR-070 a 072):** `llama-server` + GGUF, local primeiro e API paga depois; `NarratorProvider`; HTTP com SSE.
- **Caliope:** uso autorizado pelo autor; ordem de importação `llm.py`, `runtime.py` + `hardware.py`, `modelhub.py`; todas as skills entram.
- **MVP (`docs/main/planejamento/ESCOPO-MVP.md`):** chatbot sobre o loop de gameplay, dois Narradores (o Geral, **Aduran**, abre as Cenas), gerador de mundo e regras do Astra em três fatias: (1) chat, ficha, testes, Vontade, Convicções e Descanso; (2) equipamento, Carga e Progressão; (3) combate sem mapa e NPCs por orçamento sem Capacidades.
- **Dia do Mundo (ADR-073):** limitador de benefícios, começando no Amanhecer; o gatilho continua sendo o acontecimento validado (ADR-010, 012, 013). Ambição e Desejo podem ser trocados quando deixarem de fazer sentido, sem recompensa pela troca.
- **Fatia 1:** 22 Perícias de mundo medieval (sem Dirigir, Pilotar e Conhecimento Específico); sem dano de Vida, Tratamento e Condições; rerrolagem gratuita por Convicção excluída (ADR-013); testes fora de combate com confirmação do jogador (ADR-006).

## Código existente

- `backend/henduran/`: `providers/` (`NarratorProvider`, `FakeNarratorProvider`, `LocalLlamaProvider`), `ai/` (`llm_client.py`, `engine.py`, `hardware.py`, adaptados do Caliope), `paths.py` (dados em `%LOCALAPPDATA%\Henduran`), `settings.py` (JSON provisório), `api/app.py` (chat em SSE, `/hardware`, `/models`, `/engine/*`, Bearer obrigatório) e `__main__.py` (`HENDURAN_PROVIDER=fake|local`).
- `app/src/`: abas **Chat** e **Modelos** (hardware, baixar o motor, lista de `.gguf`, usar modelo), aviso de motor no Chat, sem visual pixel art. `app/src-tauri/`: gera o token, inicia o Python e o encerra junto, com Job Object do Windows.
- Registro das importações: `docs/main/importacoes-caliope.md`. O `llama-server` baixado só escuta em loopback e exige chave por execução; o download do motor exige SHA-256 verificado.
- `ai/modelhub.py` (do Caliope): busca no Hugging Face, arquivos por quantização com tamanho e licença, download retomável com SHA-256, remoção e pastas extras; rotas `/hub/*` e `/models/folders`. No app, a aba Modelos ganhou busca, painel de downloads e pastas de modelos.
- Rodar: `cd app; npm run tauri dev`. Testes: `backend\.venv\Scripts\python -m pytest` e `npm run test`.
- Formato do evento `done` provisório (`reason`: completed ou cancelled); ADR-072 segue aberto nesse ponto.

## Pendências relevantes

- **Aba Modelos no nível do Caliope** (feedback do responsável): abas separadas, escolha de pasta pelo Windows, notas de qualidade por quantização, sugestões de busca, ocultar modelos, tela inicial sem modelo e ajustes de contexto e camadas da GPU. Detalhes no backlog.
- Decisões da Tarefa B em aberto: remover modelo de pasta extra é sempre recusado; download sem SHA-256 publicado só avisa no log; um download por vez, sem fila.
- Excluir `app/src-tauri/target/` e `node_modules/` da sincronização do OneDrive.
- `aria-live` cobre o log inteiro: reavaliar quando a interface real for montada. Dependências transitivas do Python não estão travadas.
- Limiares do indicador de compatibilidade (`fit`) são proposta a validar; variante do motor por hardware e comportamento sem GPU seguem em aberto (ADR-070); confirmar a licença do `llama-server` antes de distribuir; `settings.json` é provisório até o SQLite; sem limite de `max_tokens`.

- Pendentes de regra: faixa de Dificuldade proposta pelo Narrador; critério de "progresso significativo" e de "defender" uma Convicção; política de avanço de tempo e definição de Amanhecer; testes de equilíbrio dos tetos por Dia.
- Fatias 2 e 3 do Astra: ler e adaptar (equipamento, Carga, Progressão; Cena Tática sem mapa, Ações, dano, NPCs por orçamento, Condições necessárias).
- Telas sem decisão: Mundos no menu, Mapa, Inventário; histórico do painel do Aduran; marcas de escrita do chat.
- Confirmar *arandu* com dicionário ou falante de guarani.
- Reconciliar `docs/ui-ux/03-mapa-de-telas.md` e `04-wireframes.md`; revisar exemplos do ferreiro em 01, 02 e GDD.
- Registrar a autorização do Caliope por escrito e pedir `LICENSE`.
- Backlog autoritativo: `docs/backlog.md`.

## Próximo passo recomendado

⭐ Persistência SQLite (ADR-050), depois menu inicial, gerador de mundo e criação de personagem (fatia 1 do Astra). Em paralelo: subir a aba Modelos ao nível do Caliope, a UI pixel art (ADR-069) e a leitura da fatia 2 do Astra.
