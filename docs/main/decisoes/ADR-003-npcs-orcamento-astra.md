# ADR-003 — NPCs e criaturas com orçamento de criação Astra

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Questão:** P-05

## Contexto

A implementação inicial do Henduran não incluirá Competências e Capacidades. Parte do bestiário do Astra usa Capacidades para efeitos especiais. O sistema original dispõe de orçamento de criação por patamar em `Regras/Criaturas/Criação de NPCs.md`.

## Decisão

**Adaptar NPCs existentes removendo Competências e Capacidades, com revisão de equilíbrio, utilizando inicialmente o orçamento de criação de NPCs do Astra.**

Os cinco patamares originais são **Capanga, Par, Veterano, Elite e Lendário**. As respectivas somas de Atributos/Perícias são **12/8, 15/18, 16/22, 17/26 e 19+/30**. A regra original também define tetos individuais de Atributos e Perícias e de Absorção natural, que devem ser consultados na fonte quando as fichas forem geradas.

O orçamento é **referencial**, não uma fórmula de dificuldade exata. Os Pontos de Capacidade do Astra original não se convertem automaticamente em outras vantagens e não serão redistribuídos sem nova decisão.

## Consequências

- NPCs e criaturas podem ser reaproveitados mediante adaptação documentada de suas fichas.
- A retirada de Capacidades pode alterar a identidade mecânica e a periculosidade; casos relevantes exigem testes e eventual revisão posterior.
- O Narrador IA pode improvisar conceito e descrição, mas a ficha mecânica e seu patamar precisam ser validados pelo motor determinístico.
- A régua de encontros do Astra usa como referência grupos; seu uso para **um único personagem de jogador** deve ser validado antes de autorizar encontros procedurais de combate.
- Não introduzir substitutos funcionais de Capacidades com novos nomes sem decisão explícita.

## Questões pendentes

1. Definir quais criaturas adaptadas estarão disponíveis no primeiro marco de combate.
2. Avaliar individualmente criaturas que dependiam de Capacidades para locomoção especial, sentidos, regeneração e ataques extraordinários.
3. Validar o desafio de encontros para jogo solo e com possíveis NPCs aliados.
4. Aprovar eventuais alterações da tabela de orçamento na wiki interna do Henduran.

## Referências

- https://github.com/midrasil/astra-rules/blob/main/Regras/Criaturas/Cria%C3%A7%C3%A3o%20de%20NPCs.md
- https://github.com/midrasil/astra-rules/blob/main/Regras/Criaturas/Ficha%20de%20NPC.md
