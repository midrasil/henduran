# ADR-014 — Concessão de XP por marcos narrativos

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Origem:** decisão explícita do responsável pelo Henduran

## Contexto

O Astra original sugere conceder XP ao final de sessões de mesa. O Henduran é uma Jornada contínua, sem sessões tradicionais; a ADR-010 já aprovou adaptar mecânicas ligadas a sessões com critérios próprios baseados em acontecimentos relevantes.

## Decisão

**[CONFIRMADO]** O Henduran concederá XP por **marcos narrativos e conquistas significativas**: conclusão de objetivos, superação de desafios relevantes, descobertas decisivas e mudanças importantes na Jornada são exemplos de acontecimentos elegíveis, sujeitos à validação.

O Narrador IA poderá identificar e propor um marco, mas **não concederá XP por texto livre nem alterará diretamente a ficha**. A concessão passa pelo motor de regras, que valida a elegibilidade, registra a origem e evita repetir a recompensa do mesmo marco.

Não haverá concessão automática de XP por quantidade de mensagens, testes, início ou fim de uma Cena, ou mera passagem de tempo.

**[PENDENTE]** Quantidades exatas de XP, critérios verificáveis de significância, distinção entre tipos de marcos, limitações adicionais e ritmo de progressão serão definidos em testes de balanceamento. Os custos de compra de melhorias serão especificados na wiki própria do Henduran; o Astra é referência, não dependência permanente.

## Consequências e verificações

- Cada XP concedido precisa ter evento de origem e identificador para evitar duplicação.
- Reabrir uma Cena, solicitar nova narração ou restaurar contexto não deve conceder XP repetido.
- Correções e restauração de salvamentos obedecem à ADR-009, preservando consistência de eventos e recursos.
- Marcos devem poder ocorrer tanto em Cenas narrativas quanto em situações táticas ou durante exploração, sem exigir combate.
- Um marco reconhecido sem tabela de recompensa definida não autoriza criar valores arbitrários.

## Pendências relacionadas

- P-14: economia e comércio.
- Critérios detalhados de progressão e tabela de recompensas da wiki adaptada.
