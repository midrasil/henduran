# Handoff do opencode — estado atual dos ajustes e tarefas menores

Atualizado em 2026-11-27. Branch: `feat/biblioteca-jornadas`, publicada anteriormente sem PR. O ajuste dos cartões está local, aguardando autorização para entrega.

## Estado

- Biblioteca redesenhada com a API existente: busca, cartões, painel de detalhes e atalhos para continuar, criar, restaurar ou excluir. A coluna esquerda não tem mais contador nem seletores de status.
- Ajustes de revisão: tela usa toda a área útil, estado vazio tem fundo opaco e um só botão, a busca não rola com os cartões, e o painel de detalhes tem fundo opaco e rolagem no conteúdo.
- Cartões compactos exibem nome, retrato, etiquetas e tempo desde o salvamento. A busca abrange nome da Jornada, personagem e Mundo, mas não lugar.
- A tela não tem cabeçalho visível. **Voltar ao menu** fica à direita de **Nova Jornada**, inclusive no convite central quando a biblioteca está vazia.
- As ações **Continuar Jornada** (ou **Restaurar…**) e **Excluir Jornada** ficam no rodapé direito do painel de detalhes.
- Artefatos principais: `app/src/screens/JourneysScreen.tsx`, `JourneysScreen.css`, `JourneysScreen.test.tsx` e `docs/ui-ux/15-jornadas.md`.

## Validações e pendências

- No ajuste do rodapé, `npm run typecheck` e os 13 testes de Jornadas passaram. A suíte completa com 333 testes foi executada na entrega anterior, antes dos ajustes finais.
- Pontos de retorno seguem pendentes no backlog. A tela exibe aviso de indisponibilidade.
- ⭐ Próximo passo: conferir contraste, filtros e rolagem no Tauri em janela larga e estreita.
