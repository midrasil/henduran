# ADR-040 — Retenção híbrida de salvamentos automáticos

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Questão:** P-39
- **Origem:** Aprovação explícita do responsável pelo Henduran

## Contexto

A ADR-039 aprovou autosaves após alterações relevantes, saves manuais identificáveis e restauração de estados anteriores consistentes. Restava estabelecer uma política de retenção de autosaves que equilibrasse recuperação de progresso recente e preservação de pontos narrativos importantes sem exigir armazenamento ilimitado.

## Decisão aprovada

O Henduran adotará **retenção híbrida** de salvamentos automáticos:

- Preservar um conjunto de **autosaves recentes** para recuperação de problemas próximos ao estado atual.
- Preservar **checkpoints automáticos associados a marcos importantes** da Jornada para recuperar momentos narrativos relevantes.
- Permitir o descarte dos demais autosaves conforme política a ser detalhada e testada.
- Manter **salvamentos manuais independentes** dessa política de rotação ou exclusão automática.

Um marco importante para retenção não precisa ser obrigatoriamente um marco de XP; a escolha de preservar um checkpoint não concede recompensa mecânica. Todo checkpoint preservado deve representar um estado completo e coerente para restauração conforme ADR-009 e ADR-039.

## Consequências para a implementação

- Diferenciar autosaves recentes, checkpoints protegidos de marcos e saves manuais.
- Evitar remoção automática de salvamentos manuais por políticas aplicadas aos autosaves.
- Manter integridade de histórico, memória e estado ao recuperar qualquer ponto retido.
- Permitir que a política de descarte seja testada sem definir agora contagens ou intervalos arbitrários.

## Pendências não aprovadas

- Quantidade máxima de autosaves recentes.
- Quantidade ou prazo de retenção de checkpoints de marcos.
- Critérios objetivos para selecionar marcos que geram pontos protegidos.
- Frequência e gatilhos exatos dos salvamentos automáticos.
- Formato físico, gerenciamento de armazenamento e comportamento ao restaurar e continuar uma Jornada.
