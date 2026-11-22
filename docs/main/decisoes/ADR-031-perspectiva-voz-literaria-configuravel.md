# ADR-031 — Perspectiva literária configurável e consistência entre capítulos

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Questão:** P-30
- **Origem:** aprovação explícita do responsável pelo Henduran

## Contexto

As ADR-023 e ADR-030 determinam que o Henduran terá diário narrativo e livro literário exportável, produzidos apenas quando o jogador solicitar. Faltava decidir como os textos seriam narrados e como preservar a unidade literária de entradas e capítulos.

## Decisão

O jogador poderá configurar a **perspectiva literária em primeira ou terceira pessoa**, bem como **parâmetros de voz narrativa**. A geração e a revisão assistidas por IA devem respeitar a perspectiva e a voz escolhidas, buscando **consistência entre capítulos e entradas** de uma mesma obra.

A configuração literária não altera os fatos canônicos, o histórico da Jornada, o motor mecânico ou a política de geração somente sob demanda já aprovada na ADR-030.

## Consequências

- O módulo literário deve representar a configuração de perspectiva e voz separadamente do estado canônico do jogo.
- Ao gerar ou revisar textos, usar a configuração selecionada como referência de consistência.
- O sistema deve possibilitar ambos os pontos de vista sem exigir um narrador único para todas as Jornadas.
- Revisão por IA deve preservar os acontecimentos efetivos e não acrescentar fatos contraditórios.
- O usuário conserva o controle sobre alterações editoriais. Uma mudança posterior de perspectiva não autoriza reescrita automática não solicitada de capítulos existentes.

## Pendências

- Quais parâmetros de voz serão oferecidos (tom, formalidade, vocabulário, tempo verbal, etc.) e como o jogador os edita.
- Aplicação da configuração por Jornada, por obra, por capítulo ou por entrada; migração quando a perspectiva for alterada.
- Editor, fluxo de aprovação e histórico de versões do texto literário.
- Formatos e processo de exportação, capítulo e livro final.
