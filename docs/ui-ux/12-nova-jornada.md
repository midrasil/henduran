# 12 — Nova Jornada (assistente)

**Data:** 2026-11-23
**Estado:** **aprovado pelo responsável em 2026-11-23** depois de várias rodadas do protótipo. Ainda **não implementado**: o app continua com o assistente atual (`app/src/screens/newJourney/`) até a tarefa de implementação.
**Protótipo de referência:** [`prototipos/nova-jornada.html`](prototipos/nova-jornada.html) (botão **Protótipo**: passo, estado do Mundo, do Protagonista, pendências, criação e diálogos). Processo em [`10-prototipagem.md`](10-prototipagem.md).
**Substitui:** a Nova Jornada em `esbocos/ANALISE-ESBOCOS.md` (seção 2.2, assistente de 5 passos) e o layout atual do assistente (formulário em coluna única).
**Relacionados:** `09-tela-da-jornada.md` e `11-menu-inicial.md` (mesma linguagem visual), `ESCOPO-MVP.md` (itens 1 a 3), ADR-075 e ADR-076 (Mundo gerado, Cena inicial).

## 1. Princípios

- **Três passos do MVP**: Mundo, Protagonista e Revisão, seguidos de uma **tela própria, Iniciar Jornada**, onde o jogador dá nome e descrição à Jornada (seção 6). O passo Configurações (modelo e Narrador) do esboço fica fora: o modelo é gerido em Modelos.
- **Nada de regra na interface**: distribuições, perfis, limites e Perícias vêm do servidor (`GET /rules/creation` e `GET /worlds/schema`), como hoje. O protótipo usa os mesmos dados da fatia 1.
- **Pendências visíveis, sem bloquear a digitação**: o passo só valida ao tentar avançar; depois disso, a lista de pendências aparece no topo e cada item leva ao campo.
- **Simetria e linguagem do app**: moldura dourada com cantos, trilho à esquerda, painel central, rodapé fixo com Cancelar, Voltar e Avançar (Criar Jornada no último passo).

## 2. Regiões comuns

```
┌ trilho ──────┐┌ painel ─────────────────────────────────────────────┐
│ ✦ Nova       ││ [selo] Passo N de 3: título            [nota (i)]   │
│   Jornada    ││ ─────────────────────────────────────────────────── │
│ ① Mundo      ││  conteúdo rolável                                   │
│ ② Protag.    ││                                                     │
│ ③ Revisão    ││ ─────────────────────────────────────────────────── │
│ (paisagem)   ││ [Cancelar]        status   [◀ Voltar] [Avançar ▶]   │
└──────────────┘└─────────────────────────────────────────────────────┘
```

1. **Trilho**: título, os 3 passos e uma paisagem em pixel art no rodapé. Cada passo mostra o estado: *Em andamento*, *Completo* (verde, com ✓), *N pendências* (âmbar, depois de tentar avançar) ou *A fazer*. Só se volta a passos anteriores ou ao atual; avançar é pelo botão, que valida.
2. **Cabeçalho**: selo com ícone do passo, título "Passo N de 3", subtítulo e uma **nota em pergaminho** que explica o passo (some abaixo de 1180 px).
3. **Rodapé**: Cancelar (abre confirmação), contagem de pendências do passo, Voltar e Avançar. Na tela Iniciar Jornada, o botão principal é **Iniciar Jornada**, que mostra "Criando…" e desabilita o resto.
4. **Diálogos**: *Descartar a Nova Jornada?* (perigo) e *Gerar outro Mundo?* (só quando o Mundo foi editado).

## 3. Passo 1 — Mundo

Os dois painéis ocupam **toda a altura útil** do passo, cada um com a sua rolagem interna; só o conteúdo de dentro rola.

