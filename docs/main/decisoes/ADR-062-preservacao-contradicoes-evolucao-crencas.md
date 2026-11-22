# ADR-062 — Preservação de contradições e evolução das crenças

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Questão:** P-61
- **Origem:** Aprovação explícita do responsável pelo Henduran

## Contexto

As ADR-060 e ADR-061 determinam que o motor distinga a verdade canônica do conhecimento de cada entidade e valide aquisições, classificando fatos confirmados, crenças, suspeitas, rumores e alegações. Uma mesma entidade pode receber versões contraditórias sobre um acontecimento, alterar suas convicções ao longo da história ou basear-se em fontes não confiáveis. Substituir simplesmente o registro anterior apagaria o histórico da investigação e criaria risco de tratar relatos como verdades.

## Decisão aprovada

O Henduran deverá **preservar informações contraditórias**, suas **fontes e evidências** e o **histórico de evolução das crenças de cada personagem**, sem alterar automaticamente a verdade canônica.

- Versões concorrentes poderão coexistir como alegações, hipóteses, suspeitas, rumores ou crenças vinculadas à entidade e ao momento correspondente.
- Cada informação manterá referências à fonte, evidências e proveniência que existirem, sem inferir confirmação pela mera repetição ou recência.
- A adoção, revisão, abandono ou enfraquecimento de uma crença não apagará o registro de que ela foi conhecida ou considerada anteriormente.
- O estado de conhecimento usado pelo Narrador deverá respeitar o momento narrativo, as permissões e a continuidade ativa, inclusive a herança de memórias anterior à divergência (ADR-059).
- Aquisições e alterações persistentes serão validadas pelo motor, de acordo com ADR-061; a IA não promoverá unilateralmente relatos contraditórios a fatos canônicos.
- Uma contradição não obriga o motor a declarar uma versão verdadeira até haver fundamento e procedimento de confirmação válidos.

## Consequências

Será necessário distinguir o estado corrente de conhecimento de seu histórico, associar versões a entidades e fontes, e consultar divergências sem misturar Jornadas ou ramificações. O histórico canônico e as informações acreditadas por personagens continuam separados.

## Pendências explícitas

- Esquema de evidências, proveniência, identidade de fonte e momento de aquisição.
- Regras e pesos de confiança, suficiência e conflitos de evidências.
- Gatilhos e validações para atualização, revisão, abandono e confirmação de crenças.
- Procedimento para casos em que a própria base canônica tenha inconsistências e requer retificação autorizada.
- Interface, consultas, índices, permissões e armazenamento dos registros de conhecimento.
