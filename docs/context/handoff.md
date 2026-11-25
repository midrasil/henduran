# Handoff — estado atual do Henduran

Atualizado em 2026-11-24 após a tarefa `dois-handoffs`. Este é o handoff do **desenvolvedor principal** (Claude: planejamento, protótipos, ADRs e rodadas com o dev). Os ajustes e tarefas menores do opencode ficam em [`handoff-opencode.md`](handoff-opencode.md); cada um escreve só no seu e lê os dois ao retomar.

## Estado

- **Telas com protótipo aprovado e já implementadas:** menu inicial, Nova Jornada (TipTap, Narrador que preenche dados, Mundo personalizado, Editar Jornada), Mundos, **Modelos rodada 1** (cabeçalho, abas Modelos, Procurar neste PC e Downloads; PR #42) e o **rodapé global** com o indicador `● Conectado · … · Modelos ▸` (PR #44).
- **Protótipos aprovados, ainda não implementados:** tela da Jornada com **Estado da Cena e dúvida de continuidade** (item 2.8 do `09`), **Diário e ficha do NPC** (2.9), **formatação do texto do chat** (2.10: fala com travessão de abertura e fechamento, ação em itálico, sem pensamento; menu `/` no campo de escrita; botão **Melhorar texto**), **Pontos de retorno** (2.11 e `15-jornadas.md`: salvamentos manuais até 20 e automáticos 5, no menu de opções) e a tela **Jornadas** redesenhada (detalhe só com pontos de retorno, vazio em tela cheia). Protótipos em `docs/ui-ux/prototipos/`.
- **ADRs desta frente:** ADR-078 (memória e continuidade; parcialmente confirmada: faltam compactação a ~70% e fichas de NPC), **ADR-079** (idioma interno dos prompts, aprovada com medição obrigatória). **Skills por Cena** (item 7 do ADR-078): até 3, texto completo das ativas, modo padrão automático, troca de no máximo uma a cada 6 turnos ou quando o Quadro mudar no essencial, fixar skill entre Cenas; filtro +18 sem padrão; todas as skills do acervo entram; importação por comando, link ou `dono/repositório` **sem `npx`**.
- **Modelos, rodada 1 (PR #42):** diferenças do protótipo e conflito de fontes em `14-modelos.md`, seção 9 (sugestões abrem "Buscar este modelo" e não informam licença; Adicionar pasta pede o caminho colado; a lista do Caliope x `auditoria-caliope.md`).
- Validações mais recentes (planejador): `npm run typecheck` limpo; frontend 330 testes passando (37 arquivos); backend 701 passando e 1 pulado.
- PRs recentes mergeados: #25 a #46. O mais recente do opencode (#46, ficha expandida da personagem com as abas Visão geral, Convicções e Descrição) está em `handoff-opencode.md`.

## Pendências

- Aprovado e não feito: **seletor nativo de pasta** do Windows na tela Modelos (`tauri-plugin-dialog` e `dialog:allow-open`).
- Em aberto: **refazer a lista de sugestões de modelos** para o Henduran; **licenças** das skills (pendência de lançamento; só 81 de 520 declaram licença); ficha de regras do NPC (fatia 3 do Astra) e como se descobrem os stats; esquema de dados do Diário; **armazenamento dos pontos de retorno** (cópia do `journey.db` ou diferença); o Mundo não volta com um ponto (a definir o que fazer se ele mudou).
- **Medir** o custo em tokens dos prompts em inglês e em português e criar o teste de idioma (ADR-079).
- Não verificado nunca: app Tauri real em várias telas, leitor de tela, DPI de 125% a 200%.

## Decisões vigentes

- **Stack (ADR-001):** Tauri, React + TypeScript, PixiJS, Python, só Windows na fase inicial. Não iniciar scaffolding ou prova de conceito sem instrução explícita.
- **UI:** pixel art em CSS com tokens próprios (ADR-069), resolução/acessibilidade em ADR-068, ambiente de dia/noite em `docs/ui-ux/07-ambiente-dia-noite.md`. Telas novas ou redesenhos grandes exigem protótipo navegável aprovado (`docs/ui-ux/10-prototipagem.md`); ajustes pequenos podem ir direto ao código.
- **IA local:** llama.cpp/`llama-server` + GGUF, local primeiro e API paga depois (ADR-070 a 072), interface `NarratorProvider` e HTTP local com SSE.
- **Armazenamento (ADR-075):** banco do app, `journeys\<id>\journey.db`, `worlds\<id>\world.db` anexado em leitura; nunca recriar banco de Jornada em silêncio.
- **Regras:** MVP em `docs/main/planejamento/ESCOPO-MVP.md`; Cena inicial e ciclo de Cena em ADR-076; Dia do Mundo em ADR-073; editor da Nova Jornada em ADR-077 (História em HTML saneado, descrição da Jornada, Narrador que preenche dados).
- **Idioma do prompt (ADR-079):** instruções internas e skills em inglês, resposta em português, sem tradução; medir tokens e testar o idioma antes de fixar.
- **Skills (ADR-078, item 7):** por Cena, até 3, automático por padrão e manual; troca de no máximo uma a cada 6 turnos; fixar entre Cenas; nunca executar scripts.
- **Caliope:** uso autorizado pelo autor; não copiar código sem conferir licença e fronteiras. Registro em `docs/main/importacoes-caliope.md`.

## Código existente

- `app/src/`: navegação em `navigation.ts`; telas em `screens/`; cliente de API em `api/`; componentes base em `ui/` e estilos em `styles/`. O menu usa `MainMenu.tsx` + `screens/menu/MainMenu.css`; o indicador reusa os mesmos tokens das outras telas.
- `backend/henduran/`: providers, runtime local, migrações por conjunto, storage, regras da fatia 1, worldgen, serviços de criação e API SSE. Rodar com `HENDURAN_PROVIDER=fake|local`.
- Comandos: `cd app; npm run tauri dev`; testes `npm run test` e `backend\.venv\Scripts\python -m pytest`; checagem `npm run typecheck`.
- As mensagens da Jornada usam `.msgs`/`.msg` em `app/src/screens/journey/JourneyScreen.css`, com largura total da coluna desde o PR #25.

## Pendências relevantes

- Conferir visualmente o menu sem cartão e o rodapé no app real (1280×800, 1024×768, estreito), com modelo carregado, sem modelo e serviço iniciando.
- Conferir visualmente a Jornada com modelo local real: largura das mensagens, abertura/encerramento de Cena e marcação `[[propor_cena]]`.
- TipTap e a Nova Jornada já estão no app (PRs #30 a #33); falta conferir o TipTap em navegador real (digitar, atalhos, colar do Word).
- Tela Modelos (rodada 1, PR #42) e rodapé com o indicador de modelos (PR #44): conferir no app real, com modelo `.gguf` real, o `-ngl` numérico e a estimativa de memória.
- Restaurar backup no app real, leitor de tela, DPI de 125% a 200%, reflow a 320 px.
- Backups da Jornada não incluem `assets\`; limites de Fraturas e estado das trilhas não vêm do backend.
- ARO/ADR em aberto: formato da proposta de encerramento no chat, Cena seguida de outra sem passar pelo Aduran, passagem de tempo em períodos, retenção de backups e anexos em ADR-075.
- Gerador de mundo: reduzir repetição de raízes de nomes e de descrições.
- Excluir `app/src-tauri/target/` e `node_modules/` da sincronização do OneDrive.
- Backlog autoritativo: `docs/backlog.md`.

## Próximo passo recomendado

⭐ (1) **Rodada 2 da tela Modelos** (aba Skills, `14-modelos.md` seção 4 e ADR-078 item 7) com o dev; (2) **seletor nativo de pasta**; (3) depois, em rodadas com o dev, **Estado da Cena, Diário, pontos de retorno e o chat da Jornada** (menu `/`, Melhorar texto com rota própria no backend, travessão da fala); (4) ler e adaptar as fatias 2 e 3 do Astra; (5) decidir a lista de sugestões de modelos.
