# Henduran — Escopo do primeiro MVP

**Data:** 2026-11-22
**Status:** os itens **[PROPOSTO]** foram **aprovados pelo responsável em 2026-11-22** e valem como escopo do MVP, exceto os pontos que a seção 6 mantém em aberto. Itens **[DECIDIDO]** vêm de decisão explícita.
**Substitui:** o caso do ferreiro como caso de uso de referência do MVP.

## 1. Objetivo

Validar a experiência central do Henduran como **chat com um Narrador de IA rodando em modelo local gratuito**, seguindo o loop de gameplay (`docs/main/02-loop-de-gameplay.md`): o jogador cria um personagem em um mundo genérico, conversa Fora de Cena e entra e sai de Cenas. **[DECIDIDO]**

## 2. Dentro do escopo

1. **Menu inicial** **[DECIDIDO]**: novo jogo, continuar, gerenciar modelos e sair. Os demais itens (configurações, créditos) ficam **[PROPOSTO]**.
2. **Gerenciamento de modelo local** **[PROPOSTO]**: detectar hardware, baixar ou escolher um modelo GGUF e iniciar o `llama-server` (ADR-070). Sem modelo, o jogo explica o que falta, e não falha em silêncio.
3. **Mundo genérico com gerador simples** **[DECIDIDO]**: o jogo gera um mundo pouco aprofundado, com **calendário, religião ou religiões, lugares iniciais, época e tom**, guardado como dados canônicos que os Narradores recebem como contexto. O gerador é a primeira versão de algo que poderá evoluir para um gerador de mapas e mundos no estilo do Azgaar's Fantasy Map Generator (fora do MVP, sem mapa). **Aprovado em 2026-11-22:** o jogo **sorteia** época, tom, calendário e religiões, e o jogador **edita** o resultado antes de confirmar; os **lugares iniciais** são de 3 a 5, também sorteados e editáveis.
4. **Criação de personagem** **[DECIDIDO]**: nome, descrição e histórico escritos pelo jogador, mais **Ambição e Desejo** (GDD e Astra): a **Ambição** é o que o personagem almeja a **longo prazo** (por exemplo, vingar o irmão) e o **Desejo** é o que quer alcançar a **curto prazo** (por exemplo, concluir o contrato de mercenário atual). Cada personagem tem 1 Ambição e 1 Desejo por vez. **Atualização de 2026-11-22:** as regras do Astra entram no MVP (item 13), então atributos e demais valores mecânicos da ficha passam a fazer parte da criação, **conforme o que for aprovado na adaptação**. Até lá, nada de mecânica é inventado.
5. **Dois Narradores** **[DECIDIDO]**:
   - **Narrador Geral**, chamado **Aduran** no jogo (ver seção 6): por ele o jogador declara as próximas ações, tira dúvidas e decide para onde vai. **É ele quem abre as Cenas**, por intenção do jogador, iniciativa própria ou consequência anterior. Corresponde ao "Fora de Cena" do loop de gameplay.
   - **Narrador da Cena**: conduz uma Cena, com chat contextualizado, e a encerra registrando fatos relevantes.
   - Os dois usam o mesmo `NarratorProvider` e o mesmo estado do motor. Contextos e instruções diferentes.
6. **Como o Narrador Geral aparece na tela** **[DECIDIDO]**: (a) **chat próprio recolhido no canto inferior direito**; (b) **`@Aduran` no chat da Cena**, com a resposta **no próprio chat da Cena**, com **destaque visual diferente** (como a caixa pontilhada do Caliope) e um **botão para ocultar** essas respostas. **[PROPOSTO]** A pergunta e a resposta ficam no histórico visível, mas **não entram no contexto do Narrador da Cena** nem viram fato da história, como o `/pergunta` do Caliope.
7. **Loop de gameplay em chat** **[DECIDIDO]**: Fora de Cena com o Narrador Geral, Cena com início e encerramento, Narrador em *streaming*, com cancelar e regenerar **[PROPOSTO]**. A UI do chat toma como referência o chat do Caliope, sem copiar a estrutura de jogo dele.
8. **Persistência** **[PROPOSTO]**: SQLite (ADR-050) com personagem, Jornada, histórico de chat e fatos registrados; reabrir o app retoma o jogo.
9. **Motor** **[PROPOSTO]**: valida transições Fora de Cena ↔ Cena e a gravação de fatos propostos pelo Narrador, e passa a validar também as regras do Astra que entrarem no MVP (item 13). A IA propõe, o motor valida e aplica. Sem mecânicas inventadas.
10. **UI** **[DECIDIDO]**: pixel art em CSS com tokens próprios (ADR-069), acessível conforme o ADR-068.
11. **Skills** **[DECIDIDO]**: o gerenciador do Caliope e o acervo entram conforme a auditoria. A ativação por cartão ou mundo é **[PROPOSTO]** para o MVP.

