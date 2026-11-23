# Modelo de dados de jogo

**Estado:** reflete o código em `backend/henduran/db/migrations/` (Jornada até a `0003`, Mundo e app na `0001`). Decisões de base: ADR-050, ADR-074, ADR-075 e ADR-076.

## Onde os dados moram

| Banco | Caminho | Conteúdo hoje |
| --- | --- | --- |
| App | `henduran.db` | preferências (`settings`) e metadados (`app_meta`); `last_journey_id` aponta a última Jornada jogada. Sem dados de jogo. |
| Jornada | `journeys\<id>\journey.db` | resumo da Jornada, o personagem, as Cenas e o histórico do chat (abaixo). |
| Mundo | `worlds\<id>\world.db` | metadados e versões do Mundo, com o conteúdo em JSON (esquema v1). |

A Jornada só **lê** o Mundo (anexado em modo leitura); nenhuma operação grava nos dois bancos ao mesmo tempo (ADR-075, item 4). A criação de uma Jornada grava primeiro o Mundo e depois a Jornada, cada um na sua transação, com compensação (remoção das pastas) se uma etapa falhar.

## `journey.db`

| Tabela | Para quê |
| --- | --- |
| `journey_meta` | uma linha: `id`, `name`, `character_name`, `location` (nome do lugar atual), `start_place_id` (id do lugar inicial no Mundo; nulo em Jornadas criadas antes da `0003`), `day_period` (sorteado pelo motor na criação entre `madrugada`, `amanhecer`, `manha`, `tarde`, `entardecer` e `noite`, com peso igual; ADR-076, item 9), `world_id` e `world_version` (Mundo fixado), `created_at`, `last_saved_at`, `rules_version`. |
| `character` | uma linha: nome, Conceito, aparência, história, perfil de Perícias da criação e os contadores de dano de Vida e de Vontade (superficial e agravado, começam em 0). |
| `character_attributes` | os 6 Atributos (1 a 5). |
| `character_skills` | as 22 Perícias (0 a 5), inclusive as em 0. |
| `convictions` | as 3 Convicções (posição 1 a 3), com Pilar e Fraturas (0 a 2). |
| `objectives` | Ambição e Desejo; `status` `ativo`, `concluido`, `abandonado`, `impossivel` ou `sem_sentido`, com `reason` e `closed_at`. No máximo um ativo de cada tipo (índice único parcial). |
| `scenes` | Cenas (ADR-076): `status` `aberta` ou `encerrada`, `opening_tone` (só nas Cenas abertas por tom de partida, como a Cena inicial), `place_id` e `day_period` (do motor), `motive` (1 a 300) e `participants` (array JSON, da proposta validada do Narrador), `summary` (1 a 2000, obrigatório ao encerrar), `opened_at`, `closed_at`. No máximo uma aberta (índice único parcial). |
| `messages` | histórico do chat, na ordem do `id`: `channel` `fora_de_cena` ou `cena`, `scene_id` (obrigatório só no canal `cena`), `role` `narrador` ou `jogador`, `content`, `status` `concluida` ou `cancelada` (resposta interrompida, com o texto parcial; nunca volta ao modelo como contexto), `created_at`. |

O tamanho das trilhas (Vida = 3 + Vigor; Vontade = 3 + Determinação) não é gravado: é derivado dos Atributos pelo motor.

Cenas e resumos só são gravados por operações validadas do motor (`henduran/narrative/scene.py`); o texto narrado nunca altera estado (ADR-076, item 7). O modo da Jornada (Fora de Cena ou Em Cena) não é gravado à parte: é Em Cena quando há uma Cena `aberta`.

## `world.db`

| Tabela | Para quê |
| --- | --- |
| `world_meta` | uma linha: `id`, `name`, `created_at`. |
| `world_versions` | versões do Mundo (ADR-024): `version`, `label`, `created_at`, `content` (JSON). O gerador cria a versão 1. |

Conteúdo, **esquema v1**: `schema`, `name`, `era`, `tone`, `calendar` (nome, ano, nome do ano, 8 a 14 meses de 20 a 40 dias, 5 a 8 dias da semana), `religions` (1 a 3) e `places` (3 a 5, com `id`, nome, tipo e descrição). Limites completos em `backend/README.md`.

## Versão das regras

- Toda Jornada guarda em `journey_meta.rules_version` a versão das regras aplicada (hoje `fatia-1`, a de `rules/`). Jornadas criadas antes da migração `0002` recebem `fatia-1` ao migrar.
- O motor expõe a versão em `henduran.rules.fatia1.RULES_VERSION`, e `GET /rules/creation` a entrega à interface.
- Uma nova versão das regras não altera Jornadas existentes por si só: a conversão de uma Jornada para outra versão terá de ser uma operação explícita, a decidir quando a fatia 2 existir.

## O que ainda não existe

Eventos e fatos registrados (além do resumo de cada Cena), memória (FTS5 e vetores), salvamentos e autosaves, ramificações, registro de rolagens, usos por Dia do Mundo, troca e histórico de objetivos, data do calendário na Jornada, inventário e dinheiro, anexos (`assets\`) e cache do catálogo de Jornadas. Cada um entra com a sua migração e, quando for o caso, com o seu ADR.
