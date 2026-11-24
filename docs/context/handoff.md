# Handoff — estado atual do Henduran

Atualizado em 2026-11-24 após a tarefa `nova-jornada` (rodada 1).

## Estado

- Tarefa: implementação da Nova Jornada aprovada (`docs/ui-ux/12-nova-jornada.md`, protótipo `prototipos/nova-jornada.html`, ADR-077), **rodada 1** de 2. O responsável testou no app e validou.
- Interface: assistente com trilho de 3 passos e a tela **Iniciar Jornada** (nome e descrição); Mundo com lista de Mundos salvos (somente leitura, Duplicar e editar), semente, Gerar mundo e Criar do zero; Protagonista em abas (Identidade, História, Objetivos, Status) com retrato e recorte; Revisão em abas; Avançar por abas incompletas, sem lista de pendências. `HistoryEditor` (`app/src/ui/HistoryEditor/`) é um editor **provisório** com contenteditable, com espaço `toolbarExtra` para os botões do Narrador.
- Backend: `richtext.py` (sanitizador de HTML só com `html.parser`, lista permitida, texto puro derivado); `history_html` na criação e na ficha; descrição da Jornada em `journey_meta` (até 2.000 caracteres, entra no contexto do Narrador); criação com `world_id` (Mundo salvo, só leitura para a Jornada); semente do Mundo em `world_meta.seed` (a pedida só vale se gera exatamente o conteúdo enviado; senão o serviço atribui uma nova); `GET /worlds` (catálogo com semente, era, tom e número de Jornadas), `GET /worlds/{id}`; migrações `journey/0005_description_history.sql` e `world/0002_seed.sql`.
- Validações: `npm run typecheck` sem erros; `npm run test` 303/303 (reconfirmado depois de levar as alterações para a `main` atualizada); `pytest` 638 passando e 1 pulado (relatado pelo dev; não reexecutado depois do rebase, que só trouxe o PR #29, do menu).
- Não verificado: app Tauri real em DPI de 125% a 200%, leitor de tela, reflow a 320 px, movimento reduzido, comandos de formatação do editor em outros navegadores.
- Diferenças em relação ao protótipo (seção 9 do doc 12): selos das abas contam erros do servidor; **aparência continua obrigatória** (o banco exige 1 caractere); sem botões do Narrador; trocar de Mundo zera o lugar inicial (ids `lugar-N` se repetem); moldura sem cantos em pixel e trilho só com o céu; zoom do retrato até 4 (o serviço aceita até 8).
- Ocorrência: no meio do trabalho a pasta principal foi trocada para `fix/rodape-menu-modelo` (PR #29, mergeado); as alterações do dev foram levadas para `feat/nova-jornada` em cima da `main` atualizada, sem conflito.
- Branch: `feat/nova-jornada`; PR [#30](https://github.com/midrasil/henduran/pull/30) aberto contra `main`.
- Processo atual: prototipar e documentar uma tela existente por vez (`docs/ui-ux/10-prototipagem.md`); protótipos aprovados: Jornada, menu inicial e Nova Jornada.

## Decisões de 2026-11-24 para a rodada 2 e depois

- **Rodada 2** (dev): instalar o **TipTap** (aprovado; MIT; medir o bundle e desligar `link`, `code` e `codeBlock` do StarterKit) no lugar do editor provisório; **rota do Narrador que preenche dados** e os botões (Sugerir, Preencher o que falta, Escrever, Continuar, Desfazer), conforme ADR-077; **aparência opcional** (migração que reconstrói a tabela `character`); **aviso na tela** quando o envio do retrato falha depois da criação.
- **Tela de Mundos no menu inicial**: botão no menu que leva a uma lista dos Mundos salvos, com criação de Mundo lá dentro. Tela nova: **precisa de protótipo aprovado** antes do dev. Ao projetá-la, decidir também a exclusão: hoje excluir a última Jornada de um Mundo apaga o Mundo (`delete_journey_and_orphan_world`), o que não combina com Mundos como itens salvos; proposta: o Mundo só é excluído pela lista de Mundos, de forma explícita.
- Editar nome e descrição **dentro** da Jornada (não existe rota de edição do resumo): a decidir.

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

⭐ Rodada 2 da Nova Jornada pelo dev (Narrador, TipTap, aparência opcional, aviso do retrato), em branch empilhada sobre a da rodada 1 ou depois do merge do PR da rodada 1. Em paralelo, prototipar a tela de **Mundos** (lista, criar Mundo, exclusão explícita), depois **Jornadas** e **Modelos**, conforme `docs/ui-ux/10-prototipagem.md`.
