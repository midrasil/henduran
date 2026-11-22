# Henduran — Escopo do primeiro MVP

**Data:** 2026-11-22
**Status:** os itens **[PROPOSTO]** foram **aprovados pelo responsável em 2026-11-22** e valem como escopo do MVP, exceto os pontos que a seção 6 mantém em aberto. Itens **[DECIDIDO]** vêm de decisão explícita.
**Substitui:** o caso do ferreiro como caso de uso de referência do MVP.

## 1. Objetivo

Validar a experiência central do Henduran como **chat com um Narrador de IA rodando em modelo local gratuito**, seguindo o loop de gameplay (`docs/main/02-loop-de-gameplay.md`): o jogador cria um personagem em um mundo genérico, conversa Fora de Cena e entra e sai de Cenas. **[DECIDIDO]**

## 2. Dentro do escopo

1. **Menu inicial** **[DECIDIDO]**: novo jogo, continuar, gerenciar modelos e sair. Os demais itens (configurações, créditos) ficam **[PROPOSTO]**.
2. **Gerenciamento de modelo local** **[PROPOSTO]**: detectar hardware, baixar ou escolher um modelo GGUF e iniciar o `llama-server` (ADR-070). Sem modelo, o jogo explica o que falta, e não falha em silêncio.
3. **Mundo genérico com gerador simples** **[DECIDIDO]**: o jogo gera um mundo pouco aprofundado, com **calendário, religião ou religiões, lugares iniciais, época e tom**, guardado como dados canônicos que os Narradores recebem como contexto. O gerador é a primeira versão de algo que poderá evoluir para um gerador de mapas e mundos no estilo do Azgaar's Fantasy Map Generator (fora do MVP, sem mapa). Os campos exatos e o quanto é sorteado ou escrito pelo jogador são **[PROPOSTO]**.
4. **Criação de personagem** **[DECIDIDO]**: nome, descrição e histórico escritos pelo jogador, mais **Ambição e Desejo** (GDD). Atributos e valores mecânicos **não entram** até a adaptação do Astra ser aprovada. **[PROPOSTO]**
5. **Dois Narradores** **[DECIDIDO]**:
   - **Narrador Geral** (nome provisório): por ele o jogador declara as próximas ações, tira dúvidas e decide para onde vai. **É ele quem abre as Cenas**, por intenção do jogador, iniciativa própria ou consequência anterior. Corresponde ao "Fora de Cena" do loop de gameplay.
   - **Narrador da Cena**: conduz uma Cena, com chat contextualizado, e a encerra registrando fatos relevantes.
   - Os dois usam o mesmo `NarratorProvider` e o mesmo estado do motor. Contextos e instruções diferentes.
6. **Como o Narrador Geral aparece na tela** (a decidir; ver seção 6): um chat próprio, recolhido no canto inferior direito, e/ou acesso a partir do chat da Cena por `@`.
7. **Loop de gameplay em chat** **[DECIDIDO]**: Fora de Cena com o Narrador Geral, Cena com início e encerramento, Narrador em *streaming*, com cancelar e regenerar **[PROPOSTO]**. A UI do chat toma como referência o chat do Caliope, sem copiar a estrutura de jogo dele.
8. **Persistência** **[PROPOSTO]**: SQLite (ADR-050) com personagem, Jornada, histórico de chat e fatos registrados; reabrir o app retoma o jogo.
9. **Motor mínimo** **[PROPOSTO]**: valida transições Fora de Cena ↔ Cena e a gravação de fatos propostos pelo Narrador. A IA propõe, o motor valida e aplica. Sem mecânicas inventadas.
10. **UI** **[DECIDIDO]**: pixel art em CSS com tokens próprios (ADR-069), acessível conforme o ADR-068.
11. **Skills** **[DECIDIDO]**: o gerenciador do Caliope e o acervo entram conforme a auditoria. A ativação por cartão ou mundo é **[PROPOSTO]** para o MVP.

## 3. Fora do escopo

- Combate, grid, mapas localizados, mapa-múndi e navegação **[DECIDIDO]**.
- Competências e Capacidades (regra do AGENTS.md).
- Testes, rolagens e economia (comércio, preços, inventário): dependem de regras Astra adaptadas e aprovadas. **[PROPOSTO]**
- XP, Ambição e Desejo evolutivos além do registro textual. **[PROPOSTO]**
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
- **Motor mínimo sem regras Astra** limita a validação mecânica; isso é intencional nesta fase.

## 6. Decisões

**Resolvidas em 2026-11-22**

1. Itens **[PROPOSTO]** das seções 2 a 4: aprovados, incluindo criação de personagem sem atributos e o motor mínimo.
2. **Apresentação do Narrador Geral: opção C**, com chat próprio recolhido no canto inferior direito **e** acesso por `@` a partir do chat da Cena. Uma pergunta ao Narrador Geral durante a Cena não pausa a Cena nem altera o mundo por si só. O desenho de interface proposto está em `docs/ui-ux/esbocos/ANALISE-ESBOCOS.md`, seção 3, e aguarda aprovação.
3. O Narrador pode iniciar Cenas já no MVP (é o Narrador Geral quem as abre).

**Em aberto**

1. Campos do gerador de mundo (calendário, religiões, lugares iniciais, época e tom): quais o jogador escolhe e quais são sorteados.
2. Nome final do "Narrador Geral" no jogo e no código (hoje provisório).
3. Origem das ilustrações (menu, cenas, retratos). No MVP, placeholders até decidir (`ANALISE-ESBOCOS.md`, seção 5).
4. Detalhes do `@`: abre o painel recolhido ou responde em linha; histórico do painel por Cena ou único.
5. Quais telas e abas do esboço entram (Mundos no menu, abas Diário, Objetivos e Anotações): ver `ANALISE-ESBOCOS.md`, seção 2.

## 7. Ordem de implementação sugerida

1. Esqueleto Tauri + React + Python com HTTP e SSE (ADR-072) e UI base em CSS (ADR-069).
2. `NarratorProvider` com `llm.py` adaptado e um provedor falso para testes (ADR-071).
3. `runtime.py`, `hardware.py` e `modelhub.py` (ADR-070).
4. Persistência, personagem, mundo genérico e loop Fora de Cena ↔ Cena.
5. Skills e polimento.
