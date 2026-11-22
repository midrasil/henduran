# ADR-058 — Memória do Mundo compartilhada e memória de continuidade isolada

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Questão:** P-57
- **Origem:** Aprovação explícita do responsável pelo Henduran

## Contexto

As ADR-021, ADR-024 e ADR-026 estabelecem Mundos reutilizáveis, versionados e com atualizações controladas. As ADR-041 e ADR-042 estabelecem continuidades ramificadas e navegáveis, e as ADR-008, ADR-051 e ADR-057 estabelecem memória híbrida baseada no SQLite, FTS5 e embeddings auxiliares reconstruíveis. O Narrador deve recuperar informações compartilháveis do Mundo sem transferir descobertas particulares de uma continuidade para outra.

## Decisão aprovada

O Henduran combinará duas categorias de memória para a recuperação contextual:

- **Memória compartilhada e versionada do Mundo:** informações gerais e canônicas do cenário, consultadas conforme a versão do Mundo aplicável à Jornada.
- **Memória particular por Jornada e ramificação:** acontecimentos, descobertas, relações e consequências específicos da história e da continuidade ativa, sem vazamentos entre ramificações.

A recuperação híbrida e seus mecanismos físicos deverão respeitar essa separação. Uma informação particular conhecida por um personagem em uma continuidade não pode ser tratada automaticamente como conhecimento desse mesmo personagem em outra continuidade. O índice semântico não constitui fonte de verdade nem autorização para burlar o isolamento da narrativa.

## Consequências

- As consultas precisam aplicar escopo de Mundo/versionamento e da Jornada/ramificação antes de fornecer contexto ao Narrador.
- O conhecimento compartilhado do Mundo não implica que os personagens conheçam todos os seus fatos; permissões narrativas e segredos continuarão a exigir regras.
- A decisão não determina como herdar memórias anteriores ao ponto de bifurcação: isso será tratado em uma decisão posterior.
- Preservam-se o armazenamento vetorial no SQLite (ADR-057), a indexação assíncrona (ADR-054) e a possibilidade de recuperação via SQLite/FTS5 em indisponibilidade dos embeddings (ADR-053).

## Pendências explícitas

- Filtros e garantias de isolamento nas consultas FTS5 e vetoriais.
- Regras de herança de memórias anteriores ao ponto de bifurcação.
- Organização física dos índices e metadados, semântica de versão do Mundo.
- Controle de segredos e de conhecimento efetivo dos protagonistas, NPCs e Narrador.
- Atualização, invalidação e reconstrução de índices em ramificações e mudanças do Mundo.
