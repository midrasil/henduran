# Modelo de dados de jogo

**Estado:** reflete o código em `backend/henduran/db/migrations/` (Jornada até a `0002`, Mundo e app na `0001`). Decisões de base: ADR-050, ADR-074 e ADR-075.

## Onde os dados moram

| Banco | Caminho | Conteúdo hoje |
| --- | --- | --- |
| App | `henduran.db` | preferências (`settings`) e metadados (`app_meta`); `last_journey_id` aponta a última Jornada jogada. Sem dados de jogo. |
| Jornada | `journeys\<id>\journey.db` | resumo da Jornada e o personagem (abaixo). |
| Mundo | `worlds\<id>\world.db` | metadados e versões do Mundo, com o conteúdo em JSON (esquema v1). |

A Jornada só **lê** o Mundo (anexado em modo leitura); nenhuma operação grava nos dois bancos ao mesmo tempo (ADR-075, item 4). A criação de uma Jornada grava primeiro o Mundo e depois a Jornada, cada um na sua transação, com compensação (remoção das pastas) se uma etapa falhar.

## `journey.db`

| Tabela | Para quê |
| --- | --- |
| `journey_meta` | uma linha: `id`, `name`, `character_name`, `location` (nome do lugar atual), `day_period` (começa em `amanhecer`, ADR-073), `world_id` e `world_version` (Mundo fixado), `created_at`, `last_saved_at`, `rules_version`. |
| `character` | uma linha: nome, Conceito, aparência, história, perfil de Perícias da criação e os contadores de dano de Vida e de Vontade (superficial e agravado, começam em 0). |
| `character_attributes` | os 6 Atributos (1 a 5). |
| `character_skills` | as 22 Perícias (0 a 5), inclusive as em 0. |
| `convictions` | as 3 Convicções (posição 1 a 3), com Pilar e Fraturas (0 a 2). |
| `objectives` | Ambição e Desejo; `status` `ativo`, `concluido`, `abandonado`, `impossivel` ou `sem_sentido`, com `reason` e `closed_at`. No máximo um ativo de cada tipo (índice único parcial). |

O tamanho das trilhas (Vida = 3 + Vigor; Vontade = 3 + Determinação) não é gravado: é derivado dos Atributos pelo motor.

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

Eventos e fatos registrados, histórico de chat, Cenas, memória (FTS5 e vetores), salvamentos e autosaves, ramificações, registro de rolagens, usos por Dia do Mundo, troca e histórico de objetivos, data do calendário na Jornada, inventário e dinheiro, anexos (`assets\`) e cache do catálogo de Jornadas. Cada um entra com a sua migração e, quando for o caso, com o seu ADR.
