# Jornal da esteira

Registro cronológico, cumulativo e conciso da execução do projeto. Este arquivo documenta o que aconteceu; `docs/backlog.md` continua sendo a lista autoritativa e ordenada de pendências.

## 2026-11-26 — `instalador-esteira-claude` (OpenCode)

- Rota: planejador → ajuste direto → entrega.
- Resultado: `AGENTS.md` explicita o handoff do OpenCode e o padrão de escrita de PRs; `scripts/instalar-esteira-claude.ps1` instala a esteira no Claude Code e `scripts/README.md` explica o uso.
- Validações: prévia sem gravação, instalação nova, atualização com backup e preservação do texto externo ao bloco, reexecução sem duplicação e instalação local.
- Entrega: branch `chore/instalador-esteira-claude`, [PR contra `main`](https://github.com/midrasil/henduran/pulls?q=head%3Achore%2Finstalador-esteira-claude).

## 2026-11-26 — `remover-destaque-foco` (opencode)

- Executor: opencode
- Rota: planejador → ajuste direto → Entrega.
- Pedido do responsável: remover temporariamente o destaque azulado de acessibilidade que aparecia tanto ao usar teclado quanto mouse.
- Resultado: removidos os contornos e destaques visuais azuis globais e específicos de componentes; foco funcional, navegação por teclado, tooltips, hover e estados ativos foram preservados. Tokens de foco ficaram disponíveis para futura configuração.
- Arquivos: estilos em `app/src/styles/base.css`, `app/src/ui/`, `app/src/components/models/Models.css`, `app/src/screens/ServiceIndicator.css` e `app/src/screens/newJourney/NewJourney.css`; `docs/context/handoff-opencode.md`.
- Validações: `npm run typecheck`, suíte frontend com 37 arquivos/330 testes e `git diff --check` passaram.
- Entrega: branch `fix/remover-destaque-foco`; PR [#49](https://github.com/midrasil/henduran/pull/49) aberto contra `main`.

## 2026-11-24 — `remodelar-atributos-ficha` (opencode)

- Executor: opencode
- Rota: planejador → ajuste direto → Entrega.
- Pedido do responsável: remodelar os Atributos da ficha resumida da Jornada, testar ícones em pixel art e depois retornar ao formato textual aprovado: nome acima, marcadores abaixo e valor à direita, sem títulos de categoria.
- Resultado: a ficha ficou com duas listas lado a lado, agrupadas pelas categorias oficiais e ordenadas alfabeticamente; os cards foram substituídos por linhas compactas sem ícones ou títulos de categoria.
- Arquivos: `app/src/screens/journey/SheetSummary.tsx`, `app/src/screens/journey/JourneyScreen.css`.
- Validações: `npm run typecheck`, testes de `MainMenu` e `JourneyScreen` (31/31) e `git diff --check` passaram.
- Entrega: branch `fix/ficha-atributos-tamanho`; PR [#48](https://github.com/midrasil/henduran/pull/48) aberto contra `main`.

## 2026-11-24 — `ajustes-ficha-jornada` (opencode)

- Executor: opencode
- Rota: planejador → dev → Entrega.
- Pedido do responsável: ajustar a ficha expandida da personagem na Jornada: Perícias na Visão geral, Objetivos e Convicções na mesma aba com o nome Convicções, e tamanho fixo entre abas.
- Resultado: `FullSheetDialog` passou a ter as abas Visão geral, Convicções e Descrição; as 22 Perícias ficam na Visão geral; Objetivos aparecem acima das Convicções; o conteúdo rola dentro de uma ficha com altura, mínimo e máximo fixos.
- Arquivos: `app/src/screens/journey/FullSheetDialog.tsx`, `app/src/screens/journey/JourneyScreen.css`, `app/src/screens/MainMenu.test.tsx`, `docs/ui-ux/09-tela-da-jornada.md`, `docs/context/handoff.md`, `docs/context/jornal.md`.
- Validações: `npm run typecheck`, teste específico da Jornada (17/17), suíte frontend (37 arquivos, 330/330) e `git diff --check` passaram.
- Entrega: branch `feat/ajustes-ficha-jornada`; PR [#46](https://github.com/midrasil/henduran/pull/46) aberto contra `main`.

## 2026-11-24 — `rodape-modelos-status` (opencode)

- Executor: opencode
- Rota: planejador → ajuste direto → Entrega.
- Pedido do responsável: no rodapé do sistema da criação de Jornada, transformar o `Conectado` da esquerda em botão de acesso à tela Modelos, passar o período do dia para a esquerda e replicar o comportamento do botão do menu inicial.
- Correção de interpretação: a primeira implementação mexeu no rodapé de ações do assistente (`Cancelar`, `Voltar`, `Avançar`). O responsável esclareceu que o alvo era o rodapé global do sistema; por isso o wizard, o quadro `Narrador`, o CSS do assistente e o protótipo foram revertidos ao estado anterior.
- Decisão mantida: o indicador compartilhado do menu (`ServiceIndicator`) agora também aparece na barra de status, com LED, `Conectado · <detalhe> · Modelos ▸` e o mesmo `aria-label`; ao abrir Modelos a partir da Nova Jornada, o cabeçalho mostra `Voltar à criação` e o wizard fica montado, oculto, com o preenchimento preservado.
- Resultado: período à esquerda e indicador/modelo à direita nas telas com barra de status; menu inicial inalterado; rodapé de ações do assistente inalterado. Documentação da decisão em `docs/ui-ux/12-nova-jornada.md`, seção 11.
- Validações: em `app/`, `npm run typecheck` sem erros, `npm run test` 37 arquivos/330 testes passando e `npm run build` ok, todos reexecutados pelo planejador. Conferência visual no app real fica com o responsável.
- Arquivos: `app/src/App.tsx`, `app/src/styles/shell.css`, `app/src/navigation.ts`, `app/src/navigation.test.ts`, `app/src/screens/ServiceIndicator.tsx`, `app/src/screens/ServiceIndicator.css`, `app/src/screens/MainMenu.tsx`, `app/src/screens/menu/MainMenu.css`, `app/src/App.test.tsx`, `docs/ui-ux/12-nova-jornada.md`, `docs/context/handoff.md`, `docs/context/jornal.md`.
- Entrega: branch `feat/rodape-modelos-status`; PR [#44](https://github.com/midrasil/henduran/pull/44) aberto contra `main`.

## 2026-11-23 — `rodape-menu-modelo` (opencode)

- Executor: opencode
- Rota: planejador → ajuste direto → Entrega.
- Pedido do responsável: alinhar o indicador do modelo no rodapé ao restante do menu e, antes da PR, impedir que o cartão de "Sua primeira Jornada" apareça quando não há Jornada.
- Decisões do responsável: indicador sem caixa, mantendo `Conectado` e acrescentando `· Modelos ▸` como pista de clique; o cartão sem Jornada não deve existir, inclusive o texto de convite; sincronizar spec e protótipo aprovado.
- Resultado: LED + `Conectado · <detalhe> · Modelos ▸` com o mesmo `aria-label`; `LastJourneyCard` retorna `null` quando a lista carregou vazia; protótipo e `11-menu-inicial.md` ajustados; teste da primeira vez trocado por ausência de cartão.
- Ajuste posterior no mesmo PR: responsável pediu mais respiro entre os botões (12 → 16 px, `var(--space-2)`); o afastamento revelou um "quadrado" causado pela sombra externa, que foi removida, mantendo moldura e bisel em pixel.
- Validações: em worktree temporário com apenas as mudanças da tarefa, `npm run test -- src/screens/MainMenu.test.tsx` (15/15), `npm run test` (33 arquivos, 285/285) e `npm run typecheck` passaram. No worktree principal, mudanças concorrentes da Nova Jornada causaram falhas fora deste escopo (`App.tsx` importa `CreatedExtras` inexistente; `model.test.ts` espera `history_html`); foram deixadas de fora do commit. Conferência visual no app real fica com o responsável. Revalidado após o ajuste de gap/sombra: 15/15, 285/285 e `typecheck` OK no worktree do PR.
- Arquivos: `app/src/screens/MainMenu.tsx`, `app/src/screens/menu/MainMenu.css`, `app/src/screens/MainMenu.test.tsx`, `docs/ui-ux/11-menu-inicial.md`, `docs/ui-ux/prototipos/menu-inicial.html`, `docs/context/handoff.md`, `docs/context/jornal.md`.
- Entrega: branch `fix/rodape-menu-modelo`; PR [#29](https://github.com/midrasil/henduran/pull/29) foi merged; o ajuste posterior de gap e sombra foi entregue no PR [#31](https://github.com/midrasil/henduran/pull/31).
- Conflito do PR #31 resolvido em 2026-11-24: PR #29 e PR #30 tinham tocado `docs/context/handoff.md` e `docs/ui-ux/11-menu-inicial.md`. Preservado o estado atual da `main` (Nova Jornada, Mundos, PR #32/#34) junto com o ajuste do menu; o protótipo do menu também passou a incluir o botão Mundos para acompanhar a spec. Revalidado após o merge: `typecheck` OK, 17/17 no teste do menu e 321/321 na suíte.

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

## 2026-11-23 — `menu-inicial` (implementação)

- Rota: conversa com o planejador → Dev (duas rodadas: implementação e ajuste visual do fundo) → validação do responsável → Entrega.
- Resultado: menu inicial redesenhado implementado conforme o protótipo aprovado (PR #24): paisagem animada em canvas a cerca de 10 quadros por segundo, parada com *reduced motion*; cartão "Última Jornada" com retrato, data do calendário e Cena em andamento; indicador de serviço e modelo no rodapé abrindo Modelos. `GET /journeys` ganhou `calendar`, `current_scene_title` e `portrait`; nova rota `GET /journeys/{id}/portrait`.
- Decisões: campos novos opcionais para não quebrar clientes; retrato servido por rota própria com token, sem abrir a Jornada; castelos posicionados pelas larguras do CSS para não ficarem atrás do cartão (o protótipo tinha esse defeito); diferenças em relação ao protótipo registradas em `11-menu-inicial.md`, seção 5.
- Ocorrência: `test_bloqueio_contra_outro_processo_e_liberado_ao_matar` falhou uma vez na execução completa do backend e passou isolado; teste de bloqueio entre processos, arquivo não alterado.
- Em paralelo: protótipo da Nova Jornada em revisão, em outro worktree (não faz parte deste PR).
- Arquivos principais: `app/src/screens/MainMenu.tsx`, `app/src/screens/menu/*`, `backend/henduran/storage/journeys.py`, `backend/henduran/api/app.py`, `docs/ui-ux/11-menu-inicial.md`.
- Entrega: PR [#27](https://github.com/midrasil/henduran/pull/27) aberto contra `main`.

## 2026-11-23 — `prototipo-nova-jornada`

- Rota: conversa com o planejador → protótipo em várias rodadas (artifact privado, mesmo link) → aprovação → Entrega. Só documentação.
- Resultado: `12-nova-jornada.md` e `prototipos/nova-jornada.html` aprovados. Assistente de 3 passos com tela Iniciar Jornada, cartões de pergaminho com abas e altura total.
- Decisões do responsável ao longo das rodadas: modais de Mundo em altura total e lista de Mundos salvos para escolher; sem aviso fixo de "gerar outro substitui as edições"; detalhes do Mundo como campos preenchíveis à mão (semente gerada ao criar); Protagonista em abas sem cabeçalho, com retrato (a área é o botão), aparência opcional, História como aba-editor com recursos de processador de texto, botões do Narrador como no Caliope (sugerir por campo, preencher o que falta, Desfazer); Atributos e Perícias numa aba Status (Perícias em lista única, descrições em "?"); Convicção e Pilar no mesmo padrão de campo; sem botões de aba anterior ou próxima e sem lista de pendências; Avançar vai à próxima aba incompleta só quando a atual está completa; Revisão em duas abas (Mundo e Personagem); nome e descrição da Jornada numa tela própria depois dos três passos.
- Decisões minhas, a validar: Mundos salvos somente leitura com Duplicar e editar (ADR-075); mesma regra de Avançar nas abas do Mundo; sem campo de ideia nas abas de Status e História.
- Decisões fechadas depois da aprovação e registradas no ADR-077: editor TipTap enxuto para a História (o responsável perguntou por uma experiência próxima a um processador de texto, e escolheu a opção recomendada), História em HTML saneado com texto puro derivado, rota do Narrador que preenche dados (a IA propõe, o motor valida) e descrição da Jornada em `journey_meta`. Pendente na implementação: licença e tamanho do TipTap, aprovação da dependência. O texto dos botões do Narrador no protótipo é só exemplo.
- Arquivos principais: `docs/ui-ux/12-nova-jornada.md`, `docs/ui-ux/prototipos/nova-jornada.html`, `docs/ui-ux/10-prototipagem.md`, `docs/ui-ux/README.md`, `docs/backlog.md`, `docs/main/decisoes/ADR-077-nova-jornada-historia-formatada-descricao-e-narrador-que-preenche.md`.
- Entrega: PR [#28](https://github.com/midrasil/henduran/pull/28) aberto contra `main`.

## 2026-11-24 — `nova-jornada` (rodada 1)

- Rota: conversa com o planejador → Dev (rodada 1 de 2) → teste e validação do responsável → Entrega.
- Resultado: assistente de Nova Jornada implementado conforme o protótipo aprovado (PR #28) e o ADR-077: 3 passos e Iniciar Jornada, Mundos salvos, Protagonista em abas com retrato e editor provisório de História, Revisão em abas, descrição da Jornada, História em HTML saneado com texto puro derivado, criação em Mundo existente, semente do Mundo. Detalhes e diferenças no handoff e na seção 9 de `12-nova-jornada.md`.
- Decisões do responsável (2026-11-24): instalar o TipTap na rodada 2; aparência opcional com migração na rodada 2; aviso na tela se o envio do retrato falhar; botão no menu para uma lista de Mundos com criação lá dentro (precisa de protótipo).
- Decisões do dev nesta rodada: sanitizador próprio com `html.parser`, sem dependência; `formatacao_demais` para HTML saneado acima de 40.000 caracteres; semente pedida só vale se gera exatamente o conteúdo enviado; Mundos ilegíveis ficam fora da lista com um aviso.
- TipTap (só consultado): licença MIT nos pacotes que entrariam; `@tiptap/core` com 3,3 MB descompactado no npm; o StarterKit v3 traz `link` e `code`, que serão desligados.
- Ocorrência: troca de branch da pasta principal durante o trabalho (PR #29); alterações recolocadas em `feat/nova-jornada` sem conflito. O dev deixou um backend de teste na porta 8765, que pode ser fechado.
- Arquivos principais: `app/src/screens/newJourney/*`, `app/src/ui/HistoryEditor/*`, `backend/henduran/richtext.py`, `backend/henduran/services/journey_creation.py`, `backend/henduran/storage/{worlds,character,journeys}.py`, `backend/henduran/api/app.py`, migrações `journey/0005` e `world/0002`, `docs/ui-ux/12-nova-jornada.md`.
- Entrega: PR [#30](https://github.com/midrasil/henduran/pull/30) aberto contra `main`.

## 2026-11-24 — `nova-jornada` (rodada 2)

- Rota: conversa com o planejador → Dev (interrompido uma vez pelo limite de uso e retomado do ponto salvo) → teste do responsável → Entrega. A rodada 1 foi o PR #30.
- Resultado: TipTap no editor da História, rota e botões do Narrador que preenche dados, aparência opcional, aviso do retrato, Mundo personalizado, Editar Jornada e modelo inicial provisório da tela de Mundos (detalhes no handoff).
- Decisões do responsável (2026-11-24): instalar o TipTap; aparência opcional na rodada 2; aviso do retrato; botão **Mundos** no menu com lista e criação de Mundo; editar nome e descrição dentro da Jornada (opção b); Mundo editado é "Mundo personalizado" e não recebe semente; o dev cria um modelo inicial da tela de Mundos **sem protótipo**, que será feito em 2026-11-25 em outra máquina; excluir Jornada não apaga o Mundo.
- Decisões do dev aprovadas pelo responsável: editor sob demanda (o TipTap soma 404,7 kB ao JS); `extension-character-count` removido; `world/0002` não reescrita (checksum); Sugerir Atributos e Perícias só preenche o que falta; limites do Narrador (ideia 500 caracteres, 120 s, 2 novas tentativas).
- Ocorrências: o dev parou por limite de uso e foi retomado com o escopo completo; a porta 8765 já estava ocupada por outro backend, que o dev não tocou.
- Pendências: protótipo de Mundos; teste do Narrador com modelo local real; TipTap em navegador real.
- Arquivos principais: `app/src/ui/HistoryEditor/*`, `app/src/screens/newJourney/narrator.tsx`, `app/src/screens/WorldsScreen.tsx`, `app/src/screens/journey/EditJourneyDialog.tsx`, `backend/henduran/narrative/fill.py`, `backend/henduran/services/{fill,journey_edit,world_library,journey_deletion}.py`, migração `journey/0006`, `docs/ui-ux/13-mundos.md`.
- Entrega: PR [#32](https://github.com/midrasil/henduran/pull/32) aberto contra `main`.
- Acréscimo (2026-11-24): botão **Configurar modelo** na tela Iniciar Jornada, abrindo Modelos num diálogo sem sair da criação (pedido do responsável); `App.tsx`, `NewJourneyWizard.tsx`, `StartStep.tsx`; 321 testes passando.

## 2026-11-24 — `prototipo-mundos` (registro)

- Rota: conversa com o planejador → protótipo → Entrega. Só documentação.
- Contexto: a tela de Mundos foi implementada pelo dev como modelo provisório, sem protótipo, por decisão do responsável (PR #32). Depois de vê-la funcionando, o responsável a aprovou **como está** e pediu um protótipo só para manter o registro.
- Resultado: `docs/ui-ux/prototipos/mundos.html` reproduz a tela implementada (lista, detalhes em abas, Gerar mundo, Criar do zero, Salvar Mundo, Duplicar e editar, Excluir com os dois diálogos, Mundo em uso, Mundo personalizado, avisos); `13-mundos.md`, `10-prototipagem.md`, README e backlog atualizados. Única mudança no app: a remoção da nota "Tela provisória".
- Decisão do responsável: remover a nota "Tela provisória" do cabeçalho; feito no app (`WorldsScreen.tsx`) e no protótipo, que reaproveita o desenho do passo Mundo da Nova Jornada, como a implementação.
- Entrega: PR [#34](https://github.com/midrasil/henduran/pull/34) aberto contra `main`.
- Arquivos: `docs/ui-ux/prototipos/mundos.html`, `docs/ui-ux/13-mundos.md`, `docs/ui-ux/10-prototipagem.md`, `docs/ui-ux/README.md`, `docs/backlog.md`.

## 2026-11-24 — `adr-memoria-narrador` (ADR-078, proposta)

- Rota: conversa de planejamento com o responsável → ADR → Entrega. Só documentação.
- Origem: o responsável relatou que, no Caliope, a narrativa perde a continuidade em chats longos (por exemplo, o personagem estava de pé e o Narrador disse que estava deitado) e que os modelos gratuitos têm limite de tokens. Ideias do responsável: cada Cena como chat novo com pontos específicos em memória (como o Dragon Age), reiniciar o contexto de uma Cena longa mantendo o histórico, NPCs com memória e a LLM da Cena consultar o Aduran e, na dúvida, perguntar ao jogador.
- Resultado: ADR-078 (proposta) com memória em camadas, Quadro da Cena (estado narrativo, visível e editável pelo jogador), compactação a cerca de 70% da janela, Cânone da Jornada, fichas de NPC com memória, skills por Jornada e por Cena (limite de 3), orçamento de tokens proporcional à janela, pergunta de continuidade e teste de continuidade como critério de aceite.
- Decisão do responsável: incluir a **pergunta de continuidade**, com o modo "só em contradição clara" como padrão. As demais decisões do ADR (⏳) são recomendações do planejador, aguardando confirmação.
- Pendências: confirmar os itens ⏳, definir os campos do Quadro e da ficha de NPC, prototipar o painel "Estado da Cena" na tela da Jornada, esquema de dados e teste de continuidade (item no backlog).
- Arquivos: `docs/main/decisoes/ADR-078-memoria-e-contexto-do-narrador-continuidade.md`, `docs/main/05-narrador-ia.md`, `docs/backlog.md`.
- Entrega: PR [#35](https://github.com/midrasil/henduran/pull/35) aberto contra `main`.

## 2026-11-24 — `prototipo-modelos` (Modelos e Skills)

- Rota: conversa com o planejador → protótipo em várias rodadas (artifact privado, mesmo link) → aprovação da versão 5 → Entrega. Só documentação.
- Resultado: `14-modelos.md` e `prototipos/modelos.html` aprovados. Tela Modelos com cabeçalho de estado (Este PC, Motor de IA, Narrador) e abas Modelos, Skills, Procurar neste PC e Downloads.
- Decisões do responsável: o cabeçalho que dizia o que é a tela virou as informações de Este PC, Motor de IA e Narrador; Meus modelos e Buscar viraram **uma aba só**, com filtros em tags (Todos, Meus modelos, Para baixar); a tela precisa de uma aba de **Skills**, com as do sistema (vindas do Caliope) e uma forma de adicionar novas, talvez importando do skills.sh.
- Decisão do planejador, aprovada: um campo de busca que filtra os modelos próprios e alimenta o botão Buscar online. Skills: limite de 3 ativas (como no Caliope), importação com prévia, aviso, confirmação e entrada desativada; scripts nunca executados.
- Ocorrências: no publicado, o trilho da Nova Jornada apareceu na tela Modelos (ordem dos estilos mudou fora do navegador local); corrigido com estilos no fim do corpo e `!important`; uma edição apagou parte do protótipo e foi refeita do original. O skills.sh não tem API pública conhecida (pesquisa na web): a importação usa repositórios públicos do GitHub.
- Em aberto: padrão do filtro +18, licenças das skills do acervo (81 de 520 declaram), API e termos do skills.sh, ativação por Jornada e por Cena (ADR-078).
- Arquivos: `docs/ui-ux/14-modelos.md`, `docs/ui-ux/prototipos/modelos.html`, `docs/ui-ux/10-prototipagem.md`, `docs/ui-ux/README.md`, `docs/backlog.md`, `docs/context/handoff.md`.

## 2026-11-24 — `prototipo-estado-cena`

- Rota: conversa com o planejador → protótipo em duas rodadas (artifact privado, mesmo link) → aprovação → Entrega. Só documentação.
- Resultado: acréscimo ao protótipo da tela da Jornada (`09`, item 2.8): aba **Estado da Cena** no chat e **dúvida de continuidade** como cartão. ADR-078 atualizado (parcialmente confirmado).
- Decisões do responsável: o Estado da Cena é **uma aba do chat** e a **Ficha fica como era** (a primeira versão pôs o painel numa aba da Ficha); o cartão de dúvida **ocupa toda a largura do chat como uma mensagem**, é só um destaque, **sem botões de escolha** (no máximo "Você decide"); a **próxima mensagem digitada responde ao cartão e fica nele, fora do chat**; depois vira um botão para reaparecer, entre as ações da mensagem ao passar o mouse, e fica no Log e num histórico no painel.
- Observação do responsável: o contexto de um NPC vem principalmente da **ficha** dele (o que sabe etc.), não da Cena; como a ficha ainda não foi montada, o mapeamento do campo "Sabe" ficou provisório e virou item no backlog.
- Ocorrências: a primeira versão pôs o painel na coluna da Ficha e com botões de resposta, e foi refeita conforme o pedido. No teste automatizado, o estado Fora de Cena não rodou na primeira vez por falta de `matchMedia` no jsdom.
- Em aberto: ficha do NPC; confirmar os ⏳ restantes do ADR-078; adiar a resposta à dúvida.
- Arquivos: `docs/ui-ux/prototipos/tela-da-jornada.html`, `docs/ui-ux/09-tela-da-jornada.md`, `docs/main/decisoes/ADR-078-memoria-e-contexto-do-narrador-continuidade.md`, `docs/ui-ux/10-prototipagem.md`, `docs/backlog.md`, `docs/context/handoff.md`.

## 2026-11-24 — `diario-e-ficha-npc`

- Rota: conversa com o planejador → protótipo em várias rodadas (artifact privado, mesmo link) → aprovação → Entrega. Só documentação.
- Resultado: acréscimo ao protótipo da tela da Jornada (`09`, item 2.9): **Diário** (Anotações, O que sei, NPCs que conheço) e **ficha do NPC com duas abas**, Narrativa e Stats. ADR-078 e backlog atualizados.
- Decisões do responsável: o jogador vê a ficha, mas **segredos e stats ficam escondidos até ele descobrir**, com revelar opcional (spoiler); o Narrador **cria** o NPC (a IA propõe, o motor valida) e o jogador pode editar; os NPCs **não ficam numa lista do Mundo**: ficam no Diário, na tela da Jornada; o **botão Diário** fica à esquerda do botão de expandir a ficha, com anotações do jogador, o que a personagem sabe e os NPCs que conhece; **no chat** o jogador vê quem está na Cena (Estado da Cena); o **Aduran tem acesso a tudo**; **os botões de revelar são só de ícone, com popup "Tem certeza?"**; o campo **"Sabe"** do Estado da Cena não mostra texto, só o link **ver na ficha**.
- Decisão do planejador, aprovada: o botão de spoiler dos stats segue o padrão dos segredos; "Esconder de novo" não pede confirmação.
- Ocorrências: o PR #37 já tinha sido mergeado quando terminei estes ajustes, então foram para um PR novo; no teste do popup o jsdom não tem `matchMedia`, tratado no teste.
- **Formatação do texto do chat** (a pedido do responsável, no mesmo protótipo): quatro estilos (narração, fala, ação, pensamento). O responsável pediu aparência de livro: fala com travessão, ação e fala no mesmo estilo (itálico), nome do NPC como chip acima da fala e **sem recuo**; testou quatro estilos (A simples, B faixa lateral, C placa de nome, D duas colunas) e escolheu o **A**. Na conversa, "cifrão" era um engano do responsável: queria dizer hífen (travessão).
- Em aberto: ficha de regras do NPC (fatia 3 do Astra) e como se descobrem os stats; esquema de dados do Diário; ajuste do prompt do Narrador com a convenção de marcas.
- Arquivos: `docs/ui-ux/prototipos/tela-da-jornada.html`, `docs/ui-ux/09-tela-da-jornada.md`, `docs/main/05-narrador-ia.md`, `docs/main/decisoes/ADR-078-memoria-e-contexto-do-narrador-continuidade.md`, `docs/ui-ux/10-prototipagem.md`, `docs/backlog.md`, `docs/context/handoff.md`.

## 2026-11-24 — `prototipo-jornadas` (Jornadas e Pontos de retorno)

- Rota: conversa com o planejador → protótipo em rodadas (artifact privado) → aprovação → Entrega. Só documentação e protótipos.
- Resultado: protótipo da tela **Jornadas** (`jornadas.html`) e dos **Pontos de retorno** no menu de opções da tela da Jornada; `15-jornadas.md`, `09` (item 2.11), `10`, backlog.
- Decisões do responsável: a Jornada passa a ter **salvamentos manuais como nos jogos**, acessados pelo menu de opções (criar, salvar por cima, renomear, excluir, carregar); no detalhe da lista, **só os pontos de retorno**, sem resumo; a lista vazia usa todo o espaço.
- Decisões assumidas pelo planejador, aprovadas na conversa: carregar sobrescreve com um ponto "Antes de carregar"; 20 manuais e 5 automáticos; o Mundo não volta.
- Ocorrências: o protótipo inicial tinha um painel de detalhes com resumo; o responsável o trocou pela lista de pontos. Dois botões do painel Protótipo falhavam com a lista vazia (corrigido e retestado em jsdom).
- Arquivos: `docs/ui-ux/15-jornadas.md`, `docs/ui-ux/prototipos/jornadas.html`, `docs/ui-ux/prototipos/tela-da-jornada.html`, `docs/ui-ux/09-tela-da-jornada.md`, `docs/ui-ux/10-prototipagem.md`, `docs/backlog.md`.

## 2026-11-24 — `chat-fala-e-melhorar-texto`

- Rota: conversa com o planejador → ajuste do protótipo da tela da Jornada (artifact privado) → aprovação → Entrega. Só documentação e protótipo.
- Resultado: travessão da fala abre sempre e fecha só se houver texto depois; **pensamento removido** do chat e do planejamento; barra de botões do campo de escrita substituída pelo menu `/` (fala, ação, ajuda); novo botão **Melhorar texto** à esquerda do enviar. `09` (item 2.10), `05` (seção 6.2), backlog e handoff atualizados.
- Decisões do responsável: pensamentos não são expressos no chat; formatação por `/` em vez de botões; melhorar texto pelo modelo. Decisão do planejador, aprovada: o modelo melhora a redação sem mudar o que o personagem faz ou diz e sem inventar fatos; o `@` fica para o `@Aduran`.
- Ocorrências: no teste, o atalho de Enter do cartão de dúvida de continuidade capturava o Enter do menu `/`; corrigido (o menu aberto tem prioridade).
- Arquivos: `docs/ui-ux/prototipos/tela-da-jornada.html`, `docs/ui-ux/09-tela-da-jornada.md`, `docs/main/05-narrador-ia.md`, `docs/backlog.md`.

## 2026-11-24 — `skills-por-cena-e-idioma-do-prompt`

- Rota: conversa de planejamento (antes de mandar a tela Modelos ao dev) → ADR e atualização dos documentos. Só documentação.
- Resultado: **ADR-079** (instruções internas em inglês, resposta em português, medição obrigatória); ADR-078, item 7, reescrito (skills por Cena, automático e manual, até 3, prioridade abaixo de regras e Cânone); `14-modelos.md`, `05-narrador-ia.md` e backlog atualizados.
- Decisões do responsável: filtro +18 sem padrão; todas as skills do acervo entram; importação pelo comando do skills.sh sem rodar o `npx`; skills **por Cena** com modo automático e limite de 3; trocar skill no meio da Cena é possível; prompt interno em inglês (opção 1 do idioma).
- Decisões do planejador, aprovadas na conversa: o app lê o texto colado e baixa só texto do GitHub; a busca de skills é só no acervo local; sem tradução de entrada e saída.
- Confirmado depois, na mesma conversa: modo padrão automático, troca de no máximo uma skill a cada 6 turnos ou quando o Quadro mudar no essencial, e fixar skill entre Cenas. Em aberto: licenças para o lançamento.
- Arquivos: `docs/main/decisoes/ADR-079-idioma-interno-dos-prompts.md`, `docs/main/decisoes/ADR-078-...md`, `docs/main/05-narrador-ia.md`, `docs/ui-ux/14-modelos.md`, `docs/backlog.md`.

## 2026-11-24 — `tela-modelos` (rodada 1)

- Rota: planejador → plano autossuficiente → dev → verificação pelo planejador → Entrega.
- Resultado: tela Modelos refeita conforme o protótipo aprovado, sem a aba Skills (`14-modelos.md`, seção 9); backend com ocultar modelo, contexto e camadas por modelo, estimativa de memória pelo cabeçalho do `.gguf`, varredura do PC e sugestões por hardware.
- Decisões do responsável (antes da rodada): Skills ficam para a rodada 2; filtro +18 sem padrão; todas as skills do acervo entram; importação por comando sem `npx`; skills por Cena (automático, troca de uma a cada 6 turnos, fixar entre Cenas); prompt interno em inglês (ADR-079).
- Decisões do dev onde havia ambiguidade (registradas): sugestões abrem "Buscar este modelo" e não inventam licença; Adicionar pasta pede o caminho colado (o seletor nativo exige plugin e permissão); estimativa de memória sem fator de folga; contexto inicial 4.096.
- Validações: typecheck limpo; vitest 326/326; pytest 701 passando e 1 pulado (reexecutados pelo planejador). Não verificado: app real, `.gguf` real, leitor de tela, DPI.
- Em aberto: conflito entre `14-modelos.md` e `auditoria-caliope.md` sobre a lista de sugestões; seletor nativo de pasta; licenças das skills (lançamento).
- Arquivos: `app/src/components/ModelsView.tsx`, `app/src/components/models/`, `app/src/api/engine.ts`, `backend/henduran/ai/{gguf,hardware,engine,modelhub}.py`, `backend/henduran/api/app.py`, `backend/henduran/settings.py`, `backend/README.md`, `docs/ui-ux/14-modelos.md`.

## 2026-11-24 — `handoff-consolidado`

- Rota: checagem a pedido do responsável → ajuste direto → Entrega. Só documentação.
- Motivo: o `HANDOFF` foi sobrescrito pela tarefa `rodape-modelos-status` (PR #44, opencode) e perdeu o registro da frente de planejamento e prototipagem (protótipos aprovados, ADR-078 e ADR-079, skills por Cena, Modelos rodada 1, pontos de retorno).
- Resultado: handoff reescrito juntando as duas frentes, com estado, pendências, decisões vigentes e próximos passos; corrigida a nota sobre o PR #31, que já estava mergeado.
- Arquivos: `docs/context/handoff.md`, `docs/context/jornal.md`.

## 2026-11-24 — `dois-handoffs`

- Executor: Claude (planejador)
- Rota: conversa com o responsável → ajuste direto → Entrega. Só documentação.
- Decisão do responsável: manter **dois handoffs**, um para o desenvolvedor principal (Claude) e outro para o opencode, para um não sobrescrever o outro; cada um escreve só no seu e lê os dois ao retomar. O jornal e o backlog continuam únicos.
- Resultado: `docs/context/handoff-opencode.md` criado com o conteúdo do PR #46; `docs/context/handoff.md` restaurado como o do desenvolvedor principal; seção "Memória operacional" do `AGENTS.md` atualizada.
- Ocorrência: a consolidação anterior (PR #45) tratava o handoff como painel geral, contra a regra de só o estado atual; este PR substitui esse modelo.
- Arquivos: `AGENTS.md`, `docs/context/handoff.md`, `docs/context/handoff-opencode.md`, `docs/context/jornal.md`.

