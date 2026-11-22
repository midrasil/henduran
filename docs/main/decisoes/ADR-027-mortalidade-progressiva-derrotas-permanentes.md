# ADR-027 — Mortalidade progressiva com contador permanente de derrotas

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Questão:** P-26 do GDD
- **Origem:** Aprovação explícita do responsável pelo Henduran (conceito de mortalidade progressiva; opção A de derrotas permanentes)

## Contexto

A ADR-022 instituiu Jornadas contínuas, com encerramento opcional após arcos narrativos. Ficava pendente o tratamento da derrota e da morte do protagonista. O responsável propôs que uma derrota não resulte necessariamente em morte, mas que derrotas acumuladas aproximem o personagem da morte definitiva.

## Decisão

O Henduran utilizará **mortalidade progressiva com contador permanente de derrotas elegíveis**:

1. O protagonista pode sobreviver às derrotas iniciais, que podem produzir consequências mecânicas e narrativas a detalhar.
2. Cada derrota elegível incrementa o contador persistente e **não pode ser removida ou recuperada** por descanso, cura, tratamento ou conclusão de arco.
3. Existe um limite de **derrotas sobrevivíveis**, cujo valor numérico **não está aprovado**.
4. Uma vez esgotado esse limite, a **derrota elegível seguinte** resulta em morte definitiva do protagonista e **encerramento da Jornada**.
5. O motor do jogo valida a elegibilidade da derrota, registra o incremento de maneira rastreável e executa o desfecho; uma descrição do Narrador não altera o contador por si só.
6. A regra não declara que qualquer falha em teste, dano sofrido ou resultado negativo de Cena seja automaticamente uma derrota elegível.

A morte definitiva aqui definida é exceção ao encerramento normalmente opcional da Jornada (ADR-022). Ela não equivale à conclusão de Ambição nem implica automaticamente a possibilidade de sucessão de protagonista dentro da mesma Jornada.

## Consequências

- Manter contador persistente na Jornada, vinculado ao protagonista, sem recuperação de marcações.
- Exibir ao jogador o progresso da mortalidade de forma inequívoca, respeitando a quantidade de derrotas ainda pendente.
- Separar falha de teste, incapacitação, derrota elegível, sobrevivência com consequências e morte definitiva.
- Registrar as consequências dos eventos de derrota na história canônica e, quando apropriado, no diário literário da ADR-023.
- Garantir que o Narrador não atribua morte definitiva nem incrementos ao contador fora de ferramentas validadas.

## Pendências não aprovadas

- Número exato de derrotas sobrevivíveis e seu balanceamento.
- Critérios de derrota elegível: incapacitação, rendição, captura, fuga, derrota fora de combate, abandono, morte instantânea e casos de NPCs.
- Qualidade e severidade das consequências de derrotas não fatais.
- Exceções, salvamentos, morte por causas não cobertas pelo contador e outras condições extraordinárias.
- Telas de encerramento, epílogo, reabertura de Jornadas e interface de visualização do contador.

## Critérios de aceite propostos

- Derrotas elegíveis anteriores ao esgotamento do limite não causam morte automática.
- O contador aumenta apenas após validação mecânica e as marcas não desaparecem.
- Após esgotar a quantidade tolerada, a próxima derrota elegível causa morte definitiva e encerra a Jornada.
- Falhar um teste ou receber dano, isoladamente, não incrementa o contador.
