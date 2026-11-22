# 02 — Loop de Gameplay

**Status:** especificação funcional inicial. Não fixa algoritmos, APIs nem formatos de arquivos.

## 1. Princípio central

O **chat é o núcleo de interação**. O mapa-múndi, o mapa localizado, o inventário e o grid de combate são superfícies auxiliares para mostrar o estado do mundo e executar ações. A Jornada alterna entre **Fora de Cena** e **Em Cena**, mantendo um único estado persistente.

## 2. Fora de Cena

Quando não há Cena ativa, o jogador pode:

- conversar diretamente com o Narrador, tirar dúvidas, planejar e solicitar esclarecimentos;
- consultar personagem, Ambição, Desejo, inventário, histórico e informações conhecidas;
- mover-se pelo mapa-múndi hexagonal manualmente ou escolher um destino para deslocamento automático;
- declarar ações que possam iniciar uma Cena, sem depender de sorteio de evento.

O motor processa movimentação e passagem de tempo, conforme regras do Henduran. A exploração não deve chamar o modelo de IA a cada hexágono sem necessidade. Uma viagem automática pode ser interrompida e, se ainda válida, retomada.

**Distinção:** uma conversa sobre o que o jogador *poderia* fazer não executa essa ação. Uma intenção efetiva deve ser interpretada e encaminhada ao fluxo apropriado, com confirmação quando necessária.

## 3. Início de Cena

Uma Cena pode começar quando:

1. o jogador procura uma interação contextualizada (ir ao ferreiro, conversar com um guarda, investigar uma casa);
2. um NPC aborda o personagem ou acontece uma consequência de fatos anteriores;
3. o jogador encontra algo relevante durante exploração;
4. um evento procedural apresenta situação que merece acompanhamento narrativo;
5. um desenvolvimento da narrativa exige uma interação localizada.

O início deve registrar contexto mínimo: motivo, local, momento, participantes conhecidos e estado relevante. O chat da Cena é distinto do canal de conversa Fora de Cena.

## 4. Durante a Cena

Ciclo conceitual:

1. O jogador envia uma fala, pensamento ou ação em linguagem natural.
2. O orquestrador reúne o contexto pertinente, incluindo regras e fatos conhecidos.
3. O Narrador interpreta a intenção e responde; se necessário, solicita ferramentas do motor.
4. O motor valida operações, calcula resultados e persiste consequências autorizadas.
5. O Narrador incorpora resultados oficiais à narrativa.
6. O histórico do chat e os fatos importantes ficam disponíveis para continuidade.

### Ações e testes

A IA pode propor um teste apropriado à situação, mas **não rola dados por conta própria**. O motor resolve a mecânica de acordo com as regras adaptadas. A política de confirmação de testes fora de combate será documentada antes da implementação e não deve ser inventada pelo agente programador.

### Comércio

Uma compra exige verificação de item, preço, recursos e demais restrições. A descrição do Narrador não equivale por si só a uma transferência de dinheiro ou item.

### Componente espacial

Uma Cena pode exibir um mapa localizado e tokens em moeda quando isso acrescenta clareza. **Toda Cena tem chat, mas nem toda Cena precisa de mapa ou combate.** Em resolução tática, o motor governa posições e movimentos válidos em grid, conforme a adaptação do Astra.

## 5. Encerramento de Cena

A Cena termina quando a situação contextualizada foi resolvida ou deixou de exigir acompanhamento direto. Ao encerrar:

- registrar consequências mecânicas e fatos persistentes confirmados;
- conservar histórico e vínculo com participantes, lugar e momento;
- registrar informações relevantes para memória e continuidade;
- atualizar Ambição e Desejo **apenas conforme as regras adaptadas**;
- retornar ao contexto Fora de Cena ou entrar em outra Cena se houver continuidade justificada.

Encerrar uma Cena não restaura automaticamente recursos, não concede XP por padrão e não equivale ao término de sessão de RPG de mesa.

## 6. Exemplo mínimo de ponta a ponta

**Fora de Cena:** jogador em uma cidade escreve: “Quero ir à ferraria comprar uma espada longa.”  
**Transição:** sistema determina local e abre uma Cena contextualizada com o ferreiro.  
**Cena:** Narrador descreve a ferraria e interpreta o NPC; jogador negocia, examina a arma e aceita ou recusa a proposta.  
**Motor:** compra confirmada é validada; inventário e recursos financeiros são atualizados.  
**Encerramento:** o jogador se despede; a Cena é arquivada e o mundo retém a compra e os fatos relevantes.  
**Fora de Cena:** jogador retoma seus planos ou movimentação no mapa.

## 7. Pendências deliberadas

- Quais operações exigem confirmação explícita e como a contestação funciona.
- Como cenas suspensas/reabertas são representadas.
- Quais acontecimentos exigem IA, quais são resolvidos deterministicamente.
- Regras de viagem, ritmo de eventos e geração do mapa-múndi.
- Regras de tempo narrativo e simulação de NPCs.
- Composição e geração de mapas locais e condições de exibição.
