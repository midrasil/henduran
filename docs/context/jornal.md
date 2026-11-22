# Jornal da esteira

Registro cronológico, cumulativo e conciso da execução do projeto. Este arquivo documenta o que aconteceu; `docs/backlog.md` continua sendo a lista autoritativa e ordenada de pendências.

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
