# ADR-078 — Memória e contexto do Narrador: Quadro da Cena, Cânone, NPCs e perguntas de continuidade

- **Estado:** **Proposta, parcialmente confirmada** (2026-11-24). Confirmado pelo responsável: a **pergunta de continuidade** (modo padrão "só em contradição clara") e, **ao aprovar o protótipo da tela da Jornada** (`09-tela-da-jornada.md`, item 2.8), o **Quadro da Cena visível e editável pelo jogador**, a **atualização por uma chamada extra e pequena** e a **skill de situação sugerida pelo Aduran e aceita pelo jogador**. As demais decisões são **recomendações do planejador, aguardando confirmação** (marcadas com ⏳).
- **Data:** 2026-11-24
- **Complementa:** ADR-004 (autonomia do Narrador), ADR-006 (confirmação de testes), ADR-071 (`NarratorProvider`), ADR-072 (HTTP com SSE), ADR-075 (banco por Jornada) e ADR-076 (Cena inicial e ciclo de Cena)
- **Refina:** `docs/main/05-narrador-ia.md`, seções 4, 5 e 8 ("estratégia para minimizar alucinações em modelos locais menores"; "política de confirmação e contestação")
- **Origem:** problema relatado pelo responsável no Caliope (continuidade quebrada em narrativas longas, por exemplo o personagem estar de pé e o Narrador dizer que estava deitado) e a necessidade de economizar tokens em modelos gratuitos

## Contexto

O modelo não guarda memória: a cada resposta ele relê o texto que o Henduran envia e tenta **deduzir** o estado da ficção. Em chats longos, um fato como "de pé" fica escrito em prosa, no meio de dezenas de mensagens, e modelos pequenos o perdem. Resumos longos pioram o problema (cada resumo é uma cópia da cópia). Além disso, um modelo que alucina costuma errar **com confiança**, então não adianta esperar que ele avise quando está em dúvida.

O desenho atual (ADR-076) já abre cada Cena com um contexto novo e inclui os resumos das últimas 5 Cenas encerradas; o esquema de estado, eventos e memória da Jornada ainda **não existe** (`modelo-de-dados-jogo.md`). Esta decisão define o que guardar, o que enviar ao modelo e como corrigir erros, sem inventar mecânica (`AGENTS.md`): tudo aqui é **estado narrativo**, não regra de jogo; o motor continua sendo a autoridade sobre ficha, testes e fatos oficiais.

## Decisão proposta

1. **Memória em camadas; o histórico completo nunca vai inteiro ao modelo.**
   - **Fixa** (muda pouco, boa para cache): regras do Narrador, Mundo resumido, ficha do personagem, skills ativas.
   - **Cânone da Jornada**: fatos estabelecidos e decisões do jogador, curtos, em lista, com origem (Cena) e confiabilidade (confirmado, rumor, mentira de NPC); entram só os relevantes à Cena (lugar, NPCs presentes, fios abertos).
   - **Cena**: Quadro da Cena, resumo corrido e as últimas 6 a 10 mensagens.
   - **Histórico**: o chat completo fica no banco para o jogador ler; não é enviado.
