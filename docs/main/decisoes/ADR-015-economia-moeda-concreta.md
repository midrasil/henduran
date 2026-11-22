# ADR-015 — Economia com moeda concreta e preços de referência do Astra

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Questão:** P-14 do GDD
- **Origem:** Escolha explícita do responsável pelo Henduran

## Contexto

O sistema Astra utiliza um **Valor abstrato** associado a equipamentos, deixando a moeda e as transações para o cenário. No Henduran, o jogador poderá negociar, comprar e vender equipamentos durante uma Jornada persistente e precisa dispor de recursos monetários que possam ser efetivamente debitados ou creditados.

## Decisão

**O Henduran utilizará moeda concreta, com preços inicialmente baseados no Valor dos equipamentos do Astra.**

- O personagem possui um saldo monetário explícito, persistente e rastreável.
- Os Valores do Astra serão usados como **referência inicial** para estabelecer preços, não como moeda em si.
- Transações concluídas precisam produzir alterações válidas no dinheiro e no inventário, por meio do motor de jogo e de ferramentas controladas, não apenas por afirmações do Narrador.
- A escolha não aprova uma economia procedural complexa, mercados dinâmicos ou sistema de fabricação de itens.

## Consequências e critérios de aceite

1. O modelo de personagem e a persistência devem prever saldo monetário; a unidade exata ainda não foi escolhida.
2. A aplicação precisa distinguir **Valor de referência** e **preço de transação**.
3. Uma compra não pode criar um item sem o débito correspondente nem debitar recursos sem registrar a entrega correspondente.
4. Falha de validação ou saldo insuficiente não deve produzir transação parcial.
5. Repetir a mesma solicitação de compra após sua conclusão não deve duplicar o resultado por falha de processamento.
6. O Narrador pode representar a negociação e propor transações; a validação e aplicação são responsabilidades do motor e respeitam as escolhas do jogador (ADR-004).

## Pendências não resolvidas por esta ADR

- Nome da moeda, denominações e equivalência entre denominações.
- Fórmula ou tabela que converte o **Valor abstrato do Astra** em preços concretos do Henduran.
- Descontos, preço de revenda, barganha e eventuais variações de preço.
- Estoques de comerciantes, disponibilidade regional e regras de fornecimento.
- Origem dos recursos monetários iniciais e sua relação com criação de personagem.
- Ordem de implementação detalhada do comércio no motor progressivo (ADR-002).

## Relações

- ADR-002: implementação progressiva das regras adaptadas.
- ADR-004: autoridade do motor e autonomia controlada do Narrador.
- ADR-007: estado oficial da Jornada e histórico de eventos relevantes.
- ADR-009: correções e restaurações consistentes.
