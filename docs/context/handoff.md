# Handoff — estado atual do Henduran

Atualizado em 2026-11-24 após a tarefa `nova-jornada` (rodada 2).

## Estado

- Tarefa: rodada 2 da Nova Jornada (a rodada 1 foi o PR #30, mergeado) mais três ampliações pedidas pelo responsável no mesmo dia. Branch `feat/nova-jornada-narrador`; PR aberto contra `main` (link no jornal).
- **TipTap** (3.35.0, MIT, versões exatas) no lugar do editor provisório: `@tiptap/react`, `pm`, `starter-kit`, `extension-text-align`, `extension-placeholder` (underline vem no StarterKit v3; `link`, `code`, `codeBlock`, `horizontalRule`, `hardBreak` e `trailingNode` desligados; `extension-character-count` removido). Carregado sob demanda na aba História (`LazyHistoryEditor`): pacote inicial 435,5 kB (132,6 kB gzip), editor 407,5 kB (129,6 kB gzip). O servidor continua sendo a fonte de verdade do saneamento.
- **Narrador que preenche dados**: `POST /narrator/fill` (SSE; `start` e `done` com `result` ou `error`; tipos `field`, `missing`, `attributes`, `skills`, `history`; esquema fixo, resposta inválida repetida até 2 vezes, tempo limite de 120 s, cancelável; sem modelo usa os códigos do chat; nada é gravado) e os botões na interface (Sugerir, Preencher o que falta, Sugerir Atributos e Perícias, Escrever, Continuar, Desfazer). Código em `backend/henduran/narrative/fill.py` e `services/fill.py`, `app/src/screens/newJourney/narrator.tsx` e `app/src/api/narratorFill.ts`. Sugerir Atributos e Perícias só preenche o que falta; ideia até 500 caracteres.
- **Aparência opcional**: migração `journey/0006_optional_appearance.sql` (reconstrói `character` preservando Atributos, Perícias, Convicções e objetivos); a aparência só entra no contexto do Narrador se existir.
- **Aviso do retrato**: se o envio falha depois da criação, a Jornada abre com aviso e os botões Tentar de novo, Escolher outro e Fechar.
- **Mundo personalizado**: Mundo editado, do zero ou duplicado não tem semente (`world_meta.seed` nulo); a interface mostra "Mundo personalizado". A `world/0002` não foi reescrita (mudaria o checksum dos bancos do PR #30).
- **Excluir Jornada não apaga mais o Mundo** (`services/journey_deletion.delete_journey`, resposta `{deleted, world_id}`).
- **Tela de Mundos, modelo inicial provisório e sem protótipo** (exceção à regra de protótipo, decisão do responsável em 2026-11-24): botão **Mundos** no menu, `app/src/screens/WorldsScreen.tsx` (reaproveita `WorldStep` em modo `library`), `POST /worlds`, `DELETE /worlds/{id}` (409 `mundo_em_uso` ou `uso_indeterminado`; exclusão atômica por renomeação). Documento curto `docs/ui-ux/13-mundos.md`. **O protótipo será feito em 2026-11-25, em outra máquina**, e a tela será ajustada depois.
- **Editar Jornada**: `PATCH /journeys/current` (nome e descrição, regras da criação; 422 `resumo_invalido`) e "Editar Jornada" no menu ⚙ da Jornada.
- Validações: `npm run typecheck` sem erros; `npm run test` 320/320 (reexecutado pelo planejador); `pytest` 662 passando e 1 pulado, `npm run build` ok (relatados pelo dev; não reexecutados pelo planejador).
- Não verificado: app Tauri real, TipTap em navegador real (digitar, atalhos, colar do Word), leitor de tela, DPI de 125% a 200%, reflow a 320 px, qualidade das sugestões com modelo local real e se o `llama-server` aceita os esquemas com `const` e `enum` (se recusar, o cliente repete sem esquema e o motor valida).
- Aprovado pelo responsável: editor sob demanda, remoção do `character-count`, `world/0002` intacta, comportamento de Sugerir Atributos e Perícias e os limites (ideia 500 caracteres, 120 s, 2 novas tentativas), na opção recomendada.
- Processo atual: prototipar e documentar uma tela existente por vez (`docs/ui-ux/10-prototipagem.md`); protótipos aprovados: Jornada, menu inicial e Nova Jornada; **Mundos pendente**.

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

⭐ Prototipar a tela de **Mundos** (2026-11-25, outra máquina) conforme `docs/ui-ux/13-mundos.md` e `10-prototipagem.md`: layout da lista, criação, exclusão explícita e a organização futura em abas de geração; depois ajustar a implementação provisória. Em seguida, prototipar **Jornadas** e **Modelos**. Em paralelo, do lado do responsável: testar a Nova Jornada com um modelo local real (qualidade dos botões do Narrador e o TipTap no app), e conferir o menu em 1024×768 e maximizado.