12. **Ambiente visual procedural** **[DECIDIDO]**: no lugar das ilustrações, um **ciclo de dia e noite desenhado em código**, com manhã, tarde, entardecer, noite e seus astros, refletindo o estado da **última Jornada jogada**. Detalhes em `docs/ui-ux/07-ambiente-dia-noite.md` (períodos, fonte do horário e acessibilidade são **[PROPOSTO]**). Retratos usam iniciais no MVP.
13. **Regras do Astra** **[DECIDIDO em 2026-11-22]**: entram no MVP, **em três fatias jogáveis**. Cada trecho adaptado precisa de aprovação antes de virar código (AGENTS.md); as fontes são a wiki `rules/` do Henduran e o `astra-rules` como origem. **Competências e Capacidades continuam fora.**
    - **Fatia 1, chat, ficha e testes:** criação de personagem (Conceito, Ambição, Desejo, Convicções e Pilares, Atributos, 22 Perícias, trilhas de Vida e Vontade), Reserva de Dados, uso de Vontade, Convicções com Fraturas, **Descanso Prolongado** e o **Dia do Mundo** (ADR-073). O Narrador propõe o teste, o jogador confirma e o motor rola (ADR-006). Sem dano de Vida, Tratamento nem Condições. Rascunhos em `docs/esteira/rules-fatia-1/`.
    - **Fatia 2, equipamento, progressão e descansos:** equipamento inicial por orçamento de Valor, catálogos, Carga e Progressão (XP). O Descanso Prolongado foi movido para a fatia 1.
    - **Fatia 3, combate sem mapa e NPCs por orçamento:** Cena Tática conduzida de forma narrativa (o Astra permite combate sem mapa: o Narrador descreve posições e distâncias), com Iniciativa, Rodadas, Turnos, Ações e dano validados pelo motor.
    - **NPCs por orçamento, sem lista pronta:** o Narrador propõe um patamar e a distribuição; o motor valida contra o orçamento de Criação de NPCs (Capanga, Par, Veterano, Elite) e monta a ficha. NPCs seguem o modelo do personagem: **sem Competências, sem Capacidades e sem Pontos de Capacidade**. A régua de encontros do Astra pode validar a dificuldade.
    - **Condições, tipos de dano e Ações avançadas entram por fatia**, só as necessárias a cada uma, sem adicionar todas de uma vez.
    - Sem mapa, grid ou mapa-múndi no MVP. O mapa vem depois.
14. **Painéis e abas** **[DECIDIDO]**: **Objetivos e Anotações entram**. O **Diário não entra**. Ficha, Mundo e Contexto da Cena permanecem conforme `ANALISE-ESBOCOS.md`.

## 3. Fora do escopo

- Grid, mapas localizados, mapa-múndi e navegação **[DECIDIDO]**. O combate entra (item 13), sem mapa.
- Competências e Capacidades (regra do AGENTS.md).
- Diário **[DECIDIDO]**.
- Bestiário de criaturas prontas e NPCs de patamar Lendário **[PROPOSTO]**.
- Condições, tipos de dano (Resistência e Vulnerabilidade) e Ações avançadas além das necessárias a cada fatia.
- Geração de mapas e mundos no estilo Azgaar (o gerador do MVP é simples e sem mapa), memória vetorial, ramificação, backups e exportação de livros.
- Provedor pago por API (vem depois, pela mesma interface, ADR-071).

## 4. Critérios de aceite **[PROPOSTO]**

1. Em Windows limpo com modelo GGUF disponível, o app abre e inicia o modelo local sem terminal.
2. É possível criar um personagem, iniciar o jogo e conversar com o Narrador com *streaming*.
3. Uma Cena inicia e encerra pela interface; o histórico e os fatos da Cena persistem.
4. Fechar e reabrir o app retoma o personagem, o histórico e o estado Fora de Cena ou Em Cena.
5. Matar o app não deixa `llama-server` órfão.
6. Uma resposta do Narrador não altera estado sem passar pelo motor (teste automatizado com provedor falso).
7. Testes automatizados e roteiro de reprodução manual entregues.

## 5. Riscos

