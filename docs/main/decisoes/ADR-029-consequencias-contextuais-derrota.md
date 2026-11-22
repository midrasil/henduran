# ADR-029 — Consequências contextuais das derrotas sobrevividas

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Questão:** P-28
- **Origem:** Aprovação explícita do responsável pelo Henduran

## Contexto

Conforme as ADR-027 e ADR-028, derrotas elegíveis decorrem exclusivamente de incapacitação mecânica em combate e são acumuladas permanentemente. As incapacitações anteriores à morte definitiva devem permitir continuidade significativa da Jornada, com consequências coerentes com o confronto.

## Decisão

As consequências de uma **incapacitação sobrevivida** serão **contextuais, propostas pelo Narrador IA e validadas pelo motor de regras**.

O Narrador considera adversários, ambiente, situação e fatos estabelecidos para propor desdobramentos como captura, perda de equipamento, ferimentos, resgate ou outras consequências plausíveis. Esses exemplos não são uma tabela obrigatória nem concedem permissão para a IA alterar diretamente os recursos ou o estado do jogo.

O motor deve validar e registrar toda alteração mecânica ou persistente aplicável, incluindo condições, inventário, recursos, localização e eventos. A narração sem ferramenta validada não efetiva tais alterações. Consequências devem respeitar continuidade, mecânicas do Astra adaptadas, agência do jogador e restrições de permissões do Narrador (ADR-004).

Não se estabelece uma **penalidade fixa e universal** para todas as derrotas. Tampouco se altera a regra de mortalidade progressiva ou se amplia o conjunto de derrotas elegíveis.

## Implicações

- Propor consequências plausíveis considerando o combate específico.
- Validar alterações por ferramentas explícitas do motor antes de persistir mudanças.
- Registrar os efeitos no estado e histórico da Jornada, preservando consistência entre o ocorrido e o Narrador.
- Evitar aplicação duplicada de consequências ao reprocessar o mesmo resultado.
- Manter limites de autoridade do Narrador e ações do personagem sob controle do jogador.

## Pendências

- Penalidades específicas, sua magnitude, duração, disponibilidade e critérios de aplicação.
- Regra exata de incapacitação e número de derrotas toleradas (ambos pendentes de detalhamento e balanceamento).
- Casos-limite de resgate, captura, fuga, transição de cena, participantes hostis e alternativas quando um efeito proposto não é validado.
