# Handoff — estado atual do Henduran

Atualizado em 2026-11-24 após a tarefa `prototipo-jornadas` (lista de Jornadas e Pontos de retorno).

## Estado

- Tarefa: rodada 2 da Nova Jornada (a rodada 1 foi o PR #30, mergeado) mais três ampliações pedidas pelo responsável no mesmo dia. Branch `feat/nova-jornada-narrador`; PR [#32](https://github.com/midrasil/henduran/pull/32) aberto contra `main`.
- **TipTap** (3.35.0, MIT, versões exatas) no lugar do editor provisório: `@tiptap/react`, `pm`, `starter-kit`, `extension-text-align`, `extension-placeholder` (underline vem no StarterKit v3; `link`, `code`, `codeBlock`, `horizontalRule`, `hardBreak` e `trailingNode` desligados; `extension-character-count` removido). Carregado sob demanda na aba História (`LazyHistoryEditor`): pacote inicial 435,5 kB (132,6 kB gzip), editor 407,5 kB (129,6 kB gzip). O servidor continua sendo a fonte de verdade do saneamento.
- **Narrador que preenche dados**: `POST /narrator/fill` (SSE; `start` e `done` com `result` ou `error`; tipos `field`, `missing`, `attributes`, `skills`, `history`; esquema fixo, resposta inválida repetida até 2 vezes, tempo limite de 120 s, cancelável; sem modelo usa os códigos do chat; nada é gravado) e os botões na interface (Sugerir, Preencher o que falta, Sugerir Atributos e Perícias, Escrever, Continuar, Desfazer). Código em `backend/henduran/narrative/fill.py` e `services/fill.py`, `app/src/screens/newJourney/narrator.tsx` e `app/src/api/narratorFill.ts`. Sugerir Atributos e Perícias só preenche o que falta; ideia até 500 caracteres.
- **Aparência opcional**: migração `journey/0006_optional_appearance.sql` (reconstrói `character` preservando Atributos, Perícias, Convicções e objetivos); a aparência só entra no contexto do Narrador se existir.
- **Aviso do retrato**: se o envio falha depois da criação, a Jornada abre com aviso e os botões Tentar de novo, Escolher outro e Fechar.
- **Mundo personalizado**: Mundo editado, do zero ou duplicado não tem semente (`world_meta.seed` nulo); a interface mostra "Mundo personalizado". A `world/0002` não foi reescrita (mudaria o checksum dos bancos do PR #30).
- **Excluir Jornada não apaga mais o Mundo** (`services/journey_deletion.delete_journey`, resposta `{deleted, world_id}`).
- **Tela de Mundos** (implementada sem protótipo, por decisão do responsável em 2026-11-24, e depois **aprovada como está**; o protótipo `docs/ui-ux/prototipos/mundos.html` foi feito só como registro): botão **Mundos** no menu, `app/src/screens/WorldsScreen.tsx` (reaproveita `WorldStep` em modo `library`), `POST /worlds`, `DELETE /worlds/{id}` (409 `mundo_em_uso` ou `uso_indeterminado`; exclusão atômica por renomeação). Documento `docs/ui-ux/13-mundos.md`. A nota "Tela provisória" do cabeçalho foi removida.
- **Editar Jornada**: `PATCH /journeys/current` (nome e descrição, regras da criação; 422 `resumo_invalido`) e "Editar Jornada" no menu ⚙ da Jornada.
- Validações: `npm run typecheck` sem erros; `npm run test` 320/320 (reexecutado pelo planejador); `pytest` 662 passando e 1 pulado, `npm run build` ok (relatados pelo dev; não reexecutados pelo planejador). Após o merge da `main` no PR #31, revalidado no worktree do PR: `npm run typecheck` OK, `npm run test -- src/screens/MainMenu.test.tsx` 17/17 e `npm run test` 321/321.
- Não verificado: app Tauri real, TipTap em navegador real (digitar, atalhos, colar do Word), leitor de tela, DPI de 125% a 200%, reflow a 320 px, qualidade das sugestões com modelo local real e se o `llama-server` aceita os esquemas com `const` e `enum` (se recusar, o cliente repete sem esquema e o motor valida).
- Aprovado pelo responsável: editor sob demanda, remoção do `character-count`, `world/0002` intacta, comportamento de Sugerir Atributos e Perícias e os limites (ideia 500 caracteres, 120 s, 2 novas tentativas), na opção recomendada.
- Processo atual: prototipar e documentar uma tela existente por vez (`docs/ui-ux/10-prototipagem.md`); protótipos aprovados: Jornada, menu inicial, Nova Jornada e Mundos (registro).
- Ajustes do menu em paralelo (PR #29 merged): rodapé sem caixa com `Conectado · <detalhe> · Modelos ▸`, cartão de primeira vez removido, gap dos botões centrais de 12 px para 16 px (`--space-2`) e sombra externa removida; seguem no PR [#31](https://github.com/midrasil/henduran/pull/31), aberto contra `main` após resolução de conflitos com a `main` atual.

## Atualização de 2026-11-24 (tarde): Modelos e Skills, ADR-078

- **Protótipo da tela Modelos e Skills aprovado** (`docs/ui-ux/14-modelos.md`, `prototipos/modelos.html`; este PR): cabeçalho de estado (Este PC, Motor de IA, Narrador) e quatro abas: **Modelos** (meus e para baixar, com filtros Todos, Meus modelos e Para baixar, busca única, notas de qualidade por quantização, ocultar, ajustes de contexto e camadas da GPU, sugestões por hardware), **Skills** (acervo do Caliope, filtros, limite de 3 ativas, importação do skills.sh/GitHub e de pasta, com conferência e entrada desativada), **Procurar neste PC** e **Downloads**. Implementação no backlog; decisões abertas: padrão do filtro +18, licenças das skills, API e termos do skills.sh, ativação por Jornada e por Cena.
- **ADR-078 (proposta, PR #35 mergeado)**: memória e contexto do Narrador (Quadro da Cena, Cânone, fichas de NPC com memória, compactação, orçamento de tokens, pergunta de continuidade e teste de continuidade). Só a pergunta de continuidade (modo padrão "só em contradição clara") está aprovada; os itens ⏳ aguardam confirmação do responsável.
- PRs de hoje já mergeados: #30 a #35 (Nova Jornada rodadas 1 e 2, botão Configurar modelo, registro da tela de Mundos e ADR-078).

## Atualização de 2026-11-24 (noite): Estado da Cena

- **Protótipo aprovado** (acréscimo ao `prototipos/tela-da-jornada.html`; `09-tela-da-jornada.md`, item 2.8; este PR): o **Estado da Cena** é uma **aba do chat** (ícone no cabeçalho, ao lado de Aduran e Log), com Aqui e agora, Quem está presente (Postura, Posição, Segura, Humor, Sabe, editáveis pelo jogador), Em aberto, Skills desta Cena e o histórico de **dúvidas de continuidade**. A **Ficha continua como era**. A **dúvida de continuidade** é um cartão na largura do chat, sem botões de escolha (só **Você decide**); **a próxima mensagem digitada responde ao cartão e não vai para o chat**; a resposta fica dentro do cartão, que se recolhe, e um ícone nas ações da mensagem de origem (ao passar o mouse) o reabre; também entra no Log e no histórico.
- **ADR-078** passa a "proposta, parcialmente confirmada": confirmados pelo protótipo o Quadro editável, a chamada extra e a skill sugerida pelo Aduran; seguem ⏳ a compactação a ~70%, as fichas de NPC e as skills de estilo por Jornada.
- **Ficha do NPC ainda não existe** e é o próximo bloqueio: o contexto de um NPC vem principalmente da ficha dele (o que sabe, lembra, esconde), não da Cena; o campo "Sabe" do Estado da Cena é provisório (item novo no backlog).
- A decidir: adiar a resposta à dúvida ("Responder depois"), ver `09`, item 2.8.

## Atualização de 2026-11-24 (madrugada): Diário e ficha do NPC

- **Protótipo aprovado** (acréscimo à tela da Jornada; `09-tela-da-jornada.md`, item 2.9; este PR): botão **Diário** à esquerda do expandir da Ficha, com **Anotações** (só do jogador), **O que sei** (com origem de cada informação) e **NPCs que conheço** (filtros Todos, Nesta Cena, Fora da Cena). A **ficha do NPC tem duas abas**: **Narrativa** (identidade, personalidade e voz, motivações e segredos, o que sabe e lembra, relações, estado, anotações do jogador) e **Stats** (patamar, atributos, perícias e trilhas). **Segredos e stats ficam escondidos até o jogador descobrir**; revelar é um botão de ícone com popup "Tem certeza?". O Aduran vê tudo.
- O Estado da Cena **não tem mais campo "Sabe"** com texto: só o link **ver na ficha** (o conhecimento do NPC vem da ficha).
- **Em aberto:** a **ficha de regras** do NPC (fatia 3 do Astra; os valores do protótipo são de exemplo) e **como o jogador descobre os stats** (não inventado); esquema de dados do Diário.
- **Formatação do texto do chat** (item 2.10 do `09`): convenção `"fala"`, `*ação*`, `_pensamento_`; narração sem marca. Fala com travessão e ação no mesmo estilo (itálico); pensamento em itálico roxo entre parênteses; `Nome: "fala"` mostra um **chip roxo com o nome acima da fala, sem recuo**, que abre a ficha do NPC; barra **Fala, Ação, Pensamento** no campo de escrita e legenda no **?**. Estilo "A · Simples" escolhido entre quatro. **O pensamento do jogador é privado** (NPCs não o conhecem). A convenção entra no prompt do Narrador (`05`, seção 6.2).
- O PR #37 (Estado da Cena e dúvida de continuidade) já foi mergeado.

## Atualização de 2026-11-24 (madrugada, 2): Jornadas e Pontos de retorno

- **PR #38 mergeado** (Diário, ficha do NPC e formatação do texto do chat).
- **Protótipos aprovados** (este PR): **tela Jornadas** (`prototipos/jornadas.html`; lista com busca e filtros; o detalhe mostra **só os pontos de retorno**; lista vazia em tela cheia) e **Pontos de retorno** no menu de opções da tela da Jornada (`09`, item 2.11; `15-jornadas.md`). Salvamentos manuais (até 20) e automáticos (5, no início e no fim de cada Cena); Carregar guarda antes "Antes de carregar".
- **A confirmar na implementação:** carregar sobrescreve (e não bifurca); limites; o Mundo não volta com o ponto; como armazenar (cópia do `journey.db` ou diferença).
- **Próximos passos:** ⭐ voltar à implementação com o dev (Modelos, depois Estado da Cena, Diário e dúvida de continuidade, e os pontos de retorno); ficha de regras do NPC (fatia 2/3 do Astra); decidir o ADR de armazenamento dos pontos.

## Decisões vigentes

- **Stack (ADR-001):** Tauri, React + TypeScript, PixiJS, Python, só Windows na fase inicial. Não iniciar scaffolding ou prova de conceito sem instrução explícita.
- **UI:** pixel art em CSS com tokens próprios (ADR-069), resolução/acessibilidade em ADR-068, ambiente de dia/noite em `docs/ui-ux/07-ambiente-dia-noite.md`. Telas novas ou redesenhos grandes exigem protótipo navegável aprovado (`docs/ui-ux/10-prototipagem.md`); ajustes pequenos podem ir direto ao código.
- **IA local:** llama.cpp/`llama-server` + GGUF, local primeiro e API paga depois (ADR-070 a 072), interface `NarratorProvider` e HTTP local com SSE.
- **Armazenamento (ADR-075):** banco do app, `journeys\<id>\journey.db`, `worlds\<id>\world.db` anexado em leitura; nunca recriar banco de Jornada em silêncio.
- **Regras:** MVP em `docs/main/planejamento/ESCOPO-MVP.md`; Cena inicial e ciclo de Cena em ADR-076; Dia do Mundo em ADR-073; editor da Nova Jornada em ADR-077 (História em HTML saneado, descrição da Jornada, Narrador que preenche dados).
- **Caliope:** uso autorizado pelo autor; não copiar código sem conferir licença e fronteiras. Registro em `docs/main/importacoes-caliope.md`.

## Código existente

- `app/src/`: navegação em `navigation.ts`; telas em `screens/`; cliente de API em `api/`; componentes base em `ui/` e estilos em `styles/`. O menu usa `MainMenu.tsx` + `screens/menu/MainMenu.css`; o indicador reusa os mesmos tokens das outras telas.
- `backend/henduran/`: providers, runtime local, migrações por conjunto, storage, regras da fatia 1, worldgen, serviços de criação e API SSE. Rodar com `HENDURAN_PROVIDER=fake|local`.
- Comandos: `cd app; npm run tauri dev`; testes `npm run test` e `backend\.venv\Scripts\python -m pytest`; checagem `npm run typecheck`.
- As mensagens da Jornada usam `.msgs`/`.msg` em `app/src/screens/journey/JourneyScreen.css`, com largura total da coluna desde o PR #25.

## Pendências relevantes

- Conferir visualmente o menu sem cartão e o rodapé no app real (1280×800, 1024×768, estreito), com modelo carregado, sem modelo e serviço iniciando.
- Conferir visualmente a Jornada com modelo local real: largura das mensagens, abertura/encerramento de Cena e marcação `[[propor_cena]]`.
- A implementação da Nova Jornada está em andamento em paralelo; há alterações não commitadas no worktree principal. Antes de instalar o TipTap, conferir licença das extensões e tamanho do pacote e pedir aprovação.
- Restaurar backup no app real, leitor de tela, DPI de 125% a 200%, reflow a 320 px.
- Backups da Jornada não incluem `assets\`; limites de Fraturas e estado das trilhas não vêm do backend.
- ARO/ADR em aberto: formato da proposta de encerramento no chat, Cena seguida de outra sem passar pelo Aduran, passagem de tempo em períodos, retenção de backups e anexos em ADR-075.
- Gerador de mundo: reduzir repetição de raízes de nomes e de descrições.
- Excluir `app/src-tauri/target/` e `node_modules/` da sincronização do OneDrive.
- Backlog autoritativo: `docs/backlog.md`.

## Próximo passo recomendado

⭐ (1) Confirmar os itens ⏳ restantes do ADR-078 (compactação a ~70%, fichas de NPC, skills de estilo por Jornada); (2) prototipar a tela **Jornadas** (lista), a última tela existente sem protótipo; (3) implementar, em rodadas com o dev, a tela **Modelos** e depois o **Estado da Cena**, o **Diário** e a dúvida de continuidade (esquema de dados, extrator do Quadro, teste de continuidade); (4) definir a **ficha de regras do NPC** junto com a fatia 3 do Astra. Em paralelo, do lado do responsável: testar a Nova Jornada com um modelo local real e conferir o menu em 1024×768 e maximizado.
