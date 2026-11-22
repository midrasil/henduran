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
4. **Criação de personagem** **[DECIDIDO]**: nome, descrição e histórico escritos pelo jogador, mais **Ambição e Desejo** (GDD). **Atualização de 2026-11-22:** as regras do Astra entram no MVP (item 13), então atributos e demais valores mecânicos da ficha passam a fazer parte da criação, **conforme o que for aprovado na adaptação**. Até lá, nada de mecânica é inventado.
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
13. **Regras do Astra** **[DECIDIDO]**: entram no MVP. **Quais regras e em que ordem não está definido**; será discutido em conversa própria. Cada trecho adaptado precisa de aprovação antes de virar código, conforme o AGENTS.md, e as fontes são a wiki `rules/` do Henduran e o `astra-rules` como origem. Competências e Capacidades continuam fora.
14. **Painéis e abas** **[DECIDIDO]**: **Objetivos e Anotações entram**. O **Diário não entra**. Ficha, Mundo e Contexto da Cena permanecem conforme `ANALISE-ESBOCOS.md`.

## 3. Fora do escopo

- Combate, grid, mapas localizados, mapa-múndi e navegação **[DECIDIDO]**.
- Competências e Capacidades (regra do AGENTS.md).
- Diário **[DECIDIDO]**.
- Testes, rolagens, economia (comércio, preços, inventário), XP e evolução de Ambição e Desejo: **em discussão**, junto com as regras do Astra (item 13). Só entram o que for aprovado na adaptação.
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
- **Regras do Astra no MVP** ampliam bastante o trabalho: cada seção adaptada precisa de aprovação antes de implementar, e o `rules/` próprio ainda não existe. Sem recorte claro, o MVP pode crescer sem fim. Recomenda-se um recorte mínimo (por exemplo, ficha e um tipo de teste) acordado antes do scaffolding do motor.

## 6. Decisões

**Resolvidas em 2026-11-22**

1. Itens **[PROPOSTO]** das seções 2 a 4: aprovados. A parte "sem atributos" foi superada pela entrada das regras do Astra no MVP (itens 4, 9 e 13 da seção 2).
2. **Apresentação do Narrador Geral: opção C**, com chat próprio recolhido no canto inferior direito **e** acesso por `@` a partir do chat da Cena. Uma pergunta ao Narrador Geral durante a Cena não pausa a Cena nem altera o mundo por si só. O desenho de interface proposto está em `docs/ui-ux/esbocos/ANALISE-ESBOCOS.md`, seção 3, e aguarda aprovação.
3. O Narrador pode iniciar Cenas já no MVP (é o Narrador Geral quem as abre).
4. **Campos do gerador de mundo:** sorteio com edição pelo jogador; 3 a 5 lugares iniciais (item 3 da seção 2).
5. **`@` responde no próprio chat da Cena**, com destaque e botão de ocultar (item 6 da seção 2).
6. **Ilustrações:** substituídas por ambiente procedural de dia e noite (item 12 da seção 2).
7. **Nome do Narrador Geral: Aduran.** Anagrama de *arandu* ("sabedoria", "conhecimento" em guarani), que ainda lembra o "duran" de Henduran. O responsável delegou a escolha; vale confirmar o significado com um dicionário ou falante de guarani antes de fixar em texto de jogo. Alternativas do mesmo anagrama: *Dunara*, *Undara*. Evitar nomes de divindades e seres sagrados de povos vivos (por exemplo, Tupã e Anhangá).

**Em aberto**

1. **Regras do Astra no MVP:** quais seções e mecânicas entram, em que ordem e com que recorte mínimo (ficha, testes, recursos, inventário, economia, XP). Conversa a fazer.
   - Telas ainda sem decisão: Mundos no menu, Mapa e Inventário (este último depende do recorte de regras). Diário fora; Objetivos e Anotações dentro (item 14).
2. Se o painel recolhido do Narrador Geral guarda histórico por Cena ou um histórico único.
3. Detalhes do ambiente de dia e noite: número de períodos, paleta, como o jogador deixa o tempo passar (`07-ambiente-dia-noite.md`, seção 8).
4. Marcas de escrita do chat (fala, ação, pensamento, pergunta ao narrador) inspiradas no Caliope: decidir quais adotar.

## 7. Ordem de implementação sugerida

1. Esqueleto Tauri + React + Python com HTTP e SSE (ADR-072) e UI base em CSS (ADR-069).
2. `NarratorProvider` com `llm.py` adaptado e um provedor falso para testes (ADR-071).
3. `runtime.py`, `hardware.py` e `modelhub.py` (ADR-070).
4. Persistência, personagem, mundo genérico e loop Fora de Cena ↔ Cena.
5. Skills e polimento.
