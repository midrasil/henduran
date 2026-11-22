# ADR-023 — Diário narrativo e livro literário exportável

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Questão:** P-20 do GDD
- **Origem:** Aprovação explícita do responsável pelo Henduran

## Contexto

Henduran é um RPG solo com Narrador IA em que as Jornadas registram eventos e decisões persistentes. A ADR-022 permite que uma Jornada atravesse múltiplos arcos narrativos e seja encerrada opcionalmente. A conversão dessa experiência em literatura é um objetivo de produto, mas ainda não estava confirmada como requisito do Henduran.

## Decisão aprovada

O Henduran terá **diário narrativo** e permitirá **gerar um livro literário exportável**, com organização em capítulos e **revisão assistida por IA**. O material literário será derivado dos acontecimentos registrados na Jornada e poderá abranger arcos específicos ou a história completa.

O histórico de acontecimentos, o estado mecânico e os fatos canônicos são a fonte de verdade. O diário, os capítulos e a revisão literária não poderão alterar o que realmente aconteceu no jogo nem introduzir contradições como fatos estabelecidos.

## Implicações

- Diferenciar **registro canônico** e **representação literária derivada**.
- Preservar rastreabilidade dos acontecimentos relevantes que fundamentam cada entrada ou capítulo, como requisito de projeto a detalhar.
- Permitir a elaboração de capítulos e consolidação em livro exportável.
- Utilizar IA para narrativização e revisão, sem lhe conceder permissão para alterar unilateralmente o estado do jogo.
- Compatibilizar a geração literária com Jornadas contínuas que possuem múltiplos arcos e possibilidade de encerramento opcional.
- Não assumir que cada turno de chat exige uma reescrita literária imediata.

## Pendências não aprovadas

- Formato ou formatos de exportação (PDF, EPUB, DOCX, Markdown etc.).
- Regras de geração do diário (automática, sob demanda ou híbrida), frequência, revisões, critérios de edição e aceitação.
- Divisão concreta em capítulos, ponto de vista e voz narrativa; possibilidade de editar manualmente o material e tratar divergências.
- Uso de imagens, capas, modelos editoriais, compartilhamento/publicação e custos de processamento.
- Mecanismos específicos de auditoria de fidelidade entre história registrada e narrativa literária.

## Critérios de aceite propostos

- Uma Jornada pode produzir entradas de diário baseadas em fatos registrados.
- É possível compor um livro por capítulos e obter pelo menos uma exportação, cujo formato será definido posteriormente.
- A revisão literária não altera inventário, personagens, objetivos, eventos nem outras informações canônicas.
- Uma Jornada com mais de um arco pode continuar enquanto partes anteriores de sua história são usadas na elaboração literária.
