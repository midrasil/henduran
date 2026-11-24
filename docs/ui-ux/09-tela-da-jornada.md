# 09 — Tela da Jornada (MVP)

**Data:** 2026-11-23
**Estado:** **aprovado pelo responsável em 2026-11-23**, depois de seis rodadas de protótipo. Ajustes e adições virão depois, mas este é o desenho a implementar.
**Protótipo de referência:** [`prototipos/tela-da-jornada.html`](prototipos/tela-da-jornada.html) (abrir no navegador; o botão **Protótipo**, no canto inferior esquerdo, troca estado, período, dano e modelo). Processo em [`10-prototipagem.md`](10-prototipagem.md).
**Substitui:** a seção 2.3 e os itens 1, 2 e 4 da seção 3 de `esbocos/ANALISE-ESBOCOS.md`.
**Relacionados:** ADR-076 (Cena inicial e ciclo de Cena), `ESCOPO-MVP.md` (item 6), `07-ambiente-dia-noite.md`, `08-guia-de-componentes.md`, `rules/04-vida.md`, `rules/05-vontade.md`.

## 1. Princípios

- **Sem barra de abas.** No topo há só uma barra fina com o céu do período ao fundo (item 3).
- O jogador sabe **de relance** se está numa Cena ou falando com o Aduran: a Cena é a **página de pergaminho**; o Aduran e o Log são a **margem escura do cronista** (visual **livro**).
- Tudo o que é estado vem do serviço. A interface não decide abrir nem encerrar Cenas por conta própria, nem duplica regras.

## 2. Regiões

```
┌[céu do período]  A Garça de Três Penas · Ilsa de Vel   [☾ Noite·Dia 1] [● Modelo] [⚙]┐
├────────────┬────────────────────────────────────────┬──────────────────────┤
│ ARCOS   «  │ ☾ Noite · Taverna do Corvo Manco       │ FICHA            [⤢] │
│ ▾ Arco 1   │ A carta da garça ✎   [✒][📜] | [🚪]     │ (retrato) Ilsa       │
│  Ambição   │ ────────────────────────────────────── │ VIDA     ♥♥♥♥♥♥  5/6 │
│  ☀ Portões │  Narrador: ...                         │ VONTADE  🔥🔥🔥… 7/7 │
│  ☀ Cais    │                      Ilsa: ...         │ Atributos (placas)   │
│ ▌☾ A carta │  [ escreva...                    ➤ ]   │ Perícias (lista)     │
└────────────┴────────────────────────────────────────┴──────────────────────┘
```

### 2.1 Barra superior

- À esquerda, o **nome da Jornada** dado pelo jogador, com o personagem e o Mundo.
- À direita: o **período e a data no calendário do Mundo** (ícone e texto curto, sem seletor; por exemplo "Noite · 12 de Alvorim, Solário · Ano 476"; ADR-076, item 16), o **indicador do modelo** (pronto ou não; clicar leva à configuração de modelo) e o botão **⚙** (**Editar Jornada**, Mundo com o registro de lugares, Modelos, Voltar ao menu).
  - *Editar Jornada* (decisão do responsável em 2026-11-24, sem protótipo próprio): diálogo com **Nome da Jornada** e **Descrição**, opcionais como na Nova Jornada (nome em branco volta a "A Jornada de <nome>"; descrição até 2.000 caracteres). Salvar grava pelo serviço (`PATCH /journeys/current`); em erro, aviso no diálogo e nada muda. O nome novo aparece na barra e no menu inicial; o Narrador lê a descrição nova no próximo contexto.
- **O céu do período em pixel art ocupa o fundo da barra inteira**, com o mesmo desenho do menu inicial (`SkyBackdrop`, `sky.ts`): bandas pontilhadas, sol ou lua, estrelas, nuvens, relevo e árvores. Os textos ficam legíveis por sombra dura e fundos escuros translúcidos nos controles.

### 2.2 Coluna dos Arcos (esquerda)