- **Esquerda, "Mundos"**: lista dos Mundos **já salvos** (nome, era e tom, semente e "Usado em N Jornadas" ou "Ainda sem Jornadas") e, por cima, o **Mundo novo em edição**, quando há, marcado "Novo · salvo ao criar a Jornada". Escolher um item mostra os detalhes à direita. Embaixo, fixo: campo de **semente** com **Usar**, **Gerar mundo** (sorteia uma semente nova) e **Criar do zero**. Erro de geração em aviso vermelho. Sem Mundos salvos, a lista mostra um texto convidando a gerar ou criar.
- **Direita, detalhes do Mundo** em pergaminho: o nome editável direto no título; chips de era, tom, ano, lugar inicial e semente; abas *Visão geral*, *Calendário*, *Religiões* e *Lugares*, cada uma com selo de pendências. **Os dados são campos que o jogador preenche à mão**, seja num Mundo gerado, duplicado ou criado do zero.
- **Semente**: um Mundo gerado mostra a semente usada. Se o jogador **editar** o Mundo, ou criá-lo do zero, a semente passa a "gerada ao criar a Jornada": o jogo grava o Mundo e atribui a semente no fim da criação. Na Revisão, a semente aparece (ou "gerada ao criar a Jornada").
- **Criar do zero**: formulário vazio já com as linhas mínimas do esquema (8 meses, 5 dias da semana, 1 religião, 3 lugares).
- **Mundos salvos** (**proposta**): ficam somente leitura, porque o Mundo é lido sem alteração pelas Jornadas (ADR-075). Um aviso explica isso e oferece **Duplicar e editar**, que cria um Mundo novo (cópia, sem semente) para editar. O **lugar inicial** continua sendo escolhido por Jornada, mesmo num Mundo salvo.
- **Lugares**: cartões, cada um com **Começar aqui** (destaque dourado) e Remover. As contagens do esquema aparecem como dica e desabilitam Adicionar e Remover nos limites.
- **Trocar o Mundo em edição**: gerar outro, criar do zero ou duplicar pede confirmação ("Descartar o Mundo em edição?") **só** se o Mundo novo foi editado. Não há aviso fixo na tela.
- **Sem seleção**: o painel direito convida a escolher, gerar ou criar. Avançar sem Mundo mostra a pendência "Gere um Mundo para continuar".
- **Telas estreitas** (abaixo de 1180 px): a altura total sai; a lista vira um bloco de altura limitada acima dos detalhes.
- Fora deste desenho (MVP): abas Oficiais, Comunidade e Importar do esboço; etiquetas de sistema; **excluir ou renomear Mundos salvos** (a decidir, junto com "Mundos" no menu).

## 4. Passo 2 — Protagonista

Mesma estrutura do passo 1: dois painéis em **altura total**, cartão de pergaminho com **abas**.

