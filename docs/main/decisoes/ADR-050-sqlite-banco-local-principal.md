# ADR-050 — SQLite como banco de dados local principal

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Questão:** P-49
- **Origem:** Decisão explícita do responsável pelo Henduran

## Contexto

O Henduran precisa de armazenamento local confiável para Mundos versionados, Jornadas, estado atual, ramificações, histórico canônico, memória, saves e referências a anexos. As ADR-007 e ADR-049 exigem persistência híbrida e operações atômicas com recuperação consistente.

## Decisão aprovada

**SQLite será o banco de dados local principal** do Henduran, armazenando os dados estruturados e relacionamentos persistentes do jogo, incluindo estados, eventos relevantes, Mundos, Jornadas, salvamentos e ramificações. **Arquivos grandes** poderão ficar no sistema de arquivos quando apropriado, com referências controladas pelo banco de dados.

A decisão:
- Não exige um servidor de banco de dados.
- Não fixa as tabelas, índices, esquema físico, migrações ou estratégia de transações.
- Não define ainda como será implementada a recuperação diante de falhas ou a consistência entre SQLite e anexos externos.
- Não impõe o armazenamento de imagens no próprio SQLite.
- Não seleciona, por si só, a implementação da busca semântica de memória do Narrador.
- Não altera o formato dos backups portáteis ZIP definido na ADR-047.

## Consequências

- Integrar gravações canônicas de estado e eventos de forma transacional, conforme ADR-049.
- Considerar os mecanismos de versionamento e ramificações nas futuras estruturas de dados.
- Proteger a integridade de referências aos arquivos externos em operações de gravação, exclusão e restauração.

## Pendências

Esquema de tabelas, entidades e índices; estratégia de migração do banco e versionamento do esquema; isolamento, commits e recuperação; organização de anexos e arquivos volumosos; limites de tamanho, backup, integridade e manutenção; mecanismo de indexação e recuperação semântica do Narrador.
