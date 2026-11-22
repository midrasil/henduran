# ADR-030 — Geração de entradas literárias somente mediante solicitação

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Questão:** P-29
- **Origem:** Aprovação explícita do responsável pelo Henduran

## Contexto

A ADR-023 aprovou diário narrativo, livro literário exportável, capítulos e revisão assistida por IA. A geração das entradas ainda precisava de uma política de acionamento. As alternativas discutidas foram: geração automática após acontecimentos relevantes, geração exclusivamente a pedido e sugestões automáticas com geração controlada.

## Decisão

**Escolhida a opção B: entradas literárias são geradas somente mediante solicitação explícita do jogador.** Nenhum acontecimento, marco, mudança de cena, término de arco ou mensagem do Narrador dispara automaticamente uma entrada literária.

**O registro canônico é independente e continua automático** nos termos das decisões já aprovadas: eventos, estado mecânico, histórico persistente e fatos estabelecidos permanecem disponíveis mesmo sem a geração de textos literários. A solicitação de uma entrada deriva texto literário desse material, sem alterar o cânone.

## Implicações

- Disponibilizar uma ação explícita para solicitar entrada literária, cujo desenho de UX será detalhado depois.
- A IA utiliza o histórico canônico como referência para a geração literária.
- Não presumir notificações/sugestões automáticas de entrada: foram rejeitadas como gatilho de geração nesta decisão.
- Não confundir geração de diário com registro de eventos, resumos internos de memória ou geração de livro completo; são processos distintos.
- Manter a rastreabilidade e a separação entre fatos canônicos e redação literária derivada, conforme ADR-023.

## Pendências

- Escopo de cada solicitação (evento, intervalo, capítulo, arco), granularidade e interface de geração.
- Perspectiva, voz narrativa, personalização do estilo, editor humano e processos de revisão.
- Formatos e etapas da exportação literária, composição de capítulos, custos de inferência e limites operacionais.

## Critérios de aceite propostos

- Sem solicitação do jogador, não há nova entrada de diário literário.
- Eventos e estado da Jornada são persistidos independentemente do diário.
- Após solicitação, o texto produzido corresponde a fatos canônicos e não muda a ficha nem o Mundo.
