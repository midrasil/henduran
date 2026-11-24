# Handoff — estado atual do Henduran

Atualizado em 2026-11-24 após a tarefa `rodape-modelos-status`.

- Elaborado por: opencode
- Branch: `feat/rodape-modelos-status`. A branch anterior `feat/tela-modelos` teve o PR [#42](https://github.com/midrasil/henduran/pull/42) mergeado; por isso esta entrega sai em branch nova.
- PR desta tarefa: [#44](https://github.com/midrasil/henduran/pull/44), aberto contra `main`.

## Estado

- Rodapé global do sistema (telas Nova Jornada, Modelos, Jornadas e Mundos): período do dia à esquerda e indicador `● Conectado · <detalhe> · Modelos ▸` à direita, reaproveitando o mesmo botão do menu inicial (`ServiceIndicator` compartilhado, LED, `aria-label` `<estado>, <detalhe>. Abrir Modelos`).
- O clique no indicador abre a tela **Modelos**. Quando a origem é a Nova Jornada, o cabeçalho mostra **Voltar à criação** e o assistente fica montado e oculto, preservando semente, campos e etapa.
- Correção de escopo: o rodapé de ações do assistente (`Cancelar`, status, `Voltar`, `Avançar/Iniciar Jornada`) e o quadro **Narrador** da tela Iniciar Jornada voltaram ao estado original. A primeira implementação havia mexido no lugar errado e foi revertida; o protótipo `nova-jornada.html` também voltou como estava.
- Arquivos principais: `app/src/App.tsx`, `app/src/styles/shell.css`, `app/src/navigation.ts`, `app/src/screens/ServiceIndicator.tsx`, `app/src/screens/ServiceIndicator.css`, `app/src/screens/MainMenu.tsx`, `app/src/screens/menu/MainMenu.css`, `app/src/App.test.tsx`, `app/src/navigation.test.ts`, `docs/ui-ux/12-nova-jornada.md`, `docs/context/handoff.md`, `docs/context/jornal.md`.
- Validações executadas pelo planejador em `app/`: `npm run typecheck` sem erros; `npm run test` 37 arquivos e 330 testes passando; `npm run build` ok.

## Pendências

- Conferir no app real (`npm run tauri dev`) se a troca aparece na barra inferior da Nova Jornada e se `Voltar à criação` preserva o preenchimento. jsdom não calcula layout.
- PR [#31](https://github.com/midrasil/henduran/pull/31) segue aberto e intacto; merge não foi autorizado nesta entrega.
- Grafo do Graphify pode estar desatualizado em relação a esta spec; não rodar `/graphify . --update` sem pedido explícito.

## Próximo passo recomendado

⭐ Testar a barra inferior no app real e revisar o PR desta tarefa. Depois, decidir o destino do PR #31 e se o grafo deve ser atualizado.