- **Recolhível**: expandida, mostra os arcos; recolhida, vira um trilho só com os ícones de período das Cenas.
- **Arco** é o conjunto de Cenas de uma Ambição. Cada arco mostra o número, a Ambição e quantas Cenas tem. **Trocar a Ambição abre um arco novo**, e as Cenas seguintes entram nele. Arcos anteriores ficam recolhidos, com o estado da Ambição (por exemplo, concluída).
- **Ordem cronológica**: arcos do primeiro ao atual; Cenas de cada arco da primeira à última.
- **Card da Cena**: só o **ícone em pixel art do período** à esquerda e o **nome da Cena**. Sem "Cena X", sem etiquetas de estado. A Cena em andamento se distingue pelo visual (card de pergaminho com fita vermelha). Cenas encerradas são **só leitura**: abrem no centro com o resumo no fim e um botão para voltar ao chat atual.
- O chat do Aduran **não** entra nesta lista.

### 2.3 Centro: o chat ativo

- **Cabeçalho**: período (ícone e nome) e lugar, o **nome da Cena** e o motivo. O nome é proposto pelo Narrador e **o jogador pode renomear** (lápis ao lado do título; a troca entra no Log).
- **Ícones no canto direito do cabeçalho**: **Aduran** (com aviso de mensagem nova), **Estado da Cena** (com selo "1" enquanto houver dúvida de continuidade aberta), **Log** e, separado, **Encerrar Cena** (porta). Durante a Cena, os quatro aparecem nos quatro modos (Cena, Aduran, Estado da Cena e Log); fora da Cena, só o Aduran e o Log. Nos modos que não são a Cena aparece também **voltar à Cena**.
- **Em Cena**: página de pergaminho, letra capitular na abertura, narração em serifa; falas do jogador em balão roxo à direita.
- **Aduran durante a Cena**: o centro vira a margem do cronista. O que se fala ali **não entra no contexto do Narrador da Cena** nem vira fato da história (`ESCOPO-MVP.md`, item 6).
- **Log**: durante a Cena, **só o que aconteceu naquela Cena**; Fora de Cena, o Log da Jornada inteira. Eventos com ícone por tipo (Cena aberta, Cena encerrada, lugar, renomeada) e o momento (Dia e período). Depois: rolagens, memórias e outros eventos do motor.
- **Fora de Cena**: o centro é o chat do Aduran; o Aduran pode propor uma Cena num cartão (título, lugar, marcado quando for **lugar novo**, motivo e participantes) com **Começar a Cena**, **Pedir outra** e **Agora não** (ADR-076, item 12).
- A troca entre página e margem é uma **virada de página** curta (desligada com *reduced motion*, ADR-068).

### 2.4 Mensagens e campo de escrita

- As mensagens usam a **largura disponível da coluna central**; as falas do jogador ficam à direita, com o balão ajustado ao texto e limite de 100% da coluna.
- **Ações da mensagem** só aparecem **ao passar o mouse** ou com foco do teclado: ícones pequenos num canto, com dica. **Copiar** (todas), **Regenerar** (só a última resposta do Narrador; a nova substitui a anterior) e **Continuar** (resposta interrompida). Editar e apagar ficam para depois.
- **Campo de escrita**: começa com **uma linha** e **cresce** com o texto ou com **Shift+Enter** (até um limite, depois rola). **Enter envia.** O envio é um **ícone** dentro do campo; durante a resposta vira **parar**.
- **Barras de rolagem** em pixel: douradas no tema escuro, marrons no pergaminho e roxas na margem do Aduran.

### 2.5 Ficha (direita, mais larga)

- Cabeçalho "Ficha" com o **ícone de abrir a ficha completa** na extremidade direita.
- **Retrato** em moldura circular em degraus de pixel, nome e Conceito. Sem retrato, as iniciais.
- **Vida e Vontade em ícones de pixel art**, soltos, sem caixa de fundo: **Vida é vermelha** (coração), **Vontade é azul** (chama). Cada espaço tem três estados, na ordem da regra (agravado à esquerda, superficial depois, livres à direita; `rules/04` e `05`):

  | | Livre | Superficial | Agravado |
  |---|---|---|---|
  | Vida | coração cheio, com brilho | coração desbotado e rachado | coração partido, escuro, com a quebra em brasa |
  | Vontade | chama azul com miolo claro | chama baixa e fraca | brasa fria soltando fumaça |

  Abaixo, a legenda com as contagens e, quando houver, o estado (Debilitado, Incapacitado, −2 dados em todas as rolagens).
