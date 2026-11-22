# Dia do Mundo e Descanso Prolongado

**Status:** aprovada para a fatia 1 em 2026-11-22. Versão das regras: `fatia-1`.

**Origem:** `Regras/Personagens/Descanso Prolongado.md` (Descanso). O Dia do Mundo é **novo** no Henduran. Decisões: ADR-010, ADR-073.

## Dia do Mundo **[ADAPTAÇÃO — ADR-073]**

- O **Dia do Mundo** começa no **Amanhecer** do mundo da Jornada.
- O tempo é **estado do mundo**: data do calendário e período do dia. O Narrador **propõe** que o tempo avance e o motor **valida e registra**. Não se usa o relógio real (`docs/ui-ux/07-ambiente-dia-noite.md`).
- O Dia é um **limitador**, e não um gatilho: cada benefício precisa de um acontecimento validado; o Dia só impede repeti-lo além do teto.
- Cenas não reiniciam limites.

### Tetos de uma vez por Dia

| Benefício | Onde está |
| --- | --- |
| Conversão de Vontade por progresso na Ambição | `07` |
| Recuperação de Vontade por cumprir o Desejo | `07` |
| Recorrer a um Pilar (total) | `06` |
| Reparar Fratura (uma por Convicção) | `06` |
| Benefício de defender Convicção ou Pilar (total) | `06` |
| Descanso Prolongado | abaixo |
| Tratamento (por personagem) **[FATIA 3]** | `04` |

Os valores são iniciais e estão sujeitos a testes de equilíbrio.

## Descanso Prolongado **[ASTRA]**

Várias horas contínuas de repouso, normalmente uma noite de sono, em condições que permitam descansar. Ao completar:

- recupera dano superficial de **Vida** igual ao **Vigor**;
- recupera **todo o dano superficial de Vontade**.

Não recupera nem converte dano agravado. Se um conflito ou esforço significativo interrompe o descanso, ele **não se conclui** e precisa recomeçar; interrupções breves (como um turno de vigia) não impedem. Só vale **uma vez por Dia**.

**Na fatia 1:** vale a recuperação de **Vontade**. A de Vida só terá efeito quando houver dano (fatia 3). **[ADAPTAÇÃO — decisão do responsável]** O Descanso foi trazido da fatia 2 porque é a única forma de recuperar o dano superficial de Vontade.

## Pendências

- **[PENDENTE]** Política de avanço de tempo e proteção contra saltos repetidos para reabrir tetos (ADR-073; `02-loop-de-gameplay.md`, seção 7).
- **[PENDENTE]** Definição de Amanhecer em mundos de calendário ou astros diferentes do padrão.
- **[PENDENTE]** Como o motor reconhece "condições que permitam descansar".
