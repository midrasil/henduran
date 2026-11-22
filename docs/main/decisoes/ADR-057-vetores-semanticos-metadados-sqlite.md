# ADR-057 — Vetores semânticos e metadados armazenados no SQLite

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Questão:** P-56
- **Origem:** Aprovação explícita do responsável pelo Henduran

## Contexto

O Henduran já adotou o SQLite como banco de dados principal (ADR-050), a recuperação híbrida com FTS5 e embeddings reconstruíveis (ADR-051) e uma fila persistente de indexação no SQLite (ADR-056). Restava definir onde residiriam os próprios vetores e seus metadados.

## Decisão aprovada

O Henduran armazenará **os vetores de embeddings e seus metadados no SQLite**, utilizando **mecanismo de consulta vetorial compatível** com a plataforma desktop.

- Os embeddings serão **índices auxiliares e reconstruíveis** derivados de fatos canônicos, nunca outra fonte da verdade.
- Os metadados deverão permitir verificar origem, versão do conteúdo e modelo utilizado, bem como aplicar autorização e isolamento por Mundo, Jornada e ramificação.
- A solução deverá coexistir com o uso do SQLite para estado do jogo e fila de indexação, mantendo a Jornada acessível por SQLite e FTS5 enquanto o índice estiver indisponível (ADR-053).
- A geração local ou remota de vetores permanece configurável (ADR-052); a decisão de armazenamento não fixa provedor ou modelo.

## Consequências

A implementação deverá avaliar mecanismos de busca vetorial que funcionem com a distribuição Windows escolhida, a estabilidade do SQLite empregado e as exigências de instalação, atualização e consulta. Falha de busca vetorial não pode alterar dados canônicos nem impedir o jogo.

## Pendências explícitas

- Extensão SQLite ou biblioteca específica de similaridade vetorial.
- Esquema de armazenamento de embeddings e metadados, codificação, dimensões e índices.
- Estratégia de filtragem e segregação dos dados por escopo e ramificação.
- Metas de latência, volume, memória e desempenho de consultas.
- Atualização, invalidação e reconstrução dos índices ao trocar de modelo ou versão.
- Concorrência de indexação e consultas, migrações e testes de integridade.