- **Esquerda (resumo fixo)**: retrato em moldura circular de degraus de pixel (iniciais enquanto não há imagem), nome e Conceito ao vivo e as Trilhas Vida e Vontade, que reagem aos Atributos.
- **Direita, cartão do Protagonista**: **sem cabeçalho**, só as **quatro abas**: *Identidade*, *História*, *Objetivos* (Ambição, Desejo e as 3 Convicções) e *Status* (Atributos em cima e Perícias embaixo, na mesma aba). Cada aba mostra um selo de pendências ou um ✓ verde. Não há botões de aba anterior ou próxima: o jogador troca de aba pelas próprias abas, e o botão **Avançar** do rodapé leva à **próxima aba ainda não concluída** (a busca segue a ordem das abas e recomeça do início); quando nada falta, leva ao passo seguinte. O rodapé lista o que falta ("Faltam: Atributos, Perícias"). O mesmo vale para as abas do Mundo.
- **Identidade**: nome e conceito (obrigatórios) e **aparência opcional**; idade, altura, origem e personalidade num bloco opcional recolhido.
- **História**: **a aba inteira é a área de texto**, sem texto de ajuda nem campo de ideia; o editor ocupa toda a altura da aba, com barra no estilo processador de texto: estilo do parágrafo (Parágrafo, Título, Subtítulo), negrito, itálico, sublinhado, tachado, lista com marcadores e numerada, citação, alinhamento (esquerda, centro, direita, justificado), desfazer, refazer e limpar formatação; contador de palavras e de caracteres (limite de 4.000 do servidor). Obrigatória.
- **Narrador preenchendo dados** (como no Caliope): botão **Sugerir** ao lado de cada campo de texto (nome, conceito, aparência, Ambição, Desejo, cada Convicção e cada Pilar); no topo de cada aba, um campo **Ideia para o Narrador (opcional)** e o botão **Preencher o que falta** (nas abas História, Atributos e Perícias: **Escrever o que falta**, **Sugerir Atributos**, **Sugerir perfil e Perícias**); na História, **Escrever** e **Continuar** na barra do editor. O Narrador **só preenche o que está em branco** (exceto o Sugerir de um campo, que sobrescreve só aquele campo). Depois de preencher, um aviso oferece **Desfazer**. Sem modelo carregado, os botões ficam desabilitados com a dica "Carregue um modelo em Modelos"; em erro, um aviso explica e nada muda. Para Atributos e Perícias o Narrador **propõe** uma distribuição válida; o motor valida (AGENTS.md).
- **Status, parte de cima: Atributos**: uma linha por Atributo, agrupadas em Físico e Espiritual (duas colunas em janelas largas): nome e descrição à esquerda, botões de valor (1 a 4) à direita e o valor grande no fim; os esgotados ficam desabilitados e as Perícias do Atributo aparecem na dica. Contador dos valores usados no topo do bloco. **Sortear** e **Sugerir** (Narrador) ficam na mesma linha do texto de ajuda.
- **Status, parte de baixo: Perícias**: três cartões de perfil compactos (nome e distribuição em uma linha); depois as Perícias em blocos por Atributo, cada bloco com o valor do Atributo no cabeçalho e as Perícias em duas colunas. Cada Perícia é uma linha com **quatro quadradinhos** (clicar no 3º dá valor 3; clicar no valor atual volta a 0); os valores sem vaga no perfil ficam hachurados e desabilitados; a descrição fica na dica. Trocar de perfil zera as Perícias. **Sortear** e **Sugerir** na mesma linha do texto de ajuda.
- **Pendências**: ao tentar avançar aparece a lista no topo (em duas colunas); cada item abre a aba certa. Campos obrigatórios em branco ficam em vermelho.
- **Retrato** (opcional, também editável depois na Jornada, ver `09-tela-da-jornada.md`, item 2.7): **a própria área do retrato é o botão** de escolher ou trocar (dica ao passar o mouse ou focar; sem botão nem texto extra). O diálogo tem prévia circular; **arrastar** enquadra, o controle **Aproximar** vai de 1 a 8; **Escolher imagem** aceita PNG, JPEG e WebP até 20 MB (conferidos pelo conteúdo); **Remover retrato**. A imagem original é a que se guarda; o recorte é `{x, y, zoom}`. O protótipo traz um botão de imagem de exemplo. A coluna da esquerda mostra também nome, Conceito e as **Trilhas** Vida e Vontade (`3 + Vigor`, `3 + Determinação`).
- **Telas estreitas** (abaixo de 1180 px): o resumo vira uma faixa acima do cartão; o cartão deixa de ter altura total.

## 5. Passo 3 — Revisão

Mesma estrutura dos outros passos: cartão de pergaminho em altura total com **duas abas**, *Mundo* e *Personagem*.

- **Mundo**: título com o nome e **Editar Mundo** (volta ao passo 1); era, tom, calendário, lugar inicial, situação ("Mundo salvo, já existente" ou "Mundo novo, salvo ao criar a Jornada") e semente (ou "gerada ao criar a Jornada"); descrições da era e do tom; o calendário (meses com os dias e a semana); as religiões e os lugares em cartões, com o lugar inicial destacado.
- **Personagem**: título com o nome e **Editar Personagem** (volta ao passo 2); retrato ao lado dos dados (conceito, Ambição, Desejo e os campos opcionais); aparência, história formatada, Convicções com Pilares, Atributos em barras com Vida e Vontade, e as Perícias com valor.
- **Nome da Jornada (opcional)**: faixa fixa no pé do cartão, visível nas duas abas, com o padrão "A Jornada de <nome>" no *placeholder*.
- **Criar Jornada** (rodapé): "Criando…", depois abre a tela da Jornada em Cena no lugar inicial (ADR-076). Em erro, aviso vermelho dizendo que nada foi gravado pela metade e que os dados continuam no assistente.

