# ADR-041 — Ramificação automática ao continuar de um salvamento anterior

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Questão:** P-40
- **Origem:** Aprovação explícita do responsável pelo Henduran

## Contexto

As ADR-007, ADR-009, ADR-039 e ADR-040 estabeleceram a persistência de estado e histórico, restauração integral de salvamentos, salvamentos híbridos e retenção seletiva. Restava definir o que acontece com uma continuidade já construída quando o jogador retorna a um ponto anterior e prossegue de outra forma.

## Decisão aprovada

**Continuar a jogar a partir de um salvamento anterior cria automaticamente uma nova ramificação independente da Jornada.** A continuidade anterior será preservada e poderá ser consultada ou retomada. Nenhum progresso posterior ao ponto restaurado será sobrescrito destrutivamente apenas porque o jogador prosseguiu por uma nova linha.

A nova ramificação começa com o **estado consistente do ponto restaurado** e evolui com seu próprio histórico de eventos, memória, dados mecânicos, inventário, NPCs, relações e contador de derrotas. Alterações posteriores de uma linha não são aplicadas silenciosamente às outras; não se admite transferência arbitrária de consequências, itens ou derrotas entre ramificações.

A simples consulta a um ponto salvo não precisa gerar uma ramificação; o comportamento aprovado se aplica à **continuação efetiva** de uma Jornada a partir de estado anterior.

## Consequências

- Rastrear a origem de cada ramificação e a referência ao ponto salvo de onde ela surgiu.
- Preservar a continuidade de origem ao criar a linha derivada.
- Isolar estado e histórico para evitar cruzamento entre ramificações.
- Permitir restauração de snapshots coerentes, inclusive contador de derrotas conforme o ponto recuperado.
- Manter válidas a política de salvamentos híbridos (ADR-039) e a retenção seletiva (ADR-040).

## Pendências não aprovadas

- Interface, nomenclatura, árvore/histórico e escolha entre ramificações.
- Formato físico de armazenamento, identificação e referências compartilhadas/duplicadas.
- Regras de limpeza, exclusão e arquivamento de ramificações; proteção contra perda acidental.
- Comportamento de autosaves, saves manuais e checkpoints de marcos dentro de cada linha.
- Quantidades, intervalos e frequência dos salvamentos, ainda não fixados.
