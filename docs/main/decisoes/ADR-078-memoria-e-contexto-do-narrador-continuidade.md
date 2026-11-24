# ADR-078 — Memória e contexto do Narrador: Quadro da Cena, Cânone, NPCs e perguntas de continuidade

- **Estado:** **Proposta** (2026-11-24). Aprovado pelo responsável na conversa: incluir a **pergunta de continuidade** com o modo "só em contradição clara" como padrão. As demais decisões são **recomendações do planejador, aguardando confirmação** (marcadas com ⏳).
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
2. ⏳ **Quadro da Cena, mantido pelo motor.** Ficha curta e estruturada do **estado narrativo** atual: quem está presente; para cada um, postura, posição, o que segura, humor e o que sabe da situação; lugar, hora e período; perguntas abertas. Entra em **todo turno, no fim do contexto**, com a regra "se o texto contradiz o Quadro, o Quadro vence". Depois de cada resposta, uma **chamada pequena e de saída em JSON** (esquema fixo, validada pelo motor) propõe as mudanças; o motor aplica. O Quadro tem **procedência "narrada"**, nunca "oficial", e **não carrega números de regra** (nada de Vida, Vontade ou dano). Se a chamada extra for cara para o modelo em uso, a atualização pode ocorrer a cada N turnos.
3. ⏳ **O jogador vê e corrige o Quadro.** Painel "Estado da Cena" com botão "isso está errado" em cada item e aviso de que ele é narrativo. A correção do jogador vence o extrator.
4. ⏳ **Compactação na própria Cena.** Quando o contexto passa de cerca de **70% da janela do modelo**, o motor resume só a parte mais antiga no resumo corrido, atualiza o Quadro e mantém as últimas mensagens literais. O jogador continua vendo o chat inteiro. Fatos importantes são gravados no Cânone **no momento em que acontecem**, e não só no resumo final, para o resumo não ser a única fonte (evita a perda em cadeia).
5. ⏳ **Entre Cenas.** A Cena nova começa num contexto limpo, montado a partir do motivo da Cena (ADR-076), do Quadro final da anterior (só o que continua valendo), dos fatos relevantes do Cânone, das fichas dos NPCs presentes e dos resumos recentes.
6. ⏳ **Fichas de NPC com memória** (cerca de 150 tokens cada): personalidade em 3 traços, trejeitos de voz e uma fala de exemplo, objetivos, segredos que só o Narrador sabe, relação com o jogador e lista curta do que ele lembra do personagem (com a Cena de origem). Entram **só os presentes na Cena**, no máximo uns 4; os demais ficam adormecidos no banco. Memórias novas são **propostas** ao fim da Cena e gravadas pelo motor.
7. ⏳ **Skills.** Nível 1: skills de estilo, ligadas por **Jornada**, na camada fixa. Nível 2: skills de situação, por **Cena**: o Aduran sugere e o jogador confirma. Limite de **3 ativas** ao mesmo tempo e **teto de tamanho** por skill; o texto da skill nunca substitui o motor.
8. **Orçamento de tokens proporcional à janela do modelo** (a janela vem da configuração do modelo na tela Modelos). Referência para 8 mil tokens: regras ~600, skills até ~900, Mundo e ficha ~500, Cânone ~400, NPCs ~600, Quadro ~250, resumo ~500, mensagens recentes ~2.500, reserva para a resposta ~800. O motor mede o contexto real (contagem de tokens do servidor de inferência, com estimativa de reserva) e corta pelas camadas menos importantes primeiro.
9. **Pergunta de continuidade (aprovada).** Quando o Narrador precisa de um fato que não está no contexto, ou o motor detecta uma contradição entre o que foi escrito e o Quadro ou o Cânone sem uma ação que a explique, nasce uma **pergunta estruturada** (tipo, fato, hipótese, opções).
   - **Gatilhos estruturais**, nunca "a IA avisa que está confusa": (a) comparação do motor entre o texto novo e o Quadro/Cânone; (b) o Narrador é instruído a **pedir** o fato por uma marcação, como a `[[propor_cena]]` do Aduran, em vez de inventar; (c) o botão "isso está errado" do jogador.
   - **Escada do mais barato ao mais caro**: consulta direta do motor ao Quadro, ao Cânone e às fichas (sem LLM); depois o **Aduran**, com contexto mínimo; só então a **pergunta ao jogador**.
   - **Forma**: curta, na linguagem da ficção e com botões ("De pé", "Sentada", "Outra coisa…", "Você decide"). Não bloqueia a história: aparece como aviso no chat e pode ser respondida depois.
   - **A resposta é gravada** no Quadro ou no Cânone, então a dúvida não volta.
   - **Modo configurável**: *Sempre perguntar*, ***Só em contradição clara*** (padrão) e *Nunca* (o Narrador escolhe e segue); no máximo uma pergunta a cada N turnos.
10. **Teste de continuidade.** Conjunto de cenários roteirizados (por exemplo, "personagem de pé, 15 turnos depois: continua de pé?", "NPC prometeu algo duas Cenas atrás") executado com o `FakeNarratorProvider` e com os modelos usados, medindo contradições por cenário. É o critério de aceite desta decisão e responde aos "comportamentos a validar" do doc 05.

## Consequências

- Novos dados por Jornada, a definir na implementação (esquema em `journey.db`, ADR-075): estado da Cena, fatos do Cânone, NPCs e suas memórias, perguntas pendentes. Atualizar `modelo-de-dados-jogo.md`.
- Custo: uma chamada extra e pequena por turno (ou a cada N turnos), compensada por contextos menores e fixos.
- Riscos: o extrator errar e propagar o erro (mitigado pelo painel editável, pela precedência da correção do jogador e pela pergunta de continuidade); latência em modelo local lento (mitigada por atualizar a cada N turnos); excesso de perguntas (mitigado pelo modo padrão e pelo intervalo mínimo).
- A decisão sobre confirmação e contestação do doc 05 passa a ter uma resposta para continuidade; confirmação de **testes** continua no ADR-006.

## Pendências (⏳ e outras)

- Confirmar as decisões marcadas com ⏳ (Quadro com chamada extra e painel editável, compactação a ~70%, fichas de NPC, skills por Jornada e por Cena).
- Campos exatos do Quadro e da ficha de NPC; esquemas JSON; prompts; N de turnos; contagem de tokens por modelo.
- Recuperação por relevância do Cânone e das memórias (FTS5 primeiro, vetores depois, como no `memory.py` do Caliope).
- Onde fica o painel "Estado da Cena" na tela da Jornada (precisa de protótipo, `10-prototipagem.md`).
- Política de skills de conteúdo adulto e a ativação por Jornada ou por Cena (ver a aba Skills do protótipo de Modelos).

## O que esta decisão não faz

- Não cria mecânica, valores ou gatilhos de XP; não altera o Astra.
- Não decide prompts nem o formato final da API.
- Não torna o Quadro uma fonte oficial: ele é memória narrativa, distinta do estado oficial (doc 05, seção 4).
