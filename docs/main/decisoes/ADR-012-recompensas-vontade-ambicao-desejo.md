# ADR-012 — Recompensas de Vontade por Ambição e Desejo

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Questão:** detalhamento da P-03 e adaptação da P-02
- **Origem:** decisão explícita do responsável pelo Henduran

## Contexto

No Astra de origem, o progresso ativo na Ambição converte 1 ponto de dano agravado de Vontade em superficial, ao final de sessão; cumprir Desejo recupera 1 ponto de dano superficial de Vontade, uma vez por sessão. O Henduran possui Jornada contínua, sem sessão de mesa como unidade universal (ADR-010), e permite alterar objetivos conforme os acontecimentos (ADR-011).

## Decisão aprovada

Preservar **inicialmente os efeitos originais** de Vontade, vinculando-os a **acontecimentos narrativos significativos** e impedindo **concessões duplicadas pelo mesmo progresso**.

- **Ambição:** após progresso ativo significativo e validado, converter **1 ponto de dano agravado de Vontade em superficial**. O progresso deve corresponder a acontecimento identificável; não basta repetir a descrição de uma ação anterior.
- **Desejo:** quando o Desejo atual é efetivamente cumprido em acontecimento validado, recuperar **1 ponto de dano superficial de Vontade**. A conclusão encerra aquele Desejo; não se concede a recompensa novamente pela mesma conclusão.
- **Sem reabastecimento por Cena:** abrir/fechar Cenas, alterar redação de objetivos, solicitar correções ou repetir a mesma informação não reinicia limites e não cria recompensas.
- **Validação mecânica:** o Narrador pode reconhecer e propor um marco, mas a alteração de Vontade deve passar pela validação do motor Astra adaptado, com registro persistente do acontecimento e do benefício aplicado.
- **Balanceamento:** limites adicionais de frequência, inclusive entre marcos distintos, serão avaliados por testes; nenhum valor ou período adicional é aprovado nesta ADR.

## Critérios de aceite para a implementação

1. O mesmo identificador de marco de Ambição não pode gerar duas conversões de Vontade.
2. A conclusão de um Desejo não pode conceder a recuperação mais de uma vez.
3. Um novo Desejo declarado após abandono não concede recuperação automática.
4. Se não há dano elegível para converter ou recuperar, o motor não pode criar pontos de Vontade excedentes.
5. Toda alteração efetiva de Vontade deve deixar registro recuperável e permanecer consistente após salvamento/restauração conforme ADR-007/ADR-009.
6. A aprovação de um marco narrativo não dispensa os controles de permissões do Narrador da ADR-004.

## Não decidido por esta ADR

- Frequência máxima de benefícios em marcos **distintos** ou limites adicionais antiabuso.
- Algoritmo ou critério objetivo de qualificação de um avanço de Ambição.
- Regras específicas de Convicções, Fraturas, Pilares e demais benefícios que no Astra são por sessão.
- Ritmo e condições para conceder XP.

## Relações

- ADR-004 — autonomia do Narrador sob validação mecânica.
- ADR-007/ADR-009 — persistência e restauração.
- ADR-010 — acontecimentos significativos, sem sessão universal.
- ADR-011 — alteração condicionada de Ambição e Desejo.
