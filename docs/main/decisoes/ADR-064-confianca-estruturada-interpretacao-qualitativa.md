# ADR-064 — Confiança estruturada com interpretação qualitativa

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Questão:** P-63
- **Origem:** Decisão explícita do responsável pelo Henduran

## Contexto

As ADR-060 a ADR-063 distinguem conhecimento por entidade, fatos, crenças, rumores, alegações e contradições preservadas, com decisões contextuais do Narrador e validação do motor. Faltava decidir a representação do grau com que cada personagem acredita em informações sem confundi-lo com a veracidade objetiva.

## Decisão aprovada

Adotar **modelo híbrido de confiança**:

- O motor mantém uma **medida interna estruturada** do grau de confiança de cada entidade em uma informação, vinculada à Jornada e à continuidade apropriadas.
- O Narrador usa uma **interpretação qualitativa e contextual** dessa medida para expressar hesitação, convicção, dúvida e outras reações plausíveis, considerando personalidade, objetivos e circunstâncias.
- A medida representa a **confiança subjetiva da entidade**, nunca a probabilidade objetiva de a alegação ser verdadeira ou uma autorização para alterar o cânone.
- Evidências ou acontecimentos poderão modificar o grau de confiança após validação do motor, mantendo a história das crenças e as respectivas fontes, conforme ADR-061 e ADR-062.
- Não há obrigação de expor ao jogador os valores internos de confiança.

## Consequências

A implementação deverá distinguir explicitamente avaliação subjetiva e confirmação canônica, preservar coerência temporal por personagem e ramificação, e evitar que a IA modifique os valores persistentes sem passar pelo motor. A modelagem exata ainda não está aprovada.

## Pendências explícitas

- Escala, tipo numérico ou ordinal, limites e precisão dos valores internos.
- Categorias qualitativas e limiares de transição.
- Critérios de relevância e força das evidências, pesos, regras de atualização e conflito entre fontes.
- Eventos que promovem ou reduzem confiança, critérios para confirmação de fatos e respectivas validações.
- Representação persistente, interface, testes e regras específicas de comportamento de NPCs.