## 6. Tela Iniciar Jornada

Depois dos três passos, **Avançar** na Revisão leva a uma tela própria. No trilho, os três passos aparecem completos e **Iniciar Jornada** é um item separado, em destaque; os passos anteriores continuam clicáveis.

- **Esquerda**: retrato, nome e Conceito do personagem e o quadro **Onde tudo começa** (Mundo, lugar inicial e "Em Cena, em um período sorteado pelo jogo", ADR-076).
- **Direita, cartão**: **Nome da Jornada** (opcional; padrão "A Jornada de <nome>" no *placeholder* e na dica) e **Descrição** (opcional, até 2.000 caracteres), cada um com o botão **Sugerir** do Narrador (que usa o Mundo, o lugar inicial e o personagem). O texto de ajuda diz que o Narrador lê a descrição e que os dois podem ser mudados depois, dentro da Jornada. Um aviso lembra que, ao iniciar, o Mundo e o personagem são gravados e o Aduran abre a primeira Cena.
- **Rodapé**: Cancelar, **Voltar** (à Revisão) e **Iniciar Jornada**. "Criando…" desabilita tudo; em erro, aviso vermelho dizendo que nada foi gravado pela metade e que os dados continuam no assistente; em sucesso, abre a tela da Jornada em Cena no lugar inicial.
- **Dado novo (proposta)**: a **descrição da Jornada** não existe hoje no modelo de dados. Proposta: guardá-la em `journey_meta` (ADR-075) e incluí-la no contexto do Narrador. Precisa de aprovação.

## 7. Diferenças em relação ao app atual

- Formulário em coluna única, com um painel por bloco, vira passos com trilho, abas e resumo de progresso.
- O Mundo deixa de ser uma pilha de painéis e passa a ser um cartão com abas.
- Os Atributos e as Perícias deixam de ser listas de selects e passam a botões de valor com contadores.
- **Propostas desta rodada, a aprovar**: lista de Mundos salvos no próprio passo, Mundos salvos somente leitura com Duplicar e editar, semente gerada ao criar para Mundos editados à mão; lista de pendências ligada ao resumo de progresso; trilhas Vida e Vontade visíveis durante a criação; lugar inicial escolhido no próprio cartão do lugar; paisagem no trilho; retrato no assistente, ao lado do resumo do personagem; abas no Protagonista e na Revisão; aba própria de História com editor de texto; botões do Narrador para preencher dados.

## 8. Pendências para a implementação

- **Decisão em aberto, formato da História**: o servidor guarda texto simples (até 4.000 caracteres). O editor produz formatação; é preciso aprovar um formato (por exemplo, Markdown limitado ou HTML saneado), como o Narrador lê esse texto e o limite de tamanho. Até lá, o protótipo só mostra a interação.
- **Descrição da Jornada**: campo novo (ver seção 6); precisa de coluna em `journey_meta`, validação de tamanho e uso no contexto do Narrador.
- **Narrador preenchendo dados**: precisa de uma rota no backend que use o `NarratorProvider` (propor, o motor valida), com tempo limite, cancelamento e tratamento de erro; os textos de exemplo do protótipo não são o contrato.

- Reaproveitar `app/src/ui/` (Button, Panel, Tabs, Dialog, FieldGroup, RadioGroup, TrailBoxes) e criar o que faltar (valores em botões, moldura com cantos); nada do HTML do protótipo vai para `app/src/`.
- Manter `GET /rules/creation` e `GET /worlds/schema` como fonte de verdade; o protótipo codifica os valores só para exemplo.
- Verificar leitor de tela (abas, grupos de botões), foco ao clicar numa pendência, DPI de 125% a 200% e reflow a 320 px.
