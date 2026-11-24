# Handoff — estado atual do Henduran

Atualizado em 2026-11-23 após a tarefa `rodape-menu-modelo` (ajustes no menu inicial).

- Elaborado por: opencode

## Estado

- Tarefa: dois ajustes pequenos no menu inicial, sem nova tela e sem mudança de regra.
  1. O indicador do modelo no rodapé passou a espelhar o tratamento visual da versão à esquerda: LED + `Conectado · <detalhe> · Modelos ▸`, sem caixa, com o mesmo `aria-label` de antes (`Conectado, <detalhe>. Abrir Modelos`).
  2. O cartão "Última Jornada" deixou de aparecer quando a lista carregou sem Jornadas; o texto "Sua primeira Jornada" / "Ainda não há nenhuma Jornada..." foi removido. Os estados de serviço iniciando, carregando, erro e Jornada danificada continuam com painel.
- Decisões do responsável: indicador **sem caixa**, mantendo a palavra **Conectado**; cartão de primeira vez **não deve existir**; sincronizar `docs/ui-ux/11-menu-inicial.md` e `docs/ui-ux/prototipos/menu-inicial.html`.
- Artefatos alterados: `app/src/screens/MainMenu.tsx`, `app/src/screens/menu/MainMenu.css`, `app/src/screens/MainMenu.test.tsx`, `docs/ui-ux/11-menu-inicial.md`, `docs/ui-ux/prototipos/menu-inicial.html`, `docs/context/handoff.md`, `docs/context/jornal.md`.
- Validações: em worktree temporário limpo, com somente as mudanças desta tarefa, `npm run test -- src/screens/MainMenu.test.tsx` (15/15), `npm run test` (33 arquivos, 285/285) e `npm run typecheck` passaram. No worktree principal havia mudanças concorrentes da Nova Jornada (`App.tsx`, `newJourney/`, `api/`, `ui/`, backend), que quebram o typecheck e um teste de `model.ts`; elas **não** fazem parte deste commit.
- Não verificado: layout real do menu sem cartão em 1280×800, 1024×768 e telas estreitas; leitor de tela e DPI de 125% a 200% seguem pendentes.
- Branch: `fix/rodape-menu-modelo`, baseada em `main` (5c573f2). PR [#29](https://github.com/midrasil/henduran/pull/29) aberto contra `main`.

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

⭐ Revisar e fazer merge do PR destes ajustes do menu; em seguida continuar a **Nova Jornada** conforme `docs/ui-ux/12-nova-jornada.md`, o ADR-077 e o topo de `docs/backlog.md`. Em paralelo, conferir no app real o menu sem cartão e a Jornada com modelo local.
