# ADR-077 — Nova Jornada: História formatada, descrição da Jornada e Narrador que preenche dados

- **Estado:** Aprovada (decisões do responsável em 2026-11-23, ao fechar o protótipo da Nova Jornada)
- **Data:** 2026-11-23
- **Complementa:** ADR-071 (`NarratorProvider`), ADR-072 (HTTP com SSE), ADR-075 (banco por Jornada e por Mundo) e ADR-076 (Cena inicial)
- **Refina:** `docs/ui-ux/12-nova-jornada.md` (seções 4, 6 e 8)
- **Origem:** decisão explícita do responsável pelo Henduran em 2026-11-23

## Contexto

O protótipo aprovado da Nova Jornada (`12-nova-jornada.md`) pede três coisas que o modelo de dados e a API atuais não cobrem: uma **História com formatação**, escrita num editor de texto parecido com um processador de texto; **botões do Narrador** que preenchem campos do personagem; e uma **descrição da Jornada**, escrita numa tela própria depois dos três passos. Hoje a História é texto simples de até 4.000 caracteres, não existe rota para o Narrador sugerir dados, e a Jornada só tem nome.

## Decisão aprovada

1. **Editor da História: TipTap (ProseMirror), num conjunto enxuto.** Recursos do MVP: negrito, itálico, sublinhado, tachado, Título e Subtítulo, listas com marcadores e numeradas, citação, alinhamento, desfazer e refazer, limpar formatação, placeholder e contador de caracteres. **Fora do MVP:** tabelas, imagens, links, cores, fontes e tamanhos. É uma **dependência nova**: a licença das extensões usadas (as extensões "Pro" são pagas e não entram) precisa ser conferida e a instalação aprovada na tarefa de implementação, como exige o `AGENTS.md`. O editor do protótipo (`execCommand`) é só ilustrativo e não vai para o app.
2. **A História é gravada como HTML saneado, com texto puro derivado.**
   - O servidor **sanea** o HTML recebido com uma lista permitida de tags e atributos (parágrafo, títulos de nível 2 e 3, negrito, itálico, sublinhado, tachado, listas, itens, citação e o alinhamento do parágrafo); o saneamento não depende do editor.
   - O **texto puro** é derivado no servidor a partir do HTML saneado. O **limite de 4.000 caracteres conta o texto puro**, e é o texto puro que o Narrador lê no contexto; a formatação só importa para a tela.
   - Histórias existentes (texto simples) são lidas como parágrafos, sem migração destrutiva.
3. **O Narrador preenche dados por uma rota própria do serviço local, sem gravar nada.**
   - A rota usa o `NarratorProvider` (ADR-071) e segue o protocolo do ADR-072; o nome e o formato exatos ficam para a implementação.
   - A entrada diz o que preencher (um campo, uma aba ou o personagem inteiro), traz a ideia opcional do jogador e o contexto já preenchido (Mundo, lugar inicial e campos do personagem). Em "Escrever" e "Continuar" da História, a entrada é o texto que já está escrito.
   - **A IA propõe, o motor valida** (`AGENTS.md`): a resposta tem **esquema fixo** e é validada antes de ir ao cliente. Para Atributos e Perícias, o motor só aceita uma distribuição **válida** (valores e perfil do catálogo de criação) e rejeita ou pede de novo, com limite de tentativas. Textos passam pelos limites de tamanho de cada campo; a História volta como HTML saneado.
   - **O cliente só aplica em campos em branco** quando a ação é "preencher o que falta"; "Sugerir" num campo sobrescreve só aquele campo. Toda aplicação oferece **Desfazer** no cliente.
   - A rota é **cancelável**, tem **tempo limite** e devolve **erro explícito**; sem modelo carregado, o cliente desabilita os botões e a rota responde com um código claro. **Nada é gravado** até o jogador criar a Jornada.
4. **Descrição da Jornada.** Campo **opcional** de até **2.000 caracteres**, guardado em `journey_meta` (ADR-075), editável depois dentro da Jornada, **incluído no contexto do Narrador** (abertura da Cena inicial e demais contextos gerais). O **nome** continua opcional, com o padrão "A Jornada de <nome do personagem>".
5. **Mundos salvos são somente leitura na Nova Jornada.** Para alterar um Mundo salvo, o jogador **duplica** e edita a cópia, que vira um Mundo novo, salvo ao criar a Jornada. Isso decorre do ADR-075 (o `world.db` é lido sem alteração pelas Jornadas). Um Mundo editado à mão ou criado do zero recebe a semente **ao ser criado**.
   - *Refinamento (responsável, 2026-11-24):* em vez de uma semente nova, o Mundo editado à mão, criado do zero ou duplicado vira **"Mundo personalizado"**, sem semente (`world_meta.seed` nula); a semente só é guardada quando reproduz exatamente o conteúdo (Mundo gerado e não editado).

## Consequências

- Mudanças de documentação a fazer **na implementação**: `docs/main/modelo-de-dados-jogo.md` (História em HTML, texto puro derivado, descrição em `journey_meta`), `docs/main/05-narrador-ia.md` (rota de preenchimento e esquema de resposta) e `docs/main/04-arquitetura.md` (rota nova).
- Nome da rota, colunas, versão do esquema do personagem, prompts e limite de tentativas de validação ficam para a implementação e não são decididos aqui.
- A Nova Jornada só entra em implementação depois da aprovação da dependência do editor (licença e tamanho medido).

## O que esta decisão não faz

- Não altera regras do Astra nem o fluxo da Jornada depois de criada.
- Não decide a edição da História **dentro** da Jornada (a ficha); se ela usará o mesmo editor, fica para a tarefa da ficha.
