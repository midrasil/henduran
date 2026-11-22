# ADR-054 — Indexação semântica incremental assíncrona

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Questão:** P-53
- **Origem:** Decisão explícita do responsável pelo Henduran

## Contexto

As ADR-008 e ADR-051 definem memória híbrida, FTS5 e embeddings como índices auxiliares reconstruíveis. A ADR-052 permite geração local ou por API remota. A ADR-053 mantém o jogo disponível por consultas ao SQLite e FTS5 durante indisponibilidade dos embeddings. Faltava estabelecer a ordem de persistência e a estratégia de atualização incremental.

## Decisão aprovada

A atualização de embeddings seguirá o modelo **incremental e assíncrono**:

1. O motor confirma e persiste primeiro as alterações **canônicas** no SQLite, em transações consistentes conforme ADR-049.
2. Trabalhos de indexação das memórias relevantes serão encaminhados a uma **fila** para processamento separado.
3. A geração e gravação de embeddings **não bloquearão a continuidade da Jornada**.
4. Enquanto não houver índice semântico atualizado, o Narrador utilizará os fatos estruturados canônicos e a busca FTS5, em conformidade com a ADR-053.
5. Falhas ou atrasos da fila não poderão alterar fatos canônicos nem criar acontecimentos inexistentes.

O processamento deverá vincular as memórias a Mundo, Jornada, ramificação e versão canônica pertinentes, para impedir indexação incorreta ou substituição por resultados obsoletos após alterações concorrentes ou reindexação.

## Consequências

- A consulta semântica poderá apresentar uma defasagem temporária em relação ao estado canônico recém-confirmado.
- A fila deverá ser recuperável conforme critérios técnicos futuros; sua existência não constitui uma segunda fonte de verdade.
- A indexação não deverá duplicar registros ou misturar memórias de ramificações distintas.
- A definição não estabelece um intervalo máximo de defasagem ou um tempo para processamento.

## Pendências explícitas

- Tecnologia e durabilidade da fila, prioridades e política de coalescência/deduplicação.
- Reintentos, backoff, suspensão e tratamento de falhas permanentes ou temporárias.
- Limites de concorrência, execução local/remota e controle de custos da API.
- Formato e armazenamento vetorial, versão/modelo dos embeddings e estratégia de invalidação/reindexação.
- Critérios de criação de trabalhos, atualização, exclusão e isolamento de índices.
- Métricas, notificações e UX para indicar defasagens na recuperação semântica.
