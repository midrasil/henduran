# ADR-076 — Cena inicial montada pelo Narrador e ciclo de Cena no MVP

- **Estado:** Aprovada (a lista de tons de partida do item 4 é **[PROPOSTO]**, à espera de aprovação)
- **Data:** 2026-11-23
- **Complementa:** ADR-004 (autonomia do Narrador com regras e permissões), ADR-006 (confirmação de testes), ADR-071 (`NarratorProvider`), ADR-072 (HTTP com SSE) e ADR-075 (banco por Jornada)
- **Refina:** `ESCOPO-MVP.md`, seção 2, itens 5, 7 e 8, e seção 6, decisão 3
- **Origem:** decisão explícita do responsável pelo Henduran em 2026-11-23

## Contexto

O escopo do MVP diz que o Narrador Geral (**Aduran**) abre as Cenas por intenção do jogador, por iniciativa própria ou por consequência anterior, e que o Narrador da Cena conduz e encerra a Cena. Nenhum documento dizia **como a Jornada começa**: com o jogador Fora de Cena diante de um chat vazio, ou já dentro de uma situação. Também não estavam definidos o formato com que o modelo propõe uma Cena, o momento em que a abertura é gerada nem quem encerra uma Cena.

## Decisão aprovada

1. **Toda Jornada começa Em Cena.** A primeira mensagem do chat é do Narrador, que monta a **Cena inicial** a partir do contexto geral do Mundo (época, tom, calendário, religiões, lugares), do lugar inicial e do personagem (Conceito, descrição, histórico, Ambição e Desejo). O tipo de situação é livre: uma perseguição, a chegada a uma taverna, acordar preso, uma rotina interrompida. A Cena inicial é uma Cena como qualquer outra, aberta por iniciativa do Narrador (`02-loop-de-gameplay.md`, seção 3, itens 4 e 5).
2. **A abertura é gerada na primeira vez que a Jornada é aberta sem mensagens**, e não durante o assistente de Nova Jornada. Criar a Jornada não depende do modelo. Se o modelo não estiver pronto, a tela explica o que falta e oferece **"Gerar abertura"**. Uma abertura cancelada ou com erro não grava a Cena pela metade; o jogador pode gerar de novo.
3. **A Cena inicial acontece no lugar inicial** escolhido no assistente. A Jornada passa a gravar o **id** do lugar inicial (até agora guardava só o local atual).
4. **Tom de partida sorteado pelo motor.** Para evitar aberturas repetidas em modelos locais pequenos, o motor sorteia um tom de partida e o entrega ao Narrador, que decide o resto (situação, motivo, participantes). O tom orienta, mas não impõe combate nem teste. **[PROPOSTO]** Lista inicial:
   - **em movimento**: viagem, fuga, perseguição, travessia;
   - **chegada**: o personagem acaba de chegar ao lugar;
   - **encontro**: alguém procura ou aborda o personagem;
   - **rotina interrompida**: o dia comum é quebrado por algo inesperado;
   - **em apuros**: o personagem já está numa situação difícil (preso, perdido, devendo, ferido só na narrativa, sem dano mecânico na fatia 1);
   - **consequência**: a cena nasce de algo do histórico escrito pelo jogador.
5. **A proposta de Cena é estruturada e validada antes da narração.** A geração de uma abertura de Cena acontece em duas etapas:
   1. o Narrador propõe, em JSON com esquema fixo, o **local** (um lugar do Mundo), o **momento** (período do dia), o **motivo** e os **participantes conhecidos**; o motor valida (por exemplo, o lugar existe no Mundo e o período é válido) e só então grava a Cena;
   2. o Narrador escreve o texto de abertura em *streaming*, a partir da Cena gravada.

   Uma proposta inválida é recusada pelo motor, que pede nova proposta um número limitado de vezes e depois informa o erro, sem inventar a Cena.
6. **Encerramento de Cena:** o jogador encerra por um botão, ou o Narrador **propõe** o encerramento e o jogador confirma. O Narrador não encerra uma Cena sozinho. Ao encerrar, o Narrador propõe um **resumo** da Cena e o motor o grava com a Cena; a Jornada volta para Fora de Cena, com o Aduran.
7. **O texto do Narrador não altera estado.** Abrir Cena, encerrar Cena e gravar resumo só acontecem por operações validadas pelo motor (ADR-004). Fatos persistentes além do resumo, testes (ADR-006) e avanço de tempo (ADR-073) entram depois, cada um com sua validação.
8. **Histórico persistido no `journey.db`** (ADR-075): Cenas (motivo, local, momento, participantes, estado, resumo, abertura e encerramento) e mensagens (canal Fora de Cena ou Cena, Cena de origem, papel, texto e se foi concluída ou cancelada). Reabrir o app retoma o histórico e o estado Fora de Cena ou Em Cena (critério 4 do MVP).

## Consequências

- O motor passa a ter o primeiro ciclo de vida de Cena: nenhuma ou uma Cena aberta por Jornada no MVP, com transições Fora de Cena → Em Cena → Fora de Cena validadas.
- O contexto enviado ao modelo é montado pelo serviço, nunca pela interface: Mundo, ficha com derivados, Ambição e Desejo, Cena atual e mensagens recentes. O Aduran e o Narrador da Cena recebem instruções diferentes sobre o mesmo estado.
- Duas chamadas por abertura de Cena deixam a abertura um pouco mais lenta, em troca de dados de Cena confiáveis com modelos pequenos.
- O provedor falso (`FakeNarratorProvider`) precisa responder também à etapa estruturada, para os testes do critério 6 do MVP.

## Em aberto

- Aprovação da lista de tons de partida (item 4) e o peso de cada tom no sorteio.
- Limite de mensagens recentes no contexto e quando passar a usar resumos (memória fica fora do MVP).
- Como o Narrador sinaliza a proposta de encerramento no texto (cartão no chat, botão sugerido) e o formato do resumo.
- Se uma Cena encerrada pode continuar direto em outra Cena "por continuidade justificada" (`02-loop-de-gameplay.md`, seção 5) sem passar pelo Aduran.
- Reabertura de Cenas encerradas e o `@Aduran` durante a Cena (`ESCOPO-MVP.md`, seção 2, item 6) seguem para a entrega seguinte.
