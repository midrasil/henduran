# Modelo de dados de jogo

**Estado:** reflete o código em `backend/henduran/db/migrations/` (Jornada até a `0006`, Mundo até a `0002`, app na `0001`). Decisões de base: ADR-050, ADR-074, ADR-075, ADR-076 e ADR-077.

## Onde os dados moram

| Banco | Caminho | Conteúdo hoje |
| --- | --- | --- |
| App | `henduran.db` | preferências (`settings`) e metadados (`app_meta`); `last_journey_id` aponta a última Jornada jogada. Sem dados de jogo. |
| Jornada | `journeys\<id>\journey.db` | resumo da Jornada, o personagem, as Cenas, o histórico do chat, os lugares descobertos, as propostas de Cena e o Log (abaixo). Anexos em `journeys\<id>\assets\` (hoje, só o retrato). |
| Mundo | `worlds\<id>\world.db` | metadados e versões do Mundo, com o conteúdo em JSON (esquema v1). |

A Jornada só **lê** o Mundo (anexado em modo leitura); nenhuma operação grava nos dois bancos ao mesmo tempo (ADR-075, item 4). A criação de uma Jornada num **Mundo novo** grava primeiro o Mundo e depois a Jornada, cada um na sua transação, com compensação (remoção das pastas) se uma etapa falhar. Num **Mundo salvo** (ADR-077, item 5), nada é gravado no `world.db`: a Jornada é fixada na última versão dele, que é só lida; uma falha remove só a pasta da Jornada.

## `journey.db`

| Tabela | Para quê |
| --- | --- |
| `journey_meta` | uma linha: `id`, `name`, `character_name`, `location` (nome do lugar atual), `start_place_id` (id do lugar inicial no Mundo; nulo em Jornadas criadas antes da `0003`), `current_place_id` (id do lugar atual, do Mundo ou da Jornada; na criação e na migração `0004`, o lugar inicial), `day_period` (sorteado pelo motor na criação entre `madrugada`, `amanhecer`, `manha`, `tarde`, `entardecer` e `noite`, com peso igual; ADR-076, item 9), `calendar_year`, `calendar_month` (1..N) e `calendar_day` (1..dias do mês): a data no calendário do Mundo (ADR-076, item 16; abaixo), `world_id` e `world_version` (Mundo fixado), `created_at`, `last_saved_at`, `rules_version` e `description` (a descrição da Jornada escrita pelo jogador na Nova Jornada; opcional, 1 a 2.000 caracteres, nula = sem descrição; `0005`, ADR-077, item 4; vai no contexto geral do Narrador). |
| `character` | uma linha: nome, Conceito, aparência (opcional desde a `0006`: texto vazio = não informada, até 4.000 caracteres; a `0006` reconstrói a tabela preservando todas as linhas e os dados ligados a ela), história (`history`: **texto puro**, até 4.000 caracteres; é o que o Narrador lê) e `history_html` (a História formatada, **HTML saneado** pelo serviço com lista permitida; até 40.000 caracteres; nula nas Histórias gravadas antes da `0005`, que a API entrega como parágrafos; ADR-077, item 2), perfil de Perícias da criação, os contadores de dano de Vida e de Vontade (superficial e agravado, começam em 0), os campos opcionais da descrição (`age` até 100, `height` até 100, `origin` até 200, `personality` até 1000; texto livre, nulo = não informado, sem efeito de regra) e o retrato: `portrait_file` (`portrait.png`, `portrait.jpg` ou `portrait.webp`, em `assets\`) e `portrait_crop` (JSON `{x, y, zoom}`, x e y de 0 a 1, zoom de 1 a 8; os dois existem juntos ou nenhum). |
| `character_attributes` | os 6 Atributos (1 a 5). |
| `character_skills` | as 22 Perícias (0 a 5), inclusive as em 0. |
| `convictions` | as 3 Convicções (posição 1 a 3), com Pilar e Fraturas (0 a 2). |
| `objectives` | Ambição e Desejo; `status` `ativo`, `concluido`, `abandonado`, `impossivel` ou `sem_sentido`, com `reason` e `closed_at`. No máximo um ativo de cada tipo (índice único parcial). |
| `scenes` | Cenas (ADR-076): `status` `aberta` ou `encerrada`, `title` (1 a 80, proposto pelo Narrador e renomeável pelo jogador; nulo nas Cenas anteriores à `0004`, que a API mostra como "Cena N", N = ordem da Cena), `opening_tone` (só nas Cenas abertas por tom de partida, como a Cena inicial), `place_id` (do Mundo ou da Jornada) e `day_period` (do motor), `motive` (1 a 300) e `participants` (array JSON, da proposta validada do Narrador), `objective_id` (a Ambição ativa quando a Cena abriu: o arco; nulo nas anteriores à `0004`, que contam como da Ambição ativa atual), `summary` (1 a 2000, obrigatório ao encerrar), `opened_at`, `closed_at`. No máximo uma aberta (índice único parcial). |
| `messages` | histórico do chat, na ordem do `id`: `channel` `fora_de_cena` ou `cena`, `scene_id` (obrigatório só no canal `cena`), `role` `narrador` ou `jogador`, `content`, `status` `concluida` ou `cancelada` (resposta interrompida, com o texto parcial; nunca volta ao modelo como contexto), `created_at`. A conversa com o Aduran durante uma Cena fica no canal `fora_de_cena` e nunca entra no contexto do Narrador da Cena. Regenerar troca o texto da última resposta do Narrador no mesmo `id`; continuar anexa texto a ela. |
| `places` | lugares descobertos na Jornada (ADR-076, item 13; o `world.db` é só leitura): `id` (`j-<n>`, no formato dos ids do Mundo e sem colidir com eles), `name` (1 a 100, único entre Mundo e Jornada sem diferenciar maiúsculas), `type` (1 a 40), `description` (0 a 1000), `scene_id` (a Cena em que o lugar apareceu), `created_at`. Os lugares do Mundo continuam só no `world.db`. |
| `scene_proposals` | propostas de Cena do Aduran (ADR-076, itens 12 e 17): `status` `pendente`, `aceita`, `recusada` ou `substituida`, `title` (1 a 80), o lugar **conhecido** (`place_id`) **ou** um lugar **novo** (`new_place_name`, `new_place_type`, `new_place_description`), `motive`, `participants` (array JSON), `scene_id` (a Cena aberta ao aceitar), `created_at`, `decided_at` (nulo só enquanto pendente). No máximo uma pendente (índice único parcial). |
| `events` | Log da Jornada (ADR-076, item 14): `kind` `cena_aberta`, `cena_encerrada` (com o resumo), `lugar` (troca do lugar atual) ou `cena_renomeada`, `scene_id` (quando houver), `data` (objeto JSON com os textos para exibir: título, nome do lugar, resumo, título anterior), o momento da Jornada quando aconteceu (`day_period`, `calendar_year`, `calendar_month`, `calendar_day`) e `created_at`. A `0004` grava os eventos retroativos (aberta e encerrada) das Cenas que já existiam, com o título "Cena N". |

O tamanho das trilhas (Vida = 3 + Vigor; Vontade = 3 + Determinação) não é gravado: é derivado dos Atributos pelo motor.

**Data no calendário do Mundo** (ADR-076, item 16). Na criação, o ano é o `calendar.year` do Mundo; o motor sorteia o mês (peso igual entre os meses) e depois o dia (peso igual entre os dias do mês). Jornadas criadas antes da `0004` recebem, ao abrir (com o Mundo anexado), o dia 1 do mês 1 do ano do calendário, e os eventos retroativos recebem a mesma data. A data só muda quando existir o ADR de passagem de tempo. O **dia da semana** não é gravado; é calculado: `dia_absoluto = (ano − calendar.year) × dias_do_ano + soma dos dias dos meses anteriores + (dia − 1)` e `dia_da_semana = weekdays[dia_absoluto mod nº de dias da semana]` (o dia 1 do mês 1 do ano do calendário é o primeiro dia da lista; `henduran/narrative/calendar.py`).

Cenas, resumos, títulos, lugares, propostas e eventos só são gravados por operações validadas do motor (`henduran/narrative/scene.py`); o texto narrado nunca altera estado (ADR-076, item 7). O modo da Jornada (Fora de Cena ou Em Cena) não é gravado à parte: é Em Cena quando há uma Cena `aberta`.

## `world.db`

| Tabela | Para quê |
| --- | --- |
| `world_meta` | uma linha: `id`, `name`, `created_at` e `seed` (`0002`, ADR-077, item 5: a semente do gerador, gravada só quando ela reproduz exatamente o conteúdo, num Mundo gerado e não editado; num Mundo editado à mão, criado do zero ou duplicado, nula: é um **Mundo personalizado**, decisão de 2026-11-24; nula também em Mundos criados antes). Mundos são salvos pela Nova Jornada ou pela tela de Mundos (`POST /worlds`) e só são excluídos pela tela de Mundos (`DELETE /worlds/{id}`, recusado com Jornadas que o usem); excluir a última Jornada de um Mundo **não** o apaga. |
| `world_versions` | versões do Mundo (ADR-024): `version`, `label`, `created_at`, `content` (JSON). O gerador cria a versão 1. |

Conteúdo, **esquema v1**: `schema`, `name`, `era`, `tone`, `calendar` (nome, ano, nome do ano, 8 a 14 meses de 20 a 40 dias, 5 a 8 dias da semana), `religions` (1 a 3) e `places` (3 a 5, com `id`, nome, tipo e descrição). Limites completos em `backend/README.md`.

**História formatada** (ADR-077, itens 1 e 2). O serviço recebe o HTML do editor (`history_html` no rascunho) e o sanea por lista permitida (`henduran/richtext.py`): `p`, `h2`, `h3`, `strong` (`b`), `em` (`i`), `u`, `s`, `ul`, `ol`, `li` e `blockquote`, com o alinhamento (`style="text-align: left|center|right|justify"`) só nos blocos; nada mais (sem atributos livres, scripts, links nem imagens). O texto puro é derivado do HTML saneado (um bloco por linha; itens de lista com `- ` ou `N. `), e o limite de 4.000 caracteres conta o texto puro.

## Versão das regras

- Toda Jornada guarda em `journey_meta.rules_version` a versão das regras aplicada (hoje `fatia-1`, a de `rules/`). Jornadas criadas antes da migração `0002` recebem `fatia-1` ao migrar.
- O motor expõe a versão em `henduran.rules.fatia1.RULES_VERSION`, e `GET /rules/creation` a entrega à interface.
- Uma nova versão das regras não altera Jornadas existentes por si só: a conversão de uma Jornada para outra versão terá de ser uma operação explícita, a decidir quando a fatia 2 existir.

## O que ainda não existe

Fatos registrados (além do resumo de cada Cena), memória (FTS5 e vetores), salvamentos e autosaves, ramificações, registro de rolagens, usos por Dia do Mundo, troca e histórico de objetivos (os arcos já guardam a Ambição de cada Cena), passagem do tempo (a data e o período não mudam), inventário e dinheiro, anexos além do retrato e cache do catálogo de Jornadas. Os backups da Jornada (pré-migração) copiam só o `journey.db`: o retrato em `assets\` não entra neles. Cada um entra com a sua migração e, quando for o caso, com o seu ADR.
