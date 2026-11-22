# ADR-001 — Stack desktop e plataforma inicial

- **Status:** APROVADO
- **Data:** 22 de novembro de 2026
- **Projeto:** Henduran
- **Referências:** GDD v0.2, pendências P-01 e P-16

## Contexto

O Henduran é um RPG solo procedural centrado em chat com Narrador IA. O aplicativo terá interface pixel art produzida a partir de assets próprios/licenciados, mapa hexagonal e visualização tática em grid. O desenvolvimento será conduzido com Codex e Claude Code. É necessário suportar modelos de linguagem locais e provedores online.

## Decisão aprovada

1. **Tauri:** contêiner e distribuição do aplicativo desktop.
2. **React + TypeScript:** UI, incluindo chat, menus, ficha, inventário e wiki interna.
3. **PixiJS:** renderização dos mapas hexagonais, grid, tokens e demais cenas gráficas 2D necessárias.
4. **Python:** serviços de IA, incluindo integração com modelos locais e provedores online.
5. **Windows é a única plataforma-alvo inicial.** Linux e macOS não compõem o compromisso da primeira versão.

## Limites da decisão

Esta aprovação **não** determina a linguagem/implementação do motor de regras Astra, o protocolo entre frontend e Python, a escolha de banco de dados, bibliotecas de gerenciamento de modelos, mecanismo final de empacotamento do serviço Python, suporte mínimo de hardware ou sistema de atualização. Esses pontos deverão ser especificados e testados separadamente.

O motor de regras deverá permanecer independente da apresentação, e o backend de IA não deverá alterar o estado mecânico sem passar por operações controladas. Essas separações são princípios do produto, não uma escolha implícita de biblioteca.

## Alternativas consideradas

- **Godot 4 + C#:** alternativa viável, não selecionada nesta fase.
- **MonoGame + C#:** alternativa viável, não selecionada nesta fase.

Não foram declaradas inviáveis nem proibidas para sempre; a stack aprovada é a referência até nova decisão formal.

## Consequências e validação

- Positivo: ferramentas maduras para interface textual, automação de testes e integração com infraestrutura Python.
- Risco: coordenar runtimes, instalar e iniciar serviço Python e modelos locais em um aplicativo Windows distribuível.
- **Aceite técnico inicial:** demonstrar aplicativo Tauri inicializando no Windows, UI React com sprites pixel art, chat com streaming via serviço Python, encerramento limpo e operação instalável sem ambiente Python de desenvolvimento.
- **Segurança:** o serviço local deve limitar sua exposição de rede; credenciais de APIs devem ser tratadas como segredos e nunca registradas em logs.
- **Assets:** não publicar o pacote comercial no repositório público sem licença que autorize redistribuição.

## Origem da aprovação

Decisão explícita do autor na conversa de planejamento: “Aprovo para o Henduran a seguinte decisão arquitetural: Tauri + React + TypeScript + PixiJS + Python. Plataformas iniciais: somente Windows.”
