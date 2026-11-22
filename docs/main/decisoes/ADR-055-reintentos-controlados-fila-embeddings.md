# ADR-055 — Reintentos controlados na indexação semântica

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Questão:** P-54
- **Origem:** Decisão explícita do responsável pelo Henduran

## Contexto

A ADR-051 aprova busca híbrida com índices semânticos reconstruíveis; a ADR-052 permite geração local ou remota de embeddings; a ADR-053 permite continuar jogando com SQLite e FTS5 quando a recuperação semântica estiver indisponível; e a ADR-054 estabelece indexação incremental assíncrona por fila. Falhas de conexão, serviço remoto, instalação ou execução local não devem bloquear a Jornada nem produzir reprocessamento ilimitado e dispendioso.

## Decisão aprovada

O Henduran usará **novas tentativas controladas de trabalhos de indexação semântica**:

- Falhas temporárias poderão gerar **reintentos automáticos com intervalos progressivos**.
- Haverá um **limite de tentativas**, ainda não quantificado.
- Trabalhos não concluídos após o limite ou que exijam intervenção permanecerão identificáveis para **recuperação e reprocessamento manual**.
- O jogador poderá continuar a Jornada usando fatos canônicos estruturados do SQLite e busca textual FTS5, sem depender da conclusão desses trabalhos.
- Nenhum reintento poderá modificar o conteúdo canônico, misturar ramificações ou atualizar o índice com uma versão obsoleta dos dados.
- Falhas permanentes de configuração e erros não recuperáveis não devem causar laços automáticos ilimitados ou consumo descontrolado de APIs.

## Consequências

A fila precisará representar o estado de execução e de falha dos trabalhos, oferecer diagnóstico suficiente para intervenção, e suportar reprocessamento sem duplicação de efeitos. Os detalhes de persistência da fila e classificação de erros não estão decididos nesta ADR.

## Pendências explícitas

- Número máximo de tentativas, intervalos iniciais, progressão e limites do atraso.
- Priorização de trabalhos, concorrência, custos e limitação de taxa de APIs.
- Classificação de erros transitórios, permanentes e de configuração.
- Persistência e durabilidade da fila ao encerrar ou reiniciar o aplicativo.
- Idempotência, deduplicação, controle de versão canônica e tratamento de trabalhos obsoletos.
- Implementação da fila, armazenamento vetorial e política de reindexação.
