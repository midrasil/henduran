# ADR-048 — Autosaves após alterações persistentes e acontecimentos canônicos

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Questão:** P-47
- **Origem:** Decisão explícita do responsável pelo Henduran

## Contexto

As ADR-007 e ADR-009 definem a persistência híbrida e a restauração de salvamentos, a ADR-039 define autosaves e salvamentos manuais e a ADR-040 define retenção de checkpoints recentes e marcos importantes. Faltava estabelecer os tipos de acontecimentos que provocam um salvamento automático.

## Decisão aprovada

O Henduran gerará **checkpoints automáticos após alterações persistentes do estado da Jornada e acontecimentos canônicos importantes**.

- Mudanças de estado confirmadas pelo motor, incluindo alterações relevantes de inventário, recursos, posicionamento ou localização, condições, resultados de combate, relações e eventos registrados, podem ser gatilhos de autosave, de acordo com critérios a detalhar.
- A consolidação de um acontecimento canônico importante pode produzir checkpoint, incluindo pontos protegidos de marcos, conforme ADR-040.
- O **histórico de mensagens** deve ser persistido adequadamente, mas **registrar uma mensagem não obriga a criar um checkpoint restaurável**.
- Não se aprova o salvamento automático obrigatório após cada interação com o Narrador nem checkpoints periódicos independentemente de mudanças.
- A criação de checkpoints deverá ocorrer sobre estados consistentes, sem gravar efeitos parciais ou contar um mesmo evento repetidamente.

## Compatibilidade com decisões anteriores

A política de retenção segue a ADR-040; salvamentos manuais permanecem disponíveis (ADR-039). A restauração e as ramificações obedecem às ADR-009 e ADR-041. A decisão não determina o formato físico de armazenamento, que é distinto do pacote ZIP portátil da ADR-047.

## Pendências explícitas

- Definição objetiva de todos os gatilhos e quais mudanças justificam checkpoint.
- Agrupamento e deduplicação de alterações consecutivas.
- Intervalos, frequência efetiva e retenção quantitativa dos autosaves.
- Persistência do chat e de eventos durante quedas, travamentos e transações incompletas.
- Consistência transacional, desempenho e implementação do armazenamento.
