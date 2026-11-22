# ADR-059 — Herança por referência do passado comum entre ramificações

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Questão:** P-58
- **Origem:** Aprovação explícita do responsável pelo Henduran

## Contexto

As ADR-041 e ADR-042 estabelecem ramificações independentes em árvore após retomar um salvamento anterior. A ADR-058 separa conhecimento compartilhado/versionado do Mundo de memórias particulares da Jornada e ramificação. Restava decidir como uma nova linha recupera memórias válidas antes de sua divergência, sem copiar excessivamente a informação ou permitir vazamento de acontecimentos de outras linhas.

## Decisão aprovada

O Henduran deverá **compartilhar por referência as memórias imutáveis anteriores ao ponto de divergência**, enquanto as memórias posteriores de cada ramificação permanecerão isoladas.

- A ramificação filha herda o **passado canônico comum válido no salvamento restaurado**, inclusive as memórias anteriores acessíveis naquela continuidade.
- O passado comum é **imutável** e poderá ser referenciado por múltiplas ramificações, sem exigir cópia lógica de todos os registros.
- A partir da divergência, acontecimentos, relações, descobertas e memória específicos de cada linha devem permanecer separados.
- A ramificação nova não terá acesso a informações que foram descobertas na origem **após** o ponto de divergência.
- Consulta textual, fatos estruturados e recuperação vetorial precisam respeitar tanto o corte temporal quanto o escopo de Mundo/Jornada/ramificação.
- A herança não altera a fonte canônica SQLite, o versionamento do Mundo ou a autorização de conhecimento de personagens/NPCs.

## Consequências

As referências de memória compartilhada não autorizam modificações retroativas na história comum. Exclusão e arquivamento de ramificações (ADR-043) deverão preservar registros compartilhados que ainda sustentem outras continuidades. Salvamentos e backups (ADR-039 a ADR-047) precisam preservar os vínculos históricos válidos. O mecanismo de indexação continuará auxiliar e reconstruível.

## Pendências explícitas

- Representação física das referências, linhagens, identificadores e limites temporais.
- Filtros, permissões e controle de segredos por protagonista e NPCs.
- Políticas para eventuais correções de registros anteriores ao ponto de divergência.
- Organização dos índices SQLite/FTS5/vetoriais e otimização de armazenamento.
- Tratamento de referências compartilhadas ao excluir ramificações, restaurar backups e atualizar Mundos versionados.
