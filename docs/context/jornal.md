# Jornal da esteira

Registro cronológico, cumulativo e conciso da execução do projeto. Este arquivo documenta o que aconteceu; `docs/backlog.md` continua sendo a lista autoritativa e ordenada de pendências.

## 2026-11-23 — `largura-mensagens-chat`

- Rota: conversa com o planejador → ajuste direto → Entrega.
- Pedido do responsável: mensagens do Narrador e do jogador não usavam todo o espaço útil e quebravam linha cedo.
- Diagnóstico: `.msg` limitava a `68ch`, mas a unidade era medida na Pixelify Sans de 16 px herdada de `.jscreen`, enquanto o corpo usa Crimson Pro de 20 px; na janela padrão de 1024 px isso ocupava cerca da metade da coluna central.
- Decisões do responsável: usar 100% da largura disponível (em vez de limite de ~80 caracteres ou versão híbrida) e sincronizar protótipo e documentação; por isso a fala do jogador continua com balão ajustado ao texto e teto de 100%.
- Resultado: `.msg { max-width: 100% }` e `.msg--player { width: fit-content; max-width: 100% }`; regras equivalentes no protótipo aprovado e nota sobre a largura em `09-tela-da-jornada.md`.
- Validações: `npm run test` (275/275) e `npm run typecheck` passaram. A conferência visual no app real fica com o responsável, porque jsdom não calcula layout.
- Arquivos: `app/src/screens/journey/JourneyScreen.css`, `docs/ui-ux/prototipos/tela-da-jornada.html`, `docs/ui-ux/09-tela-da-jornada.md`, `docs/context/handoff.md`.
- Entrega: PR [#25](https://github.com/midrasil/henduran/pull/25) aberto contra `main`.

## 2026-11-22 — `mapeamento-ui-ux`

- Rota: PM → Tech Lead → Dev → Revisor → QA → Entrega.
- Resultado: mapeamento completo de UI/UX, sem implementação de telas definitivas e sem alteração de gameplay ou ADRs.
- Inventário: 1.917 arquivos Franuka — 1.907 PNG, 6 GIF, 3 TTF e 1 TXT; nenhum atlas ou metadado formal encontrado.
- Entregáveis: sete documentos em `docs/ui-ux/`, manifesto exaustivo, catálogo HTML local e inspetor determinístico.
- Revisão: aprovada na segunda rodada após corrigir a classificação da stack candidata e esclarecer o escopo da validação de escalas.
- QA: passou nos 12 critérios; 1.262 comparações dimensionais sem exceções no escopo documentado, zero links quebrados e geração determinística.
- Entrega: commits `1bfa7e3` e `08c2c6d`; PR [#1](https://github.com/midrasil/henduran/pull/1) aberto contra `main`.
- Ocorrência posterior: o Dev econômico ficou indisponível para integrar estes registros porque o executor externo bloqueou o envio do contexto; o ajuste foi assumido pelo Dev interno.

## 2026-11-22 — `reconciliar-stack`

- Rota: ADR/decisão → orquestrador escreve → Revisor → Entrega.
- Resultado: reconciliada a contradição entre o ADR-001 (stack aprovada) e `AGENTS.md`, `04-arquitetura.md`, `06-plano-inicial.md` e docs de UI/UX (que ainda diziam "candidata"). Nenhum ADR novo; nenhuma decisão de produto nova.
- Regra adotada: stack base (Tauri, React/TS, PixiJS, Python, só Windows) aprovada; motor Astra, protocolo frontend↔Python, empacotamento do Python, hardware e atualização seguem em aberto; scaffolding e prova de conceito exigem instrução explícita; a prova de conceito valida o ADR-001 e resolve motor, protocolo e empacotamento; demais itens em aberto (modelos, hardware, atualização, llama.cpp/GGUF) estão listados em `04-arquitetura.md`.
- Observação: os registros históricos em `docs/esteira/mapeamento-ui-ux/` foram preservados e ainda dizem "candidata".
- Ocorrência: o grafo foi gerado com `/graphify` (343 nós, 18 comunidades); o catálogo HTML Franuka ficou como parcial no cache.
- Revisão: reprovada na 1ª rodada (contradição nova com ADR-050 e resquício no GDD:449), aprovada na 2ª. Relatório em `docs/esteira/reconciliar-stack/04-revisao.md`. QA não aplicável (somente documentação).

## 2026-11-22 — `adr-068-resolucao-base`

- Rota: ADR/decisão → Tech Lead → orquestrador escreve → Revisor → Entrega.
- Resultado: ADR-068 aprovado com escolha explícita do responsável: layout fluido com variantes inteiras de sprite (alternativa B) e WCAG 2.2 AA no DOM com alvo de 44 px nos controles primários e reduced motion obrigatório (AC-2).
- Não decidido: janela mínima, breakpoints, proporção de painéis, texto base, viewport tático, definição de "controles primários"; dependem de prova de conceito (backlog).
- Insumos: `docs/esteira/adr-068-resolucao-base/02-plano-tecnico.md`.
- Revisão: reprovada na 1ª rodada (5 bloqueantes: branch desatualizada em relação ao PR #2, descrição de AC-1, critérios WCAG 1.4.4/1.4.10, extrapolação do alvo de 44 px, listas de propagação); correções aplicadas e aprovado na 2ª rodada. Relatório em `docs/esteira/adr-068-resolucao-base/04-revisao.md`. QA não aplicável (somente documentação).

## 2026-11-22 — `adr-ui-pixel-art-css`

- Rota: conversa com o planejador → orquestrador escreve → Entrega.
- Resultado: ADR-069 aprovado por decisão explícita do responsável (opção 1): UI do MVP em pixel art feita com CSS e tokens próprios, sem tileset. Substitui parcialmente o ADR-017, que fica com estado "parcialmente substituída".
- Porquê: licença do pacote Franuka não verificada para Git público e executável; sprites de moldura combinam mal com layout fluido e escala de texto (ADR-068); cobertura do pacote nunca confirmada. O responsável mantém o pacote local; a decisão não é definitiva e os componentes ficam agnósticos à origem da moldura para permitir 9-slice ou Franuka depois.
- Efeito no ADR-068: permanece; sprites 1x/2x/3x valem só para mapa e tokens em PixiJS.
- Arquivos: `docs/main/decisoes/ADR-069-ui-pixel-art-css-sem-tileset.md`, `docs/main/decisoes/ADR-017-biblioteca-ui-pixel-art.md`, `docs/backlog.md`.
- Não feito: propagação nos demais documentos (backlog). Sem revisão formal nem QA (somente documentação).

## 2026-11-22 — `auditoria-caliope`

- Rota: conversa com o planejador → orquestrador escreve → Entrega.
- Resultado: auditoria técnica do Caliope (commit `1cab9e0`) concluída por leitura de estrutura e interfaces; sem execução de testes e sem código importado. Relatório em `docs/main/auditoria-caliope.md`.
- Achados: repositório sem `LICENSE`, mas com autorização do autor, amigo do responsável; módulos de IA (`llm`, `runtime`, `hardware`, `modelhub`) têm fronteira limpa; `engine.py`, combate e regras não devem entrar.
- Decisões do responsável: llama.cpp + GGUF local primeiro e API paga depois; `NarratorProvider`; HTTP com SSE; todas as skills entram, inclusive conteúdo adulto; MVP sobre o loop de gameplay (menu inicial, mundo genérico, criação de personagem, só chat); caso do ferreiro retirado dos planos.
- Cuidado registrado: a permissão do autor cobre o código dele, não licenças de terceiros nas skills; preservar atribuições.
- Arquivos: `docs/main/auditoria-caliope.md`, `docs/backlog.md`.

## 2026-11-22 — `mvp-escopo-adrs-ia`

- Rota: conversa com o planejador → orquestrador escreve → Entrega.
- Resultado: ADR-070 (llama.cpp + GGUF local), ADR-071 (`NarratorProvider`), ADR-072 (HTTP + SSE) aprovados; `ESCOPO-MVP.md` escrito; `04-arquitetura.md`, AGENTS.md, plano e GDD ajustados.
- Decisões do responsável: MVP em chatbot sobre o loop de gameplay com menu inicial, gerador simples de mundo (evoluir depois para algo como o Azgaar's Fantasy Map Generator) e criação de personagem; dois Narradores já no MVP, sendo o Geral quem abre as Cenas; apresentação do Narrador Geral por chat recolhido no canto inferior direito e/ou `@` na Cena, ainda a decidir com esboços visuais; caso do ferreiro retirado como referência do MVP.
- Cuidados: sem atributos nem economia no MVP porque as regras Astra adaptadas não estão aprovadas; exemplos do ferreiro em 01, 02 e GDD mantidos como ilustração.
- Arquivos: `docs/main/decisoes/ADR-070..072`, `docs/main/planejamento/ESCOPO-MVP.md`, `docs/main/04-arquitetura.md`, `AGENTS.md`, `docs/backlog.md`.

## 2026-11-22 — `esbocos-ui-mvp`

- Rota: conversa com o planejador → orquestrador escreve → Entrega.
- Resultado: análise de três esboços visuais (menu inicial, Nova Jornada, Jornada em andamento) em `docs/ui-ux/esbocos/ANALISE-ESBOCOS.md`; `ESCOPO-MVP.md` atualizado.
- Decisões do responsável: opção C para o Narrador Geral (painel recolhido no canto inferior direito e `@` na Cena); itens PROPOSTO do escopo aprovados; esboços são só referência visual; imagens incluídas no repositório.
- Achados: o esboço traz atributos, PV/PM, testes, dados, inventário e mapa, fora do MVP por depender de regras Astra não aprovadas; ilustrações exigem assets que o CSS do ADR-069 não produz.
- Pendente: origem das ilustrações, campos do gerador de mundo, nome do Narrador Geral, detalhes do `@`.
- Arquivos: `docs/ui-ux/esbocos/`, `docs/main/planejamento/ESCOPO-MVP.md`, `docs/backlog.md`.

## 2026-11-22 — `decisoes-narrador-ambiente`

- Rota: conversa com o planejador → orquestrador escreve → Entrega.
- Resultado: `ESCOPO-MVP.md` atualizado; novo `docs/ui-ux/07-ambiente-dia-noite.md`; `ANALISE-ESBOCOS.md` ajustada.
- Decisões do responsável: ilustrações substituídas por ciclo de dia e noite em código, refletindo a última Jornada; `@` responde no próprio chat da Cena com destaque e botão de ocultar (inspirado no `/pergunta` do Caliope); gerador de mundo sorteia e o jogador edita, com 3 a 5 lugares iniciais; nome Aduran para o Narrador Geral (delegado ao planejador); Diário fora, Objetivos e Anotações dentro; regras do Astra entram no MVP.
- Impacto: a decisão de "sem atributos" do escopo foi superada; o recorte de regras do Astra virou o principal item do backlog e o maior risco de crescimento do MVP.
- Cuidado: o significado de *arandu* precisa ser confirmado antes de entrar em texto do jogo.
- Arquivos: `docs/main/planejamento/ESCOPO-MVP.md`, `docs/ui-ux/07-ambiente-dia-noite.md`, `docs/ui-ux/esbocos/ANALISE-ESBOCOS.md`, `docs/backlog.md`.

## 2026-11-22 — `mvp-fatias-astra`

- Rota: conversa com o planejador → orquestrador escreve → Entrega.
- Resultado: `ESCOPO-MVP.md` com as regras do Astra em três fatias jogáveis; backlog ajustado.
- Decisões do responsável: recorte ampliado com equipamento, progressão e descansos; combate no MVP, sem mapa (o Astra permite combate conduzido de forma narrativa); NPCs montados por orçamento pelo motor e pelo Narrador, sem lista pronta e no modelo do personagem (sem Competências, sem Capacidades); Condições e demais regras em fatias.
- Esclarecimento de regra: Ambição é de longo prazo e Desejo é de curto prazo.
- Riscos registrados: volume de regras do núcleo e erro de conta de modelos locais ao propor NPCs.
- Arquivos: `docs/main/planejamento/ESCOPO-MVP.md`, `docs/backlog.md`.

## 2026-11-22 — `rules-fatia-1`

- Rota: conversa com o planejador → orquestrador escreve → Entrega.
- Resultado: ADR-073 e nove rascunhos de regras em `docs/esteira/rules-fatia-1/`; ADR-010 e ADR-011 ganharam nota de estado; escopo e backlog atualizados.
- Decisões do responsável: Dia do Mundo, começando no Amanhecer; Ambição e Desejo trocáveis quando deixam de fazer sentido; 22 Perícias de mundo medieval; Conhecimento Específico fora do sistema; fatia 1 sem dano de Vida e Condições; Descanso Prolongado na fatia 1; interpretações propostas pelo Narrador, registradas pelo motor e contestáveis pelo jogador; testes fora de combate confirmados pelo jogador.
- Ocorrência: ao propor as opções de "sessão" eu não havia lido os ADRs 010 a 013, que já tratavam do tema. O conflito foi reportado antes de escrever as regras e resolvido com o Dia do Mundo como limitador, mantendo o acontecimento validado como gatilho.
- Arquivos: `docs/main/decisoes/ADR-073-dia-do-mundo-limitador-troca-de-objetivos.md`, `docs/esteira/rules-fatia-1/`, `docs/main/planejamento/ESCOPO-MVP.md`, `docs/backlog.md`.

## 2026-11-22 — `rules-fatia-1-aprovada`

- Rota: conversa com o planejador → orquestrador escreve → Entrega.
- Resultado: as regras da fatia 1 foram aprovadas pelo responsável e movidas de `docs/esteira/rules-fatia-1/` para `rules/`, com status e versão `fatia-1`. `rules/README.md` virou o índice da wiki, com convenções e decisões de apoio.
- Ocorrência: o PR dos rascunhos foi mesclado antes da aprovação, então a movimentação foi levada para uma branch nova sobre a `main`.
- Pendências mantidas como PENDENTE nos textos: faixa de Dificuldade, critérios de "progresso significativo" e "defender" uma Convicção, política de avanço de tempo, definição de Amanhecer, testes de equilíbrio dos tetos por Dia.
- Arquivos: `rules/`, `docs/main/planejamento/ESCOPO-MVP.md`, `docs/backlog.md`.

## 2026-11-22 — `esqueleto-mvp`

- Rota: conversa com o planejador → Dev → Entrega.
- Resultado: primeiro código do projeto. `backend/` (FastAPI, `NarratorProvider`, provedor falso, SSE, cancelamento, token por execução, só loopback) e `app/` (React + TypeScript, chat mínimo com streaming e cancelar; shell Tauri 2 que inicia e encerra o Python com Job Object do Windows).
- Validações: 24 testes do backend e 25 do frontend passaram, conferidos pelo planejador; o dev relatou `cargo check`, `clippy`, `cargo test` e builds de debug e release passando e a janela real exercitada, inclusive sem processo órfão após fechar e após `taskkill /F`. Aparência visual e leitor de tela não verificados.
- Decisões: Tauri 2.12 estável (o 3.x está em alpha); formato do evento `done` provisório; Python só em modo dev, empacotamento em aberto.
- Ocorrências: uma asserção do teste de desconexão foi corrigida (a geração parava por `CancelledError` antes de o evento ser marcado); o shell cria o processo suspenso para associá-lo ao Job Object sem corrida.
- Riscos: `target/` e `node_modules/` na pasta do OneDrive; `aria-live` no log inteiro.
- Arquivos: `backend/`, `app/`, `.gitignore`.

## 2026-11-22 — `modelo-local-motor`

- Rota: conversa com o planejador → Dev → Entrega.
- Resultado: Narrador real e local (Tarefa A). Importados e adaptados `llm.py`, `runtime.py` e `hardware.py` do Caliope (commit `1cab9e0`) em `backend/henduran/ai/`, mais `LocalLlamaProvider`, rotas `/hardware`, `/models` e `/engine/*`, e as abas Chat e Modelos no app. Registro em `docs/main/importacoes-caliope.md`.
- Validações: 143 testes do backend e 42 do frontend passaram, conferidos pelo planejador. O dev relatou teste real com o Qwen2.5-0.5B-Instruct (491 MB) na RX 5700 e motor Vulkan b12638 (37 MB, SHA-256 conferido): streaming, Cancelar, parada do motor, e nenhum processo órfão após fechar a janela e após `taskkill /F`. Aparência visual e leitor de tela não verificados.
- Decisões: sem modelo padrão fixo (o jogador escolhe); variante Vulkan por padrão, com CPU como alternativa; motor só baixado por ação explícita, com digest verificado ou segundo consentimento; modelos e motor em `%LOCALAPPDATA%\Henduran`.
- Achados: o `/releases/latest` do llama.cpp não serve (devolve um marcador); os builds reais são releases `b<número>`. O `/health` do `llama-server` é público mesmo com chave.
- Pendente: Tarefa B (download de modelos de dentro do app); limiares do `fit` e variante por hardware; licença do `llama-server`; `settings.json` provisório até o SQLite.
- Arquivos: `backend/henduran/ai/`, `backend/henduran/providers/local.py`, `backend/henduran/api/app.py`, `app/src/components/ModelsView.tsx`, `docs/main/importacoes-caliope.md`.

## 2026-11-22 — `baixar-modelos`

- Rota: conversa com o planejador → Dev → Entrega.
- Resultado: Tarefa B. `ai/modelhub.py` adaptado do Caliope (commit `1cab9e0`), rotas `/hub/*`, `/models/{id}` e `/models/folders`, e na aba Modelos: busca no Hugging Face, arquivos por quantização com tamanho, compatibilidade e licença, painel de downloads e pastas de modelos. Registro em `docs/main/importacoes-caliope.md`.
- Validações: 250 testes do backend (1 pulado, sem permissão de link simbólico) e 53 do frontend passaram, conferidos pelo planejador. O dev relatou teste real com o Qwen2.5-0.5B-Instruct: busca, download de 469 MB com cancelar, retomada e retomada após fechar a janela, SHA-256 conferido, chat com o motor, pasta extra sem cópia, remoção, e nenhum processo órfão após fechar e após `taskkill /F`. Não verificados: aparência visual, leitor de tela, clique físico do mouse, repositório restrito, falta de espaço e erro 429 reais.
- Feedback do responsável: tudo funcional, mas a interface está num estágio inicial e a busca e o funcionamento ainda estão longe do padrão do Caliope. Gaps registrados no backlog.
- Achados da API do Hugging Face: limite de cerca de 500 chamadas a cada 5 minutos sem login; repositório inexistente ou privado responde 401; o hash SHA-256 vem do `lfs.oid` e fica mascarado em repositórios restritos; o CDN aceita `Range`.
- Decisões da Tarefa B: remover modelo de pasta extra sempre recusado; download sem SHA-256 publicado só avisa no log; um download por vez; sem token do Hugging Face (repositórios restritos aparecem como não suportados).
- Arquivos: `backend/henduran/ai/modelhub.py`, `backend/henduran/api/app.py`, `app/src/components/HubSearch.tsx`, `app/src/components/DownloadsPanel.tsx`, `app/src/components/ModelFolders.tsx`.

## 2026-11-23 — `persistencia-sqlite`

- Rota: conversa com o planejador → Dev (em cópia de trabalho isolada) → Entrega.
- Resultado: `backend/henduran/db/` com `Database` (WAL, `foreign_keys`, escritor único, leituras só de leitura), migrações numeradas com checksum, backup antes de migrar (5 mais recentes), proteção contra banco mais novo e recuo para banco corrompido sem apagar nada. O `settings.json` passou para a tabela `settings`, com importação única e arquivo renomeado para `.migrado`. `/health` ganhou `database: {schema_version, recovered}`. Código de saída 4 para falha do banco.
- Validações: 298 testes passaram, conferidos pelo planejador. O dev relatou teste real com pasta de dados com espaço e acento: importação do legado (descartando um valor inválido), persistência após reiniciar.
- Achado do dev: fechar uma conexão de escrita sobre um arquivo inválido faz o SQLite apagar o `-wal`; por isso a checagem de um arquivo existente usa conexão somente leitura.
- Decisões propostas no ADR-074 (aguardando aprovação): PRAGMAs, migrações só para frente, backup antes de migrar, política provisória de corrupção.
- Pendente: um banco por Jornada ou único; política de corrupção e durabilidade com dados de jogo; Ctrl+C real no Windows não testado.
- Arquivos: `backend/henduran/db/`, `backend/henduran/settings.py`, `backend/tests/test_db.py`, `docs/main/decisoes/ADR-074-fundacao-sqlite-migracoes-backup.md`.

## 2026-11-23 — `base-ui-pixel-art`

- Rota: conversa com o planejador → Dev → Entrega. Feita em paralelo com `persistencia-sqlite`.
- Resultado: base de UI em pixel art em CSS com tokens próprios (ADR-069). Tokens com paleta amostrada dos esboços, fontes locais Pixelify Sans e Crimson Pro (SIL OFL, com licença junto), 11 componentes em `app/src/ui/`, `SkyBackdrop` com 6 períodos desenhado em código, shell com faixa de céu e barra de status, galeria só em desenvolvimento e as telas Chat e Modelos reescritas, com a confirmação de remover em `Dialog`. Guia em `docs/ui-ux/08-guia-de-componentes.md`.
- Validações: 167 testes do frontend (53 anteriores e 114 novos) passaram, conferidos pelo planejador, e o build de produção não leva a galeria. Um teste confere o contraste AA dos 51 pares de cores. O planejador examinou 3 das cerca de 20 capturas de tela do dev (Chat em streaming, Modelos e a galeria do céu). Não verificados: leitor de tela, DPI de 125% a 200%, reflow a 320 px.
- Decisões: fontes copiadas para o repositório, sem pacote npm; `aria-live` da conversa desligado, com região à parte anunciando início e fim da resposta; céu como faixa no topo (96, 56 ou 24 px conforme a altura da janela).
- Feedback do responsável: ainda não está na cara esperada, mas é aceitável por ser MVP. Gaps no backlog.
- Arquivos: `app/src/styles/`, `app/src/ui/`, `app/src/assets/fonts/`, `app/gallery.html`, `docs/ui-ux/08-guia-de-componentes.md`.

## 2026-11-23 — `adr-banco-por-jornada`

- Rota: conversa com o planejador → orquestrador escreve → Entrega.
- Resultado: ADR-075 aprovado. Banco do app, um banco por Jornada (com todas as ramificações dentro) e um banco por Mundo, só leitura para a Jornada e anexado em leitura. O ponto em aberto do ADR-074 (banco por Jornada ou único) foi marcado como resolvido, e a durabilidade e a política de corrupção dos bancos de jogo ficaram definidas.
- Decisão do responsável: aprovou a proposta com o banco do Mundo separado já no MVP, em vez de gravar o mundo gerado dentro do banco da Jornada e migrá-lo depois.
- Porquê: backup, exportação, exclusão e migração por Jornada viram operações sobre um arquivo (ADR-044 e 047); a corrupção fica restrita a uma Jornada; as ramificações dentro do mesmo arquivo permitem ler o passado comum por referência (ADR-059) e conferir dependências ao excluir (ADR-043); o Mundo só leitura mantém a atomicidade do ADR-049 sem transação entre bancos.
- Pendente: infraestrutura dos bancos (vários conjuntos de migrações, `journey_meta`, bloqueio, anexo do Mundo, backups por Jornada); aprovar o ADR-074; retenção dos backups, cache do catálogo, anexos grandes e `ATTACH` com FTS5 e vetores.
- Arquivos: `docs/main/decisoes/ADR-075-banco-por-jornada-e-por-mundo.md`, `docs/main/decisoes/ADR-074-fundacao-sqlite-migracoes-backup.md`, `docs/backlog.md`.

## 2026-11-23 — `bancos-jornada-mundo`

- Rota: conversa com o planejador → Dev → Entrega.
- Resultado: infraestrutura de armazenamento do ADR-075. Migrações por conjunto (`app`, `journey`, `world`) com backup antes de migrar por banco; ids em UUID estrito com proteção contra travessia; `WorldStore` e `JourneyStore`; uma Jornada aberta por vez com bloqueio do sistema operacional (`msvcrt.locking`, `O_NOINHERIT`); Mundo anexado só em leitura (`mode=ro`); `synchronous=FULL` nos bancos de jogo; dano sem recriação silenciosa, com restauração explícita de backup; `GET /journeys` e `GET /worlds`. ADR-074 aprovado nesta entrega.
- Validações: 373 testes passaram (298 anteriores e 75 novos), conferidos pelo planejador. O dev relatou teste real com pasta de dados com acento: duas Jornadas, uma corrompida de propósito (a lista mostrou `danificada` sem afetar a outra), restauração, e bloqueio liberado após `taskkill /F`. A lista de 50 Jornadas levou 212 ms.
- Correção do dev ao plano: a cópia de trabalho do `0001_initial.sql` está em CRLF por causa do `core.autocrlf`, e o código antigo gravou o checksum da versão CRLF. O checksum oficial passou a ser o normalizado (LF), mantendo aceito o valor antigo, e um `.gitattributes` mantém os `.sql` em LF.
- Achado: não existia `henduran.db` real no computador do responsável, o que indica que o app ainda não tinha sido aberto depois da persistência SQLite; a compatibilidade foi testada com uma cópia do `settings.json`.
- Decisões do dev: `confirm` com padrão `False`; nomes com limite de 200 caracteres; `delete_world` recusa se houver Jornada ilegível; `open_journey` não grava `last_journey_id` sozinho; anexo do Mundo por `ATTACH ... mode=ro` (a escrita falha), deixando `-wal` e `-shm` vazios inofensivos.
- Pendente: rotas de criar, abrir, excluir e restaurar; esquema de jogo; retenção dos backups por Jornada; cache do catálogo; anexos grandes; `ATTACH` com FTS5 e vetores.
- Arquivos: `backend/henduran/storage/`, `backend/henduran/db/`, `backend/henduran/paths.py`, `backend/tests/test_storage.py`, `.gitattributes`.

## 2026-11-23 — `api-jornada-mundo-personagem`

- Rota: conversa com o planejador → Dev → Entrega. Metade 1 do passo 2 (backend); a interface vem na metade 2.
- Resultado: `backend/henduran/rules/` com a fatia 1 em código (`RULES_VERSION = "fatia-1"`), `worldgen/` com o gerador determinístico e o esquema de Mundo v1, migração `journey/0002_character.sql`, `storage/character.py`, `services/journey_creation.py` (criação atômica com compensação entre Mundo e Jornada) e `services/session.py` (uma Jornada aberta por vez), mais as rotas de regras, mundo, personagem e Jornadas. Documento `docs/main/modelo-de-dados-jogo.md`.
- Validações: 517 testes passaram (373 anteriores e 144 novos), conferidos pelo planejador, que também rodou o gerador em três sementes e leu os resultados. O dev relatou teste real pela API: gerar mundo, validar personagem válido e inválido, criar Jornada, listar, abrir, `current`, fechar, reiniciar e reabrir. Não provado no teste real: o fechamento da Jornada num encerramento normal (só pelo teste automatizado).
- Decisões do dev: status `impossivel` incluído nos objetivos, seguindo `rules/07` e o ADR-073; abrir uma Jornada com outra aberta retorna 409; todos os textos do personagem são obrigatórios, porque o passo final da criação do Astra os lista; o esquema de Mundo v1 tem limites de tamanho e o tipo de lugar é texto livre; `character_id` com cascata nas tabelas do personagem.
- Observações do planejador: os nomes de lugar de um mundo repetem raízes e as descrições são repetitivas (backlog); excluir uma Jornada deixa o Mundo órfão (a corrigir na metade 2).
- Pendente: interface do menu e do assistente; excluir o Mundo junto; esquema de jogo além do personagem; troca de Ambição e Desejo com histórico.
- Arquivos: `backend/henduran/rules/`, `backend/henduran/worldgen/`, `backend/henduran/services/`, `backend/henduran/storage/character.py`, `backend/henduran/db/migrations/journey/0002_character.sql`, `docs/main/modelo-de-dados-jogo.md`.

## 2026-11-23 — `menu-e-nova-jornada`

- Rota: conversa com o planejador → Dev → Entrega. Metade 2 do passo 2 (interface).
- Resultado: o app passou a abrir no menu inicial. Menu com céu do período da última Jornada e cartão "Última Jornada"; assistente de Nova Jornada em 3 passos (Mundo editável, Protagonista, Revisão) com validação do servidor por campo; tela Jornadas (abrir, excluir, restaurar); Jornada aberta com abas Chat, Ficha, Mundo e Objetivos, só de leitura; comando Tauri `exit_app`; `DELETE /journeys/{id}` apaga também o Mundo quando nenhuma outra Jornada o usa.
- Validações: 222 testes do frontend (167 anteriores e 55 novos) e 521 do backend (517 e 4 novos) passaram, conferidos pelo planejador, e o build de produção segue sem a galeria. O planejador examinou 3 das 21 capturas de tela. O dev relatou o fluxo completo no app real, a exclusão (pastas de Jornada e de Mundo vazias), Sair e `taskkill /F` sem processo órfão. Não verificados: restaurar backup no app real, leitor de tela, DPI de 125% a 200%, reflow a 320 px.
- Motivo da etapa: o responsável abriu o app e não viu nada novo, porque as tarefas anteriores foram só de backend; a interface foi priorizada para tornar tudo visível, incluindo telas de leitura (Ficha, Mundo, Objetivos).
- Decisões do dev: a interface não duplica regras (vem de `GET /rules/creation` e `GET /worlds/schema`); "Distribuir ao acaso" usa o catálogo recebido; Continuar usa a Jornada salva mais recentemente se `last_journey_id` estiver vazio; `DELETE` devolve `world_deleted`, `world_id` e `world_kept_reason`; a aba Mundo marca "Você está aqui" porque a Jornada não guarda o id do lugar inicial.
- Pendente: Narrador com o contexto da Jornada (próxima etapa); id do lugar inicial; máximo de Fraturas no catálogo; seções recolhíveis no passo 1.
- Arquivos: `app/src/screens/`, `app/src/navigation.ts`, `app/src/api/journeys.ts`, `app/src/ui/`, `app/src-tauri/src/main.rs`, `backend/henduran/services/journey_deletion.py`.

## 2026-11-23 — `adr-cena-inicial`

- Rota: conversa com o planejador → planejador escreve → Entrega. Só documentação.
- Resultado: ADR-076 aprovado. Toda Jornada começa Em Cena: a primeira mensagem é do Narrador, que monta a Cena inicial no lugar inicial a partir do Mundo e do personagem, com situação livre (perseguição, taverna, rotina interrompida).
- Decisões do responsável (todas as recomendações aceitas): abertura gerada na primeira vez que a Jornada abre, para a criação não depender do modelo; duas chamadas (proposta em JSON validada pelo motor e narração em *streaming*), mais confiável com modelos locais pequenos; tom de partida sorteado pelo motor para evitar aberturas repetidas; encerramento pelo jogador ou proposto pelo Narrador e confirmado, no espírito do ADR-006; Cena inicial no lugar inicial, o que exige gravar o id dele.
- Pendente: aprovar a lista de tons de partida (item 4 do ADR, **[PROPOSTO]**); limite de mensagens no contexto; formato da proposta de encerramento e do resumo.
- Arquivos: `docs/main/decisoes/ADR-076-cena-inicial-e-ciclo-de-cena-no-mvp.md`, `docs/main/02-loop-de-gameplay.md`, `docs/main/05-narrador-ia.md`, `docs/main/planejamento/ESCOPO-MVP.md`, `docs/context/handoff.md`.
- Entrega: PR [#21](https://github.com/midrasil/henduran/pull/21) aberto contra `main`.

## 2026-11-23 — `narrador-cena-inicial` (backend)

- Rota: conversa com o planejador → Dev → Entrega. Entrega 2 do ADR-076.
- Decisões do responsável antes do dev: o motor **sorteia o período inicial** da Jornada e o passa ao Narrador; o tempo é contado em períodos, sem horas e minutos (a passagem de tempo vai para ADR próprio); lista de 6 tons de partida aprovada, com peso igual.
- Resultado: tabelas `scenes` e `messages` e `start_place_id` no `journey.db` (migração 0003); pacote `narrative/` (períodos, tons, contexto, validação de proposta e resumo); `services/narration.py`; rotas de histórico, abertura (SSE), mensagens (SSE) e encerramento; `FakeNarratorProvider.complete` com JSON.
- Decisões após o relatório do dev: a Cena e a abertura são gravadas juntas no fim da narração, para uma abertura interrompida não deixar Cena sem mensagem (o texto do ADR-076 foi corrigido); os resumos das 5 últimas Cenas encerradas entram no contexto, para o Aduran saber o que acabou de acontecer; antes da abertura, a interface desabilita digitação e envio (o serviço também recusa com `abertura_pendente`). Itens 10 e 11 acrescentados ao ADR-076.
- Validações: backend 565 passaram e 1 pulado (suíte completa pelo dev; 70 dos testes novos e alterados reexecutados pelo planejador); frontend 222 de 222 após subir o limite de tempo do `NewJourneyWizard.test.tsx` para 20 s (estourava 5 s nesta máquina). Roteiro manual com provedor falso e curl executado pelo dev. Não testado com modelo local real.
- Arquivos: `backend/henduran/db/migrations/journey/0003_scenes_messages.sql`, `backend/henduran/narrative/`, `backend/henduran/services/narration.py`, `backend/henduran/storage/scenes.py`, `backend/henduran/api/app.py`, `backend/henduran/providers/fake.py`, `backend/tests/test_narrative.py`, `backend/tests/test_api_narration.py`, `docs/main/decisoes/ADR-076-cena-inicial-e-ciclo-de-cena-no-mvp.md`, `docs/main/modelo-de-dados-jogo.md`.
- Entrega: PR [#22](https://github.com/midrasil/henduran/pull/22) aberto contra `main`.

## 2026-11-23 — `chat-da-jornada` (entrega 3a)

- Rota: conversa com o planejador → protótipo (6 rodadas) → Dev (backend) → Dev (frontend) → ajuste → Entrega.
- Lacuna encontrada no planejamento: o backend da entrega 2 só abria a Cena inicial; não havia como abrir Cenas novas a partir do Fora de Cena. Resolvido com a proposta de Cena pelo Aduran.
- Decisões do responsável: Fora de Cena o Aduran ocupa o centro; o jogador combina com o Aduran o que fará, e o Aduran avalia se a ação pede Cena e propõe (o jogador aceita ou não); só o jogador encerra Cenas (mestre auxiliar confiável); Aduran e Log por ícones no cabeçalho, sem painel flutuante; Log da Cena só com eventos dela; visual **livro** (pergaminho em Cena, margem do cronista no Aduran), teatro descartado; sem barra de abas, com barra fina (nome da Jornada, período e data, modelo, ⚙) e o **céu do período no fundo da barra**; coluna de **Arcos** (Cenas de uma Ambição) recolhível, em ordem cronológica, card só com ícone do período e nome; nome da Cena proposto pelo Narrador e renomeável; ficha mais larga com retrato recortável, Vida (coração vermelho) e Vontade (chama azul) em ícones soltos com três estados, Atributos em placas, Perícias em lista; Objetivos e Convicções só na ficha completa em abas; campos opcionais idade, altura, origem e personalidade; ações das mensagens só no hover; campo de uma linha que cresce; data no **calendário do Mundo**, sorteada na criação, em vez de "Dia N"; proposta sinalizada por marcação no texto; retrato com a imagem original, até 20 MB (por backups e memória, não segurança); toda tela nova passa por protótipo aprovado (`docs/ui-ux/10-prototipagem.md`).
- Decisão após o relatório do dev: rolagem da Ficha fora do topo não reproduzida (provável efeito da emulação de largura); o hook que desfazia rolagens sem gesto foi removido pelo planejador por risco de acessibilidade (leitores de tela rolam sem eventos de teclado); ficou só `overflow-anchor: none`.
- Validações: backend 590 passaram e 1 pulado (dev; 79 reexecutados pelo planejador); frontend 275 de 275 e typecheck (3 rodadas seguidas pelo planejador; falhas anteriores ocorreram com o app do dev ainda aberto); teste real no app pelo dev com provedor falso e 27 capturas. Não testado com modelo local real.
- Pendente (backlog): `assets\` nos backups; backend expor estado das trilhas e máximo de Fraturas; entrega 3b (`@Aduran`); ADR de passagem de tempo; prototipar Modelos, Mundo e Configurações.
- Arquivos: `docs/ui-ux/09-tela-da-jornada.md`, `docs/ui-ux/10-prototipagem.md`, `docs/ui-ux/prototipos/tela-da-jornada.html`, `docs/main/decisoes/ADR-076-cena-inicial-e-ciclo-de-cena-no-mvp.md`, `AGENTS.md`, `backend/henduran/db/migrations/journey/0004_journey_screen.sql`, `backend/henduran/narrative/`, `backend/henduran/services/narration.py`, `backend/henduran/services/portrait.py`, `backend/henduran/storage/`, `backend/henduran/api/app.py`, `app/src/screens/journey/`, `app/src/api/journeyScreen.ts`, `app/src/hooks/useJourneySession.ts`, `app/src/ui/` (PixelArt, Track, Portrait, Composer).
- Entrega: PR [#23](https://github.com/midrasil/henduran/pull/23) aberto contra `main`.

## 2026-11-23 — `prototipo-menu`

- Rota: conversa com o planejador → protótipo → Entrega. Só documentação.
- Contexto: o PR #23 (tela da Jornada) foi mergeado; o responsável decidiu revisar a UI/UX das telas existentes uma por vez, com protótipos, começando pelo menu inicial, e por enquanto **só prototipar e documentar**.
- Pedido do responsável: título e simetria, botões centralizados com a última Jornada à direita, Modelos fora dos botões (só pelo indicador do rodapé), decorações nas bordas e animação no fundo em pixel art.
- Resultado: aprovado na primeira rodada. Paisagem em tela cheia com o céu de `sky.ts`, castelos simétricos com janelas acesas, animação por período a cerca de 10 quadros por segundo e parada com *reduced motion*; cantos dourados, estandartes, rosa dos ventos dos dois lados do título; cartão com retrato, data do calendário e Cena em andamento; indicador do serviço e do modelo no rodapé abrindo Modelos.
- Pendência para a implementação: o resumo da Jornada (`GET /journeys`) precisa trazer retrato, data no calendário do Mundo e título da Cena em andamento. Configurações e Créditos entram quando existirem.
- Arquivos: `docs/ui-ux/11-menu-inicial.md`, `docs/ui-ux/prototipos/menu-inicial.html`, `docs/ui-ux/10-prototipagem.md`, `docs/ui-ux/README.md`, `docs/backlog.md`, `docs/context/handoff.md`.
- Entrega: PR [#24](https://github.com/midrasil/henduran/pull/24) aberto contra `main`.

## 2026-11-23 — `icone-do-jogo`

- Rota: conversa com o planejador → Entrega. Ícone gerado em outra máquina (pausa na prototipagem de telas); os tokens acabaram antes do registro e o responsável fez um commit provisório com o opencode.
- Resultado: ícone em pixel art (rosa dos ventos dourada, pontas roxas, medalhão escuro, aro dourado) gerado por `docs/ui-ux/icone/gerar_icone.py`; ícones do Tauri regenerados (`icon.ico` com 16, 24, 32, 48, 64 e 256 px); favicon para o navegador (`app/public/favicon.png` e `app/index.html`).
- Ocorrência e causa: o Windows seguia mostrando o quadrado azul porque o `henduran.exe` de debug não foi relinkado após a troca dos arquivos; `touch app/src-tauri/build.rs` e `cargo build` resolveram, e o ícone embutido foi conferido por extração do exe. O responsável confirmou no app.
- Decisão: não adicionar `cargo:rerun-if-changed=icons` ao `build.rs` por enquanto; registrado no handoff.
- Não testado: ícone no instalador (`npm run tauri build`).
- Arquivos: `app/src-tauri/icons/*`, `docs/ui-ux/icone/*`, `app/index.html`, `app/public/favicon.png`, `docs/context/handoff.md`.
- Entrega: PR [#26](https://github.com/midrasil/henduran/pull/26) aberto contra `main`.
