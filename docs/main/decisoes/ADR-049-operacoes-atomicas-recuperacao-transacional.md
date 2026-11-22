# ADR-049 — Operações atômicas e recuperação transacional

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Questão:** P-48
- **Origem:** Aprovação explícita do responsável pelo Henduran

## Contexto

A ADR-007 define persistência híbrida de estado atual e eventos relevantes. A ADR-039 define salvamentos automáticos e manuais; a ADR-048 define gatilhos para checkpoints. O jogo precisa manter consistência quando uma única ação altera diversos componentes do estado e a aplicação é interrompida.

## Decisão aprovada

O Henduran implementará **operações atômicas e mecanismos transacionais**, garantindo que uma alteração lógica validada seja persistida **integralmente ou não seja aplicada**. Após travamentos, falhas de gravação ou desligamento inesperado, a aplicação deverá recuperar automaticamente o **último estado transacional consistente**. Essa integridade é independente da criação de um novo checkpoint restaurável.

Uma compra que envolva saldo, inventário e estoque não poderá persistir somente uma parte dos efeitos. O estado canônico e os eventos relevantes associados à mesma operação deverão ser coerentes entre si. O aplicativo não deve reaplicar efeitos confirmados de forma duplicada ao recuperar ou repetir operações.

## Consequências

- Definir fronteiras de transação por alteração lógica do motor.
- Registrar efeitos e eventos relacionados de forma consistente.
- Recuperar automaticamente transações interrompidas para um estado válido.
- Diferenciar durabilidade de operações confirmadas de criação de checkpoints.
- Testar falhas e repetição de comandos em operações compostas, como inventário, comércio e combate.

## Não decidido

- Banco de dados (SQLite permanece candidato, não decisão).
- Implementação de transações, journaling, locks, comunicação entre processos e filesystem.
- Garantias específicas de durabilidade de disco, backups internos e estratégias de replay.
- O histórico integral de eventos como fonte única do estado (*event sourcing*) **não** foi aprovado: o modelo híbrido da ADR-007 permanece.
- Frequência dos checkpoints, retenção, formato interno dos backups ZIP e técnicas concretas de recuperação.