2. **Quadro da Cena, mantido pelo motor** (confirmado pelo protótipo). Ficha curta e estruturada do **estado narrativo** atual: quem está presente; para cada um, postura, posição, o que segura, humor e o que sabe da situação; lugar, hora e período; perguntas abertas. Entra em **todo turno, no fim do contexto**, com a regra "se o texto contradiz o Quadro, o Quadro vence". Depois de cada resposta, uma **chamada pequena e de saída em JSON** (esquema fixo, validada pelo motor) propõe as mudanças; o motor aplica. O Quadro tem **procedência "narrada"**, nunca "oficial", e **não carrega números de regra** (nada de Vida, Vontade ou dano). Se a chamada extra for cara para o modelo em uso, a atualização pode ocorrer a cada N turnos.
3. **O jogador vê e corrige o Quadro** (confirmado pelo protótipo). Painel "Estado da Cena" com botão "isso está errado" em cada item e aviso de que ele é narrativo. A correção do jogador vence o extrator.
4. ⏳ **Compactação na própria Cena.** Quando o contexto passa de cerca de **70% da janela do modelo**, o motor resume só a parte mais antiga no resumo corrido, atualiza o Quadro e mantém as últimas mensagens literais. O jogador continua vendo o chat inteiro. Fatos importantes são gravados no Cânone **no momento em que acontecem**, e não só no resumo final, para o resumo não ser a única fonte (evita a perda em cadeia).
5. ⏳ **Entre Cenas.** A Cena nova começa num contexto limpo, montado a partir do motivo da Cena (ADR-076), do Quadro final da anterior (só o que continua valendo), dos fatos relevantes do Cânone, das fichas dos NPCs presentes e dos resumos recentes.
6. ⏳ **Fichas de NPC com memória, em duas abas** (protótipo aprovado em 2026-11-24, `09-tela-da-jornada.md`, item 2.9). **Narrativa**: identidade, personalidade e voz (3 traços, trejeitos, fala de exemplo, o que nunca faria), motivações e segredos, o que sabe e lembra (com origem e confiança, e as lembranças do jogador com a Cena), relações e atitude, estado atual e anotações do jogador; **Stats**: patamar, atributos, perícias e trilhas, que vêm da fatia 3 do Astra (NPCs por orçamento, sem Capacidades) e **não estão definidos**. **Segredos e stats ficam escondidos do jogador até ele descobrir** (revelar é spoiler, com confirmação). O **contexto do NPC vem da ficha**, e não da Cena (responsável, 2026-11-24): o Quadro da Cena **não tem campo "Sabe"**; a interface só liga ao Diário. O que o NPC aprende na Cena é **proposto pelo extrator como acréscimo à ficha**, com a Cena de origem, e o jogador corrige lá. Cada ficha custa cerca de 150 tokens no contexto; entram **só os presentes na Cena**, no máximo uns 4, e os demais ficam adormecidos no banco; **o Aduran tem acesso a todas**. Os NPCs são **criados pelo Narrador** (a IA propõe, o motor valida), e o jogador pode editar. Memórias novas são gravadas pelo motor.
7. ⏳ **Skills** (a sugestão do Aduran por Cena, aceita pelo jogador, está confirmada pelo protótipo). Nível 1: skills de estilo, ligadas por **Jornada**, na camada fixa. Nível 2: skills de situação, por **Cena**: o Aduran sugere e o jogador confirma. Limite de **3 ativas** ao mesmo tempo e **teto de tamanho** por skill; o texto da skill nunca substitui o motor.
8. **Orçamento de tokens proporcional à janela do modelo** (a janela vem da configuração do modelo na tela Modelos). Referência para 8 mil tokens: regras ~600, skills até ~900, Mundo e ficha ~500, Cânone ~400, NPCs ~600, Quadro ~250, resumo ~500, mensagens recentes ~2.500, reserva para a resposta ~800. O motor mede o contexto real (contagem de tokens do servidor de inferência, com estimativa de reserva) e corta pelas camadas menos importantes primeiro.
9. **Pergunta de continuidade (aprovada).** Quando o Narrador precisa de um fato que não está no contexto, ou o motor detecta uma contradição entre o que foi escrito e o Quadro ou o Cânone sem uma ação que a explique, nasce uma **pergunta estruturada** (tipo, fato, hipótese, opções).
   - **Gatilhos estruturais**, nunca "a IA avisa que está confusa": (a) comparação do motor entre o texto novo e o Quadro/Cânone; (b) o Narrador é instruído a **pedir** o fato por uma marcação, como a `[[propor_cena]]` do Aduran, em vez de inventar; (c) o botão "isso está errado" do jogador.
   - **Escada do mais barato ao mais caro**: consulta direta do motor ao Quadro, ao Cânone e às fichas (sem LLM); depois o **Aduran**, com contexto mínimo; só então a **pergunta ao jogador**.
   - **Forma (ajustada pelo protótipo aprovado)**: um **cartão que ocupa a largura do chat**, como uma mensagem, só com um destaque; **sem botões de escolha**, apenas **Você decide**. **A próxima mensagem digitada pelo jogador responde ao cartão e não vai para o chat**; a resposta fica dentro do cartão, que se recolhe, e um ícone nas ações da mensagem de origem (ao passar o mouse) o reabre.
   - **A resposta é gravada** no Quadro e no Cânone, no **Log da Cena** e no **histórico de dúvidas** da aba Estado da Cena, então a dúvida não volta.
   - **Modo configurável**: *Sempre perguntar*, ***Só em contradição clara*** (padrão) e *Nunca* (o Narrador escolhe e segue); no máximo uma pergunta a cada N turnos.
10. **Teste de continuidade.** Conjunto de cenários roteirizados (por exemplo, "personagem de pé, 15 turnos depois: continua de pé?", "NPC prometeu algo duas Cenas atrás") executado com o `FakeNarratorProvider` e com os modelos usados, medindo contradições por cenário. É o critério de aceite desta decisão e responde aos "comportamentos a validar" do doc 05.

## Consequências

- Novos dados por Jornada, a definir na implementação (esquema em `journey.db`, ADR-075): estado da Cena, fatos do Cânone, NPCs e suas memórias, perguntas pendentes. Atualizar `modelo-de-dados-jogo.md`.
- Custo: uma chamada extra e pequena por turno (ou a cada N turnos), compensada por contextos menores e fixos.
- Riscos: o extrator errar e propagar o erro (mitigado pelo painel editável, pela precedência da correção do jogador e pela pergunta de continuidade); latência em modelo local lento (mitigada por atualizar a cada N turnos); excesso de perguntas (mitigado pelo modo padrão e pelo intervalo mínimo).
- A decisão sobre confirmação e contestação do doc 05 passa a ter uma resposta para continuidade; confirmação de **testes** continua no ADR-006.

## Pendências (⏳ e outras)

- Confirmar as decisões ainda marcadas com ⏳ (compactação a ~70%, fichas de NPC, skills de estilo por Jornada).
- Campos exatos do Quadro e da ficha de NPC; esquemas JSON; prompts; N de turnos; contagem de tokens por modelo.
- Recuperação por relevância do Cânone e das memórias (FTS5 primeiro, vetores depois, como no `memory.py` do Caliope).
- Como o jogador **descobre** os stats de um NPC (observação, testes, informações) e quais campos de regras a ficha terá: depende da fatia 3 do Astra.
- O **Diário** do jogador (anotações, "O que sei", NPCs): desenhado no protótipo; falta o esquema de dados (o que o jogador sabe, com origem e confiança).
- Se haverá um jeito de **adiar** a resposta à dúvida de continuidade para agir na Cena antes.
- Política de skills de conteúdo adulto e a ativação por Jornada ou por Cena (ver a aba Skills do protótipo de Modelos).

## O que esta decisão não faz

- Não cria mecânica, valores ou gatilhos de XP; não altera o Astra.
- Não decide prompts nem o formato final da API.
- Não torna o Quadro uma fonte oficial: ele é memória narrativa, distinta do estado oficial (doc 05, seção 4).
