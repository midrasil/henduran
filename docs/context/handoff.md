# Handoff — estado atual do Henduran

Atualizado em 2026-11-23 após a tarefa `chat-da-jornada` (entrega 3a: tela da Jornada).

## Estado

- Tarefa: nova tela da Jornada, desenhada por protótipo navegável (6 rodadas) e implementada em duas partes (backend e frontend).
- Resultado:
  - **Documentos:** `docs/ui-ux/09-tela-da-jornada.md` (aprovado), `docs/ui-ux/10-prototipagem.md` (toda tela nova passa por protótipo aprovado; regra 8 do `AGENTS.md`), protótipo em `docs/ui-ux/prototipos/tela-da-jornada.html`, ADR-076 itens 12 a 18.
  - **Backend (migração journey 0004):** título e arco das Cenas, lugares da Jornada e lugar atual, data no calendário do Mundo (sorteada na criação), proposta de Cena pelo Aduran com a marcação `[[propor_cena]]` (pendente, aceitar, pedir outra, recusar), Aduran durante a Cena (canal Fora de Cena, fora do contexto da Cena), regenerar e continuar, renomear Cena, Log (`events`), arcos, leitura de Cena, lugares com caminho, retrato (original em `assets\`, até 20 MB, PNG/JPEG/WebP pelos bytes) e campos opcionais da descrição. `HENDURAN_FAKE_PROPOSE=1` faz o provedor falso propor Cenas.
  - **Frontend:** tela sem abas, com barra superior com céu do período e data, coluna de Arcos recolhível, centro em pergaminho (Cena) ou margem do cronista (Aduran e Log), cartão de proposta, ações das mensagens no hover, campo que cresce, ficha com retrato e trilhas em ícones, ficha completa em abas, recorte do retrato, Mundo e lugares no ⚙, abas em telas estreitas; campos opcionais no assistente; galeria atualizada. Removidos `JourneyTabs`, `ChatView` e `useChat`. CSP com `blob:` em `img-src` para o retrato.
- Testes: backend 590 passaram e 1 pulado (dev, suíte completa; o planejador reexecutou 79 dos arquivos novos e alterados); frontend 275 de 275 e typecheck sem erros (o planejador rodou 3 vezes seguidas). O dev testou o fluxo inteiro no app real com o provedor falso (capturas no scratchpad da sessão).
- **Não testado com modelo local real** (marcação de proposta, instruções novas do Aduran).
- Branch: `feat/chat-da-jornada`, PR [#23](https://github.com/midrasil/henduran/pull/23) aberto contra `main`.

## Decisões vigentes

- **Stack (ADR-001):** Tauri, React + TypeScript, PixiJS, Python, só Windows. Scaffolding exige instrução explícita.
- **UI (ADR-069):** pixel art em CSS com tokens próprios; ADR-068 para resolução e acessibilidade; ambiente de dia e noite em código (`docs/ui-ux/07-ambiente-dia-noite.md`).
- **Armazenamento (ADR-075):** banco do app (`henduran.db`), `journeys\<id>\journey.db` com todas as ramificações dentro (passado comum por referência), `worlds\<id>\world.db` só leitura para a Jornada e anexado em leitura; o sistema de arquivos é o catálogo (`journey_meta` em cada Jornada); `synchronous=FULL` nos bancos de jogo; nunca recriar um banco de Jornada em silêncio; o Mundo gerado do MVP também fica num `world.db`.
- **IA local (ADR-070 a 072):** `llama-server` + GGUF, local primeiro e API paga depois; `NarratorProvider`; HTTP com SSE.
- **Caliope:** uso autorizado pelo autor; ordem de importação `llm.py`, `runtime.py` + `hardware.py`, `modelhub.py`; todas as skills entram.
- **MVP (`docs/main/planejamento/ESCOPO-MVP.md`):** chatbot sobre o loop de gameplay, dois Narradores (o Geral, **Aduran**, abre as Cenas), gerador de mundo e regras do Astra em três fatias: (1) chat, ficha, testes, Vontade, Convicções e Descanso; (2) equipamento, Carga e Progressão; (3) combate sem mapa e NPCs por orçamento sem Capacidades.
- **Dia do Mundo (ADR-073):** limitador de benefícios, começando no Amanhecer; o gatilho continua sendo o acontecimento validado (ADR-010, 012, 013). Ambição e Desejo podem ser trocados quando deixarem de fazer sentido, sem recompensa pela troca.
- **Cena inicial e ciclo de Cena (ADR-076):** Jornada começa Em Cena no lugar inicial, em período sorteado pelo motor; tempo em períodos, sem horas; abertura na primeira abertura da Jornada; 6 tons com peso igual; proposta (motivo e participantes) em JSON validada antes da narração; Cena e abertura gravadas juntas no fim; nada de mensagem do jogador antes da abertura; encerramento pelo jogador ou proposto e confirmado, com resumo; resumos das Cenas encerradas no contexto.
- **Fatia 1:** 22 Perícias de mundo medieval (sem Dirigir, Pilotar e Conhecimento Específico); sem dano de Vida, Tratamento e Condições; rerrolagem gratuita por Convicção excluída (ADR-013); testes fora de combate com confirmação do jogador (ADR-006).

## Código existente

- `backend/henduran/`: `providers/` (`NarratorProvider`, `FakeNarratorProvider`, `LocalLlamaProvider`), `ai/` (`llm_client.py`, `engine.py`, `hardware.py`, adaptados do Caliope), `paths.py` (dados em `%LOCALAPPDATA%\Henduran`), `settings.py` (sobre o banco), `db/` (conexão, migrações por conjunto, backup), `storage/` (`WorldStore`, `JourneyStore`, bloqueio, leitura sem migrar, `character.py`), `rules/` (fatia 1 em código), `worldgen/` (gerador e esquema do Mundo v1), `services/` (criação atômica e sessão da Jornada aberta). Modelo de dados em `docs/main/modelo-de-dados-jogo.md`, `api/app.py` (chat em SSE, `/hardware`, `/models`, `/engine/*`, Bearer obrigatório) e `__main__.py` (`HENDURAN_PROVIDER=fake|local`).
- `app/src/`: navegação por telas (`navigation.ts`): `menu`, `jornadas`, `nova-jornada`, `modelos` e `jornada` (abas Chat, Ficha, Mundo, Objetivos). Telas em `screens/` (`MainMenu`, `JourneysScreen`, `newJourney/`, `journey/`), cliente de API em `api/journeys.ts`, validação do servidor em `hooks/useServerValidation.ts`, componentes novos em `ui/` (`Select`, `RadioGroup`, `FieldGroup`, `Stepper`, `TrailBoxes`), tudo na galeria. A interface não duplica regras: vem de `GET /rules/creation`. O fixture de testes `app/src/test/gameData.ts` é gerado do backend e precisa ser regerado se as regras mudarem. `app/src-tauri/`: gera o token, inicia o Python e o encerra junto, com Job Object do Windows.
- Registro das importações: `docs/main/importacoes-caliope.md`. O `llama-server` baixado só escuta em loopback e exige chave por execução; o download do motor exige SHA-256 verificado.
- `ai/modelhub.py` (do Caliope): busca no Hugging Face, arquivos por quantização com tamanho e licença, download retomável com SHA-256, remoção e pastas extras; rotas `/hub/*` e `/models/folders`. No app, a aba Modelos ganhou busca, painel de downloads e pastas de modelos.
- Rodar: `cd app; npm run tauri dev`. Testes: `backend\.venv\Scripts\python -m pytest` e `npm run test`.
- Formato do evento `done` provisório (`reason`: completed ou cancelled); ADR-072 segue aberto nesse ponto.

- **Base de UI** (`docs/ui-ux/08-guia-de-componentes.md`): `app/src/styles/` (tokens, fontes, base, shell), `app/src/ui/` (Button, Panel, Tabs, ProgressBar, ListCard, TextField, Badge, Dialog, ChatBubble, SkyBackdrop), fontes locais em `app/src/assets/fonts/` e galeria em `app/gallery.html` (só em desenvolvimento). O `docs/ui-ux/02-design-system.md` (Franuka) não vale mais para os tokens.

## Pendências relevantes

- Testar com modelo local real: se o Aduran usa a marcação `[[propor_cena]]` só quando a ação pede Cena e se não resolve ações incertas; revisar as instruções em `backend/henduran/narrative/context.py`.
- A rolagem da coluna da Ficha apareceu fora do topo numa captura do dev, sem reprodução (provável efeito da emulação de largura); ficou só `overflow-anchor: none`. Reavaliar se acontecer no uso real.
- Backups da Jornada não incluem `assets\` (retrato); o backend não expõe o estado das trilhas nem o máximo de Fraturas (a interface usa `FRACTURE_SLOTS = 2`). Ambos no backlog.
- Em aberto no ADR-076: formato da proposta de encerramento pelo Narrador no chat, Cena seguida de outra sem passar pelo Aduran, quando trocar mensagens recentes por resumos. Passagem de tempo em períodos vai para ADR próprio (backlog).
- Pequenos ajustes da interface: a Jornada só guarda o local atual, então a aba Mundo marca "Você está aqui" em vez do lugar inicial (gravar o id do lugar inicial); o máximo de Fraturas não vem no catálogo de regras; o passo 1 fica longo com mundos grandes (seções recolhíveis). Não verificados: restaurar backup no app real, leitor de tela, DPI de 125% a 200% e reflow a 320 px.
- O esquema de jogo além do personagem (estado, eventos, memória, salvamentos, ramificações) ainda não existe. Objetivos têm status `ativo`, `concluido`, `abandonado`, `impossivel` e `sem_sentido`; a troca e o histórico (ADR-073) ainda não foram implementados.
- Gerador de mundo: os nomes de lugar de um mesmo mundo repetem raízes (por exemplo Lumícia, Lumais e Lumanor) e as descrições são repetitivas; melhorar a variedade. Os textos ficam em `backend/henduran/worldgen/data.py`.
- Pendências da infraestrutura: a lista não roda `quick_check` (dano em outras páginas só aparece ao abrir); `delete_journey` pode deixar a pasta parcialmente apagada se um arquivo estiver preso; corrida teórica entre `world_in_use` e a exclusão do Mundo.
- Em aberto no ADR-075: retenção dos backups automáticos por Jornada, cache do catálogo, anexos grandes e o anexo do Mundo com FTS5 e vetores.
- **Visual abaixo dos esboços** (feedback do responsável): faltam ornamentos de canto, mais riqueza nas áreas de conversa e de listas, tooltip, ícones, controle de escala de texto no jogo; verificar DPI de 125% a 200%, reflow a 320 px e leitor de tela. O céu cobre só uma faixa no topo; as cores dos períodos estão em `sky.ts`, fora dos tokens.
- **Aba Modelos no nível do Caliope** (feedback do responsável): abas separadas, escolha de pasta pelo Windows, notas de qualidade por quantização, sugestões de busca, ocultar modelos, tela inicial sem modelo e ajustes de contexto e camadas da GPU. Detalhes no backlog.
- Decisões da Tarefa B em aberto: remover modelo de pasta extra é sempre recusado; download sem SHA-256 publicado só avisa no log; um download por vez, sem fila.
- Excluir `app/src-tauri/target/` e `node_modules/` da sincronização do OneDrive.
- `aria-live` cobre o log inteiro: reavaliar quando a interface real for montada. Dependências transitivas do Python não estão travadas.
- Limiares do indicador de compatibilidade (`fit`) são proposta a validar; variante do motor por hardware e comportamento sem GPU seguem em aberto (ADR-070); confirmar a licença do `llama-server` antes de distribuir; sem limite de `max_tokens`.

- Pendentes de regra: faixa de Dificuldade proposta pelo Narrador; critério de "progresso significativo" e de "defender" uma Convicção; política de avanço de tempo e definição de Amanhecer; testes de equilíbrio dos tetos por Dia.
- Fatias 2 e 3 do Astra: ler e adaptar (equipamento, Carga, Progressão; Cena Tática sem mapa, Ações, dano, NPCs por orçamento, Condições necessárias).
- Telas sem decisão: Mundos no menu, Mapa, Inventário; histórico do painel do Aduran; marcas de escrita do chat.
- Confirmar *arandu* com dicionário ou falante de guarani.
- Reconciliar `docs/ui-ux/03-mapa-de-telas.md` e `04-wireframes.md`; revisar exemplos do ferreiro em 01, 02 e GDD.
- Registrar a autorização do Caliope por escrito e pedir `LICENSE`.
- Backlog autoritativo: `docs/backlog.md`.

## Próximo passo recomendado

⭐ Testar a tela nova com um modelo local real e ajustar as instruções do Aduran e do Narrador conforme o comportamento. Depois: o backend expor o estado das trilhas e o máximo de Fraturas, `assets\` nos backups, e a Reserva de Dados com confirmação (ADR-006). Em paralelo: ADR de passagem de tempo e prototipar a tela Modelos (`docs/ui-ux/10-prototipagem.md`).