- **Atributos** em placas com o valor e marcadores (físicos em dourado, espirituais em roxo).
- **Perícias em lista de uma coluna**, com o Atributo ligado e marcadores de 0 a 5; o resumo mostra as treinadas, com opção de ver as 22.
- **Objetivos e Convicções não aparecem no resumo.**

### 2.6 Ficha completa

Janela com **abas na lateral** (retrato grande acima) e conteúdo em pergaminho:

1. **Visão geral**: trilhas, Atributos e as 22 Perícias, em duas colunas.
2. **Convicções**: Objetivos (Ambição, com o arco e quantas Cenas, e Desejo) acima das Convicções, cada uma com o Pilar e as Fraturas desenhadas.
3. **Descrição**: Conceito, **idade, altura, origem e personalidade** (campos **opcionais, sem efeito de regra**, novos), aparência e histórico.

A ficha expandida tem dimensões fixas entre as abas; o conteúdo de cada aba rola internamente. Em telas estreitas, a composição responsiva mantém a coluna única.

### 2.7 Retrato

O jogador escolhe uma imagem do computador, **recorta** num enquadramento de perfil (arrastar e aproximar) e vê a prévia. A **imagem original fica guardada** (anexo da Jornada em `assets\`, ADR-075; PNG, JPEG ou WebP até 20 MB, ADR-076 item 18) e o recorte é guardado como enquadramento, para poder ser refeito depois. O retrato aparece no resumo e na ficha completa.

### 2.8 Estado da Cena (aba do chat) e dúvida de continuidade

**Estado:** protótipo aprovado em 2026-11-24 (ADR-078, proposta). A **Ficha da coluna da direita continua como era**.

- **Aba Estado da Cena** (ícone no cabeçalho do chat, margem escura como o Aduran e o Log): é a memória narrativa do que está acontecendo agora, mantida pelo motor e **editável pelo jogador**. Mostra:
  - **Aqui e agora**: lugar, momento e clima.
  - **Quem está presente**: um cartão por personagem (inclui o do jogador), com **Postura, Posição, Segura, Humor e Sabe**. Cada linha tem um **lápis** ("isso está errado") para corrigir; o que mudou na última resposta ganha a etiqueta **novo** e o que o jogador corrigiu, **corrigido por você**. O Narrador segue a correção do jogador.
  - **Em aberto**: os fios da história ainda sem resposta.
  - **Skills desta Cena** (n de 3): o Aduran pode sugerir uma skill de situação, que só entra se o jogador **aceitar** (ADR-078, item 7).
  - **Dúvidas de continuidade**: histórico das perguntas e respostas (da Cena e das anteriores), com **Ver no chat**.
  - Um texto explica que é memória narrativa, **não regra de jogo** (Vida, Vontade e testes continuam com o motor).
- **"Sabe" não é um campo do Quadro**: em cada NPC em Cena, a linha mostra só o link **ver na ficha** (e, no cartão do jogador, **ver no diário**). O conhecimento do NPC vem **da ficha dele**, a única fonte; o que ele aprende na Cena entra na ficha com a Cena de origem, e o jogador corrige lá (ADR-078, item 6). O cartão de cada NPC também tem o botão **ver ficha** no cabeçalho.
- **Dúvida de continuidade no chat**: quando o Narrador precisa de um fato ou o motor acha uma contradição (modo padrão "só em contradição clara"), aparece um **cartão que ocupa toda a largura do chat**, como uma mensagem, apenas com um destaque (borda roxa) e o rótulo "Dúvida de continuidade". O texto traz a pergunta e o que o Narrador acha. **Não há botões de escolha**, só **Você decide** (o Narrador escolhe a hipótese dele).
  - **A próxima mensagem digitada pelo jogador responde ao cartão e não vai para o chat**: o campo de escrita mostra "Responda à dúvida do Narrador…", fica destacado e a dica avisa isso. A resposta fica **dentro do cartão**, que se recolhe, para não encher o chat.
  - **Reabrir**: na mensagem do Narrador à qual a dúvida pertence, um ícone **"?"** entre as ações que aparecem ao passar o mouse (junto com Copiar etc.) reabre o cartão, logo abaixo dela, com a pergunta e a resposta; há **Fechar**.
  - **Registro**: a resposta entra no **Log da Cena** como "Continuidade", atualiza o Estado da Cena e fica no histórico de dúvidas da aba.
- **Menu ⚙ > Continuidade**: **Sempre perguntar**, **Só em contradição clara** (padrão) e **Nunca** (o Narrador escolhe e segue); no máximo uma pergunta a cada 6 turnos.
- **A decidir**: enquanto a dúvida está aberta, a mensagem seguinte sempre a responde; falta definir se haverá um jeito de **adiar** a resposta e agir na Cena antes (por exemplo, "Responder depois").

### 2.9 Diário (anotações, o que sei e NPCs)

**Estado:** protótipo aprovado em 2026-11-24 (acréscimo ao protótipo da tela; ADR-078).

- **Entrada**: botão **Diário** no cabeçalho da Ficha, **à esquerda do botão de expandir a ficha**. Abre uma janela larga, no formato da Ficha completa, com três abas na lateral. No Estado da Cena, o botão **ver ficha** de cada NPC abre o Diário já na ficha dele.
- **Anotações**: só do jogador; salvar, editar e apagar, cada uma com o momento. O Narrador não as lê, a menos que o jogador as comente no chat.
- **O que sei**: o que a **personagem** descobriu, agrupado por assunto, com a **origem** de cada informação (viu pessoalmente, ouviu dizer, suspeita) e a Cena. O Narrador pode saber mais.
- **NPCs que conheço**: lista com filtros **Todos**, **Nesta Cena** e **Fora da Cena** e a ficha ao lado. Os NPCs são **criados pelo Narrador** conforme a história (a IA propõe, o motor valida); o jogador pode corrigir e anotar. O **Aduran**, o narrador geral, tem acesso a todas as fichas, inclusive aos segredos e aos stats; o Narrador da Cena recebe só as fichas de quem está presente.
- **Ficha do NPC, duas abas**:
  - **Narrativa**: identidade (aparência, onde costuma estar); personalidade e voz (3 traços, trejeitos, fala de exemplo, o que nunca faria); motivações (quer, teme) e **segredos**; o que sabe e lembra (conhecimentos com origem e confiança; lembranças do jogador com a Cena); relações e atitude com o jogador; estado atual (onde, humor, o que carrega, situação); **anotações do jogador** sobre o NPC.
  - **Stats**: patamar, atributos, perícias e trilhas (Vida e Vontade). **Escondidos do jogador até ele descobrir**: o que foi descoberto aparece com o valor e a origem; o resto, como "?". Um texto diz quantas informações foram descobertas. **Os valores do protótipo são de exemplo**: a ficha de regras (sem Capacidades) vem da fatia 3 do Astra.
  - Um NPC pouco conhecido mostra "Você ainda não sabe" nos campos que o jogador não descobriu.
- **Segredos e stats escondidos**: cada bloco tem um botão **só de ícone** (olho) com dica; revelar abre um popup **"Tem certeza?"** (revelar é spoiler e não dá para desler) com **Cancelar** (foco inicial) e **Revelar mesmo assim**. O olho riscado esconde de novo, sem confirmação. Esc e o fundo fecham só o popup.

### 2.10 Formatação do texto do chat (narração, fala e ação) e campo de escrita

**Estado:** protótipo aprovado em 2026-11-24 (estilo "A · Simples"), com a aparência de livro de RPG. Vale para o chat da Cena e para o do Aduran.

- **Convenção de marcas**, a mesma para o Narrador e para o jogador (as marcas são o que o modelo escreve e o jogador digita; a conversão para o visual é só da interface):
  - **Narração**: sem marca, serifa normal.
  - **Fala**: entre aspas, `"assim"`. Aparece **com travessão (—)**, em **itálico**, no mesmo estilo da ação, e **sem aspas**. O travessão **abre** a fala e a **fecha só quando ainda há texto depois dela** no mesmo parágrafo: `Eu pego a maçã e digo — Tu é feio macho.` e `Eu pego a maçã e digo — Tu é feio macho — Em seguida jogo a maçã nele.`
  - **Ação**: entre asteriscos, `*assim*`. Aparece em **itálico**, na mesma cor e estilo da fala, sem marcador.
- **Quem fala**: quando o texto começa com um nome conhecido seguido de dois pontos e uma fala (`Osvaldo: "…"`), a interface mostra um **chip roxo com o nome** (pixel, borda dourada) **acima da fala, sem recuo**, e o chip **abre a ficha do NPC no Diário**. Sem esse prefixo (ou para um nome desconhecido), a fala aparece só com o travessão.
- **Pensamento do personagem não é um tipo de texto do chat**: nem o do jogador nem o dos NPCs é expresso no chat (decisão do responsável, 2026-11-24); não há marca nem estilo para ele.
- **No campo de escrita**: não há barra de botões. Digitar **/** abre um menu com **fala**, **ação** e **ajuda** (a legenda com exemplos): setas escolhem, Enter ou Tab inserem, Esc fecha, e a lista filtra conforme se digita. Fala e ação inserem o par de marcas com o cursor no meio. **Texto sem marca que o jogador escreve conta como ação.** A dica sob o campo diz "Enter envia · Shift+Enter pula linha · / para formatar". (O `@` fica para o `@Aduran`, backlog.)
- **Melhorar texto**: botão com ícone, **à esquerda do botão de enviar**. O modelo analisa o que o jogador escreveu e **reescreve para melhorar a redação**, **sem mudar o que o personagem faz ou diz e sem inventar fatos**; o resultado substitui o texto do campo, com o aviso "Texto melhorado: revise antes de enviar" e **Desfazer**; **não envia sozinho**. Fica desabilitado com o campo vazio, sem modelo ou durante a resposta, e a dica diz o motivo. No protótipo o texto melhorado é um exemplo fixo. É uma chamada extra ao modelo (`NarratorProvider`), sem entrar no histórico.
- **Segurança**: o texto vindo do modelo é **escapado** antes de aplicar as marcas; HTML solto nunca é interpretado.
- **Acessibilidade**: o destaque não depende só de cor (ADR-068); cada tipo difere pela forma (travessão, itálico, chip); o menu **/** e o botão Melhorar texto têm nome acessível e funcionam pelo teclado.
- **Se o modelo esquecer as marcas**, o trecho aparece como narração comum, sem erro; o teste de continuidade pode medir a aderência à convenção.
- Estilos descartados no protótipo: faixa lateral, placa de nome (card) e duas colunas.

### 2.11 Pontos de retorno

No menu de opções (engrenagem do topo direito), o item **Pontos de retorno** abre a mini-tela de salvamentos manuais e automáticos da Jornada (criar, carregar, salvar por cima, renomear, excluir). Detalhes e decisões em `15-jornadas.md`.

## 3. Estados

- **Jornada sem abertura**: o centro mostra a preparação da Cena inicial; digitação e envio **desabilitados** (ADR-076, item 10); sem modelo, aviso com o caminho para a configuração e **Gerar abertura** desabilitado.
- **Encerrar Cena**: confirmação; depois o resumo aparece na Cena encerrada e no Log, e o centro volta ao Aduran.
- **Telas estreitas**: as colunas viram abas (Arcos, Chat, Ficha).

## 4. Em aberto

- Reflow a 320 px e DPI de 125% a 200% (ADR-068), a verificar na implementação.
- `@Aduran` dentro do chat da Cena (entrega 3b).
- Como o jogador **descobre** os stats de um NPC na história (observação, testes, informações): não definido; a ficha de regras do NPC só será definida na fatia 3 do Astra (os valores do protótipo são de exemplo).
