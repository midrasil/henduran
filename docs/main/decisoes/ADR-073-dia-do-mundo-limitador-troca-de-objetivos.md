# ADR-073 — Dia do Mundo como limitador de benefícios e troca de objetivos pelo jogador

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Refina:** ADR-010 (marcos narrativos em vez de sessões) e ADR-011 (alteração de Ambição e Desejo)
- **Complementa:** ADR-012, ADR-013 e ADR-022
- **Origem:** Decisão explícita do responsável pelo Henduran, durante a adaptação da fatia 1 das regras do Astra

## Contexto

O ADR-010 decidiu que o Henduran não terá uma unidade universal no lugar da sessão e alertou que tratar o dia ficcional como sessão criaria frequências artificiais. Os ADR-012 e ADR-013 ligaram os benefícios de Vontade a **acontecimentos significativos validados**, com identificador único por marco, e deixaram **em aberto** os limites adicionais de frequência entre marcos distintos. O ADR-011 permitiu trocar a Ambição apenas por acontecimento significativo, conclusão ou transformação real das motivações.

## Decisão aprovada

1. **O Dia do Mundo é um limitador, não um gatilho e não substitui a sessão em todas as regras.** O gatilho de cada benefício continua sendo um acontecimento significativo validado pelo motor, com identificador único (ADR-012 e ADR-013). O Dia só impõe **um teto de frequência** a benefícios específicos.
2. **O Dia do Mundo começa no Amanhecer** do mundo da Jornada. O tempo é estado do mundo (data do calendário e período do dia). O Narrador propõe o avanço do tempo e o motor valida e registra (`docs/ui-ux/07-ambiente-dia-noite.md`).
3. **Tetos iniciais de uma vez por Dia**, sujeitos a testes de equilíbrio (ADR-010, consequência 5):
   - conversão de Vontade por progresso na Ambição;
   - recuperação de Vontade por cumprir o Desejo;
   - recorrer a um Pilar (uma vez por Dia, no total);
   - reparar Fratura (uma vez por Dia para cada Convicção);
   - o benefício de defender Convicção ou Pilar (uma vez por Dia, no total);
   - Descanso Prolongado.
4. **Cenas não reiniciam limites.** Abrir ou encerrar Cenas, avançar o tempo sem acontecimento validado ou reescrever um objetivo não concede benefício nem reinicia teto (ADR-010 e ADR-012).
5. **O jogador pode trocar o Desejo a qualquer momento** quando ele for concluído, abandonado ou **deixar de fazer sentido**, o que já era permitido pelo ADR-011.
6. **O jogador pode trocar a Ambição a qualquer momento** quando ela for concluída, se tornar impossível ou **deixar de fazer sentido para ele**. Esta decisão **substitui a condição mais restrita** da Ambição no ADR-011 (acontecimento significativo ou transformação real das motivações).
7. **A troca de objetivo não concede recompensa nem reinicia limites**, como no ADR-011. O Narrador pode sugerir uma troca, mas não a impõe. O motor registra o motivo (concluído, abandonado, impossível ou deixou de fazer sentido).
8. Concluir uma Ambição encerra um **arco**, não a Jornada (ADR-022).

## Consequências

- O motor guarda, por personagem, os usos de cada benefício por Dia do Mundo, além do identificador de cada marco.
- Avançar o tempo para "reabastecer" benefícios é um risco: um novo Amanhecer reabre o teto, mas o benefício ainda exige um **novo acontecimento validado**. O Descanso Prolongado exige repouso real e é interrompido por conflitos.
- A wiki `rules/` passa a descrever o teto por Dia em cada regra afetada.

## Em aberto

- Valores definitivos dos tetos e se algum benefício precisa de limite entre Dias (testes de equilíbrio).
- Política de avanço de tempo narrativo e proteção contra saltos repetidos (`02-loop-de-gameplay.md`, seção 7).
- Definição de Amanhecer em mundos cujo calendário ou astros sejam diferentes dos do padrão.
- Critério objetivo de "progresso significativo" na Ambição e de "defender" uma Convicção (ADR-012 e ADR-013).
