# ADR-056 — Fila de embeddings persistente no SQLite

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Questão:** P-55
- **Origem:** Decisão explícita do responsável pelo Henduran

## Contexto

A ADR-050 define SQLite como armazenamento local principal. A ADR-054 estabelece indexação incremental assíncrona de fatos canônicos e a ADR-055 define reintentos controlados e trabalhos pendentes de recuperação manual. Uma fila somente em memória poderia perder o histórico de execução e dificultar a retomada após fechamento ou falha do aplicativo.

## Decisão aprovada

A fila de trabalhos de **geração de embeddings será persistida no SQLite**. Seus registros deverão permitir identificar trabalhos pendentes, em processamento, interrompidos e não concluídos. Ao reiniciar ou reabrir o aplicativo, o mecanismo deverá recuperar trabalhos elegíveis, incluindo os interrompidos, e validar antes da execução ou publicação de resultados:

- A versão atual do registro canônico associado.
- O Mundo, a Jornada e a ramificação a que o trabalho pertence.
- O modelo/provedor ou configuração de embeddings que define o espaço vetorial de destino.
- A elegibilidade do trabalho diante de reintentos e falhas registrados.

Trabalhos obsoletos não poderão sobrescrever resultados mais recentes nem fazer uma memória de uma ramificação aparecer em outra. Falhas e recuperações da fila não modificam o conteúdo canônico. O jogador continua jogando com SQLite e FTS5 mesmo que a indexação não esteja concluída (ADR-053).

## Consequências

- A fila persistente será compatível com a precedência da persistência canônica e com a arquitetura transacional aprovada nas ADR-049 e ADR-054.
- Recuperação após travamento ou fechamento não pressupõe que o aplicativo ou os modelos tenham permanecido ativos em segundo plano.
- Deverão existir mecanismos de identificação de trabalhos interrompidos, de deduplicação e de rejeição de resultados obsoletos; detalhes não estão definidos.
- O formato da fila não determina onde os vetores semânticos serão armazenados.

## Pendências explícitas

- Esquema de tabelas e campos, índices, estado dos trabalhos, garantias de idempotência e recuperação.
- Política de concorrência, prioridades, limites numéricos, intervalos progressivos e tentativas.
- Detecção de execução interrompida, timeouts, deduplicação e descarte de trabalhos obsoletos.
- Formato, localização e versão dos vetores, além de reindexação e atualização.
- Testes de falha, migrações e custos de reprocessamento de APIs remotas.
