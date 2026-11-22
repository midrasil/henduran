# ADR-034 — Organização híbrida de capítulos literários

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Questão:** P-33
- **Origem:** Aprovação explícita do responsável pelo Henduran

## Contexto

A ADR-023 aprovou diário narrativo e livro exportável. A ADR-030 exige solicitação explícita para a geração literária. A ADR-032 aprovou edição manual e revisão assistida por IA com aprovação de versões. A ADR-033 aprovou Markdown, PDF e EPUB. Faltava definir quem organiza os capítulos, visto que a divisão da Jornada em Cenas e arcos não corresponde necessariamente à estrutura de um livro.

## Decisão aprovada

O Henduran permitirá **organização híbrida dos capítulos**: o jogador pode montar a estrutura manualmente ou **solicitar** que a IA proponha capítulos com títulos e distribuição dos acontecimentos ou entradas existentes.

O jogador poderá **reorganizar, fundir, dividir, renomear, editar e aprovar** capítulos e estrutura antes da exportação. Propostas geradas por IA não serão incorporadas ou aprovadas automaticamente.

A organização e eventual geração literária continuarão sob solicitação explícita do jogador (ADR-030). A estrutura literária é independente da divisão técnica em Cenas e arcos. A edição literária não altera o histórico canônico ou o estado da Jornada.

## Consequências

- Modelar uma estrutura de livro editável que referencie os textos aprovados ou eventos canônicos que os fundamentam, sem fazer dessa estrutura o estado oficial do jogo.
- Permitir composição manual e propostas assistidas por IA a pedido do jogador.
- Oferecer operações de alteração de capítulos e um fluxo de aprovação.
- Exportar a estrutura aprovada nos formatos já confirmados (Markdown, PDF e EPUB), preservando a ordem e o texto editorialmente selecionados.

## Pendências não aprovadas

- Diagramação, modelos editoriais, capa, sumário, tipografia, imagens e metadados.
- UX detalhada de organização e comparação de propostas, granularidade de alterações, limites de tamanho e regras de geração de títulos.
- Publicação e distribuição automática.
- Processos de preparação editorial para os formatos de exportação.