- **Qualidade do modelo local gratuito** em português e em seguir o formato estruturado: pode exigir ajuste de prompt e de modelo padrão.
- **Hardware do jogador:** modelos de 7 a 8 bilhões de parâmetros pedem GPU com bastante memória; sem GPU a resposta é lenta. O suporte mínimo está em aberto (ADR-070).
- **Regras do Astra no MVP** são quase todo o núcleo do sistema (menos Competências, Capacidades e mapa). Cada seção adaptada precisa de aprovação antes de implementar, e o `rules/` próprio ainda não existe. Mitigação: três fatias jogáveis em ordem (item 13) e Condições e tipos de dano adicionados aos poucos.
- **NPCs por orçamento** dependem de o Narrador propor fichas válidas; o motor rejeita o que estourar o orçamento. Modelos locais pequenos podem errar a conta, então o motor precisa ajustar ou pedir nova proposta.

## 6. Decisões

**Resolvidas em 2026-11-22**

1. Itens **[PROPOSTO]** das seções 2 a 4: aprovados. A parte "sem atributos" foi superada pela entrada das regras do Astra no MVP (itens 4, 9 e 13 da seção 2).
2. **Apresentação do Narrador Geral: opção C**, com chat próprio recolhido no canto inferior direito **e** acesso por `@` a partir do chat da Cena. Uma pergunta ao Narrador Geral durante a Cena não pausa a Cena nem altera o mundo por si só. O desenho de interface proposto está em `docs/ui-ux/esbocos/ANALISE-ESBOCOS.md`, seção 3, e aguarda aprovação.
3. O Narrador pode iniciar Cenas já no MVP (é o Narrador Geral quem as abre).
4. **Campos do gerador de mundo:** sorteio com edição pelo jogador; 3 a 5 lugares iniciais (item 3 da seção 2).
5. **`@` responde no próprio chat da Cena**, com destaque e botão de ocultar (item 6 da seção 2).
6. **Ilustrações:** substituídas por ambiente procedural de dia e noite (item 12 da seção 2).
7. **Nome do Narrador Geral: Aduran.** Anagrama de *arandu* ("sabedoria", "conhecimento" em guarani), que ainda lembra o "duran" de Henduran. O responsável delegou a escolha; vale confirmar o significado com um dicionário ou falante de guarani antes de fixar em texto de jogo. Alternativas do mesmo anagrama: *Dunara*, *Undara*. Evitar nomes de divindades e seres sagrados de povos vivos (por exemplo, Tupã e Anhangá).
8. **Recorte de regras do Astra:** fatias 1, 2 e 3 como no item 13 da seção 2, com **combate sem mapa**, **NPCs por orçamento sem Capacidades** e **Condições em fatias**.
9. **Perícias e Dia do Mundo (2026-11-22):** 22 Perícias de mundo medieval, sem Dirigir, Pilotar nem Conhecimento Específico; Dia do Mundo como limitador, começando no Amanhecer, e troca livre de Ambição e Desejo (ADR-073); Descanso Prolongado na fatia 1.

**Em aberto**

1. **Regras do Astra por fatia:** quais Condições, tipos de dano (Resistência e Vulnerabilidade), Ações e Manobras entram em cada fatia. Depende de ler e aprovar cada seção adaptada, começando pela fatia 1.
   - Telas ainda sem decisão: Mundos no menu, Mapa e Inventário (este último depende do recorte de regras). Diário fora; Objetivos e Anotações dentro (item 14).
2. Se o painel recolhido do Narrador Geral guarda histórico por Cena ou um histórico único.
3. Detalhes do ambiente de dia e noite: número de períodos, paleta, como o jogador deixa o tempo passar (`07-ambiente-dia-noite.md`, seção 8).
4. Marcas de escrita do chat (fala, ação, pensamento, pergunta ao narrador) inspiradas no Caliope: decidir quais adotar.

## 7. Ordem de implementação sugerida

1. Esqueleto Tauri + React + Python com HTTP e SSE (ADR-072) e UI base em CSS (ADR-069).
2. `NarratorProvider` com `llm.py` adaptado e um provedor falso para testes (ADR-071).
3. `runtime.py`, `hardware.py` e `modelhub.py` (ADR-070).
4. **Fatia 1:** persistência, mundo genérico, personagem com ficha, Reserva de Dados e loop Fora de Cena ↔ Cena.
5. **Fatia 2:** equipamento, progressão e descansos.
6. **Fatia 3:** combate sem mapa e NPCs por orçamento.
7. Skills e polimento, em paralelo quando fizer sentido.
