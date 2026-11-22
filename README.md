# Henduran

**Henduran** é um RPG solo procedural, centrado em um **Narrador com inteligência artificial**. O jogador vive uma Jornada contínua em um mundo persistente, interpretando livremente seu personagem por meio de chat. A narrativa é sustentada por uma adaptação própria do sistema de RPG **Astra**, com exploração em mapa hexagonal, Cenas contextualizadas e combate tático em grid quando necessário.

A Jornada é orientada pela **Ambição** (objetivo de longo prazo) e pelo **Desejo** (objetivo atual) do personagem. As escolhas do jogador e suas consequências devem permanecer coerentes ao longo da história.

## Diretrizes

- **Chat e narrativa em primeiro lugar.** Mapas, grid e geração procedural apoiam a experiência; não a substituem.
- **Liberdade de ação.** O jogador declara intenções em linguagem natural; opções sugeridas nunca são obrigatórias.
- **Narrador IA com autonomia criativa.** Interpreta NPCs, apresenta e desenvolve acontecimentos; usa ferramentas controladas para interagir com o mundo.
- **Regras verificáveis.** O motor do jogo resolve resultados mecânicos e preserva o estado oficial; a IA não inventa resultados de dados ou alterações persistentes.
- **Desktop.** Modelos locais instaláveis no aplicativo e modelos online opcionais por chave de API.
- **Sistema próprio.** As regras do Henduran são adaptadas do Astra, não necessariamente idênticas às regras de mesa.

## Estado atual

Projeto em fase de fundação. Esta documentação registra o escopo e as decisões de produto; não indica que as funcionalidades já estejam implementadas.

## Documentação

- [Visão do produto](docs/01-visao-do-produto.md)
- [Loop de gameplay](docs/02-loop-de-gameplay.md)
- [Adaptação das regras Astra](docs/03-adaptacao-astra.md)
- [Arquitetura proposta](docs/04-arquitetura.md)
- [Narrador IA](docs/05-narrador-ia.md)
- [Plano inicial de desenvolvimento](docs/06-plano-inicial.md)
- [Wiki de regras do Henduran](rules/README.md)
- [Orientações para agentes de programação](AGENTS.md)

## Referências

- [Astra — regras originais](https://github.com/midrasil/astra-rules)
- [Caliope — referência para infraestrutura de chat e LLM](https://github.com/CODED-Xavier/Caliope)

**Nota sobre assets e licenças:** o pacote comercial de interface pixel art é um recurso adquirido separadamente. Verificar os direitos de redistribuição antes de publicar seus arquivos em um repositório público. A reutilização de código do Caliope também depende de autorização/licença aplicável.
