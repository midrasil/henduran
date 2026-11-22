# ADR-025 — Importação assistida de fontes e canonização aprovada pelo jogador

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Questão:** P-24 do GDD
- **Origem:** Decisão explícita do responsável pelo Henduran (opção B)

## Contexto

O Henduran permite Mundos independentes, criados manualmente, assistidos por IA ou importados de wikis e documentos (ADR-021), com versionamento de Mundos e atualizações opcionais para Jornadas (ADR-024). Fontes externas podem conter erros, divergências, versões parciais ou informações em conflito com um Mundo já aprovado.

## Decisão

A ingestão de fontes será **assistida por IA**: o sistema extrai e organiza informações numa **proposta estruturada**, indicando entidades, relações, lacunas e contradições relevantes. O jogador **revisa e aprova** a proposta antes que seus dados sejam **canonizados** no Mundo. O sistema preserva a **proveniência** das informações importadas, permitindo identificar as fontes associadas aos fatos.

A leitura, extração, indexação ou geração de uma proposta **não autoriza canonização automática**. O Narrador não pode tratar propostas ainda não aprovadas como fatos oficiais. Alterações aprovadas ao Mundo devem respeitar seu controle de versões (ADR-024); Jornadas preexistentes não recebem automaticamente atualizações.

## Consequências e diretrizes

- Apresentar uma prévia revisável dos fatos extraídos, com identificação da origem.
- Sinalizar divergências entre a proposta e o cânone já existente, sem sobrescrever silenciosamente informações.
- Distinguir claramente fontes externas, conteúdo proposto e fatos canônicos aprovados.
- Registrar aprovação do jogador e integrar somente o conteúdo aprovado à nova versão do Mundo.
- Manter referências de proveniência no modelo persistente, sem confundi-las com a autoridade canônica.
- Condicionar importação e eventual distribuição ao exame de licenças, direitos e regras de acesso às fontes.

## Pendências

- Formatos de importação e APIs de wiki suportados na primeira versão.
- Granularidade de revisão e aprovação: item, lote ou importação completa.
- Experiência de edição, revisão de incertezas, conflitos entre fontes e versões, desfazer e reprocessar importações.
- Transformação de dados de lore em geografia jogável e regras de geração para informação incompleta.
- Estratégia de armazenamento, indexação, consulta e atualização de referências.
- Políticas específicas de licenciamento e publicação de Mundos derivados de terceiros.

## Critérios de aceite propostos

1. Conteúdo extraído de wiki ou arquivo não modifica fatos canônicos antes de aprovação explícita.
2. Uma proposta contraditória não substitui automaticamente informação aprovada.
3. Fatos importados e aprovados mantêm a referência às respectivas fontes.
4. Uma nova versão de Mundo pode ser criada a partir da importação aprovada sem alterar automaticamente Jornadas existentes.
