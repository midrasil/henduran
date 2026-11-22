# ADR-028 — Apenas incapacitações mecânicas em combate contam para a mortalidade

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Questão:** P-27
- **Origem:** Aprovação explícita do responsável pelo Henduran

## Contexto

A ADR-027 estabeleceu um contador permanente de derrotas sobrevivíveis. Ao esgotar esse limite, a derrota elegível **seguinte** causa morte definitiva e encerra a Jornada. Restava definir o que constitui uma derrota elegível para esse contador.

## Decisão

**Somente a incapacitação mecânica do protagonista durante combate** constitui uma derrota elegível para incrementar o contador de mortalidade.

Captura, rendição, fuga, fracasso narrativo, derrota social, falha de teste e insucesso em objetivos não incrementam o contador **por si só**. Se uma situação também provocar uma incapacitação mecânica em combate, a elegibilidade decorrerá dessa incapacitação — não da interpretação narrativa do acontecimento.

A validação da incapacitação cabe ao motor mecânico, não à avaliação discricionária do Narrador IA. Uma mesma incapacitação não pode ser contabilizada repetidamente por mensagens, turnos ou eventos redundantes.

As derrotas elegíveis seguem a regra da ADR-027: são permanentes, acumulam-se até esgotar o número de derrotas sobrevivíveis e **somente a derrota elegível posterior ao esgotamento desse número** causa morte definitiva e encerramento da Jornada.

## Consequências para a implementação

- Definir sinal/evento mecânico verificável de incapacitação em combate.
- Registrar cada derrota elegível com referência ao combate e ao evento que a originou, evitando contagem duplicada.
- Não contabilizar derrotas narrativas como causa autônoma de mortalidade.
- Preservar a possibilidade de outras consequências narrativas ou mecânicas para captura, rendição, fuga e fracassos, sem alterar esse contador.
- Aplicar a mortalidade definitiva apenas conforme a regra combinada das ADR-027 e ADR-028.

## Pendências

- Quantidade exata de derrotas sobrevivíveis, a determinar por testes de balanceamento.
- Definição mecânica específica de incapacitação, de acordo com a adaptação do Astra.
- Consequências das incapacitações sobrevividas e suas exceções; transições para resgate, cativeiro, recuperação e continuidade da Cena.
- Comportamento em situações de múltiplas incapacitações no mesmo combate, a ser especificado sem dupla contagem arbitrária.
