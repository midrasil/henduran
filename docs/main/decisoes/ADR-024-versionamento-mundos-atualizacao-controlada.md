# ADR-024 — Versionamento de Mundos e atualização controlada nas Jornadas

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Questão:** P-23 do GDD
- **Origem:** Aprovação explícita do responsável pelo Henduran

## Contexto

A ADR-021 estabelece Mundos reutilizáveis que podem servir de base para várias Jornadas independentes. Mundos também podem ser editados ou expandidos, inclusive por dados importados. Atualizações automáticas poderiam contradizer descobertas, personagens e outros fatos já estabelecidos em uma Jornada. Congelar permanentemente o Mundo impediria correções e expansões úteis.

## Decisão aprovada

**Versionar os Mundos e permitir atualizações controladas nas Jornadas**, com **detecção de conflitos** e **preservação dos fatos canônicos**. Cada Jornada se vincula a uma versão identificável do Mundo. Criar ou editar uma versão do Mundo não altera automaticamente Jornadas já existentes.

O jogador poderá decidir se incorpora uma versão mais recente à sua Jornada. Antes de aplicar mudanças, o sistema deve confrontá-las com o estado canônico da Jornada e identificar incompatibilidades. Nenhuma mudança deve sobrescrever silenciosamente fatos já estabelecidos pelo jogo.

## Consequências

- Uma Jornada continua normalmente usando a versão de Mundo à qual já está vinculada, se nenhuma atualização for aceita.
- Atualizações do Mundo são opcionais para Jornadas em andamento.
- A aceitação e a aplicação de versões deverão respeitar os mecanismos de persistência (ADR-007), memória canônica separada (ADR-008), e autonomia controlada do Narrador (ADR-004).
- Diferentes Jornadas podem estar vinculadas a diferentes versões do mesmo Mundo e ainda manter estados independentes.
- A evolução do Mundo de origem não equivale a reescrever eventos históricos de suas Jornadas derivadas.

## Não decidido nesta ADR

- Modelo exato de versionamento e armazenamento (snapshot, eventos, delta, semver etc.).
- Interface de comparação e consentimento; estratégia para resolver conflitos e alterações parcialmente aplicáveis.
- Reversibilidade, backups, salvamentos, reindexação de dados e atualização de mapas.
- Aprovação e canonização de conhecimento extraído de wikis e documentos (P-24).

## Critérios de aceite propostos

1. Editar um Mundo cria uma versão identificável sem modificar uma Jornada previamente iniciada.
2. Uma Jornada pode seguir usando sua versão anterior mesmo quando há versões novas.
3. Uma atualização solicitada detecta conflitos relevantes com acontecimentos e fatos canônicos da Jornada.
4. A aplicação de mudanças não substitui silenciosamente o estado canônico da Jornada.
5. Duas Jornadas baseadas no mesmo Mundo podem usar versões diferentes sem compartilhar consequências.
