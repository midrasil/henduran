# 01 — Visão do Produto

**Status:** definição inicial de produto  
**Escopo:** princípios funcionais, não uma especificação de implementação.

## 1. Identidade

Henduran é um RPG solo **AI-first** para desktop, centrado em uma Jornada contínua conduzida por um Narrador IA. O jogador interpreta um único personagem, decide livremente suas ações e explora um mundo persistente. O sistema de RPG utilizado é uma **adaptação própria do Astra**, com sua própria wiki de regras.

O Henduran é prioritariamente um **chatbot narrativo com funcionalidades de RPG**. Mapa-múndi hexagonal, mapas localizados, tokens em formato de moeda e combate em grid complementam a experiência quando relevantes.

## 2. Pilares da experiência

1. **Interpretação livre:** o jogador escreve o que pretende fazer ou dizer; o Narrador responde dentro da ficção quando há uma Cena ativa.
2. **Narrativa emergente:** situações resultam de decisões do jogador, personagens do mundo, consequências anteriores e geração procedural. Nem toda Cena é aleatória.
3. **Continuidade:** NPCs, lugares, compromissos, recursos, consequências e fatos estabelecidos persistem entre Cenas.
4. **Regras consistentes:** testes, rolagens, recursos, condições, equipamentos e combate são governados pelo motor, não por cálculos improvisados da IA.
5. **Narrador autônomo e supervisionável:** o Narrador cria e desenvolve situações, mas operações mecânicas e alterações oficiais passam por ferramentas com validação.
6. **Identidade visual:** interface desktop com assets pixel art adquiridos, sem dependência de um editor visual para o processo de desenvolvimento.

## 3. Jornada, Ambição e Desejo

A **Jornada** é a experiência contínua de um personagem no mundo. Ela não corresponde a uma sessão tradicional de RPG de mesa.

- **Ambição:** objetivo duradouro que orienta o arco maior do personagem.
- **Desejo:** objetivo atual do personagem, de horizonte mais próximo, podendo ou não contribuir diretamente para a Ambição.

Ambição e Desejo têm significado **narrativo e mecânico**. Seus gatilhos, benefícios, troca e conclusão serão adaptados às unidades de progressão do Henduran; não se presume equivalência entre uma Cena e uma sessão de mesa.

## 4. Fora de Cena e Em Cena

### Fora de Cena

Estado em que não existe uma Cena narrativa ativa. O jogador pode conversar diretamente com o Narrador sobre planos, esclarecer dúvidas, consultar informações, administrar o personagem e explorar o mapa-múndi. O mundo continua existindo; movimento e ações efetivas precisam ser processados pelo motor conforme sua natureza. **Fora de Cena não significa necessariamente mundo congelado.**

### Em Cena

Uma **Cena** é uma unidade narrativa contextualizada com chat próprio. Pode começar a partir de uma decisão do jogador (por exemplo, visitar um ferreiro), de uma iniciativa de NPC, de uma consequência anterior ou de um acontecimento procedural. Nela, o Narrador interpreta personagens, apresenta o ambiente e responde às ações do jogador.

Uma Cena pode conter diálogo, negociação, investigação, testes e/ou combate. **Combate não é pré-requisito**, nem toda Cena precisa de grid. Quando posição, ordem e tempo exigirem precisão, a Cena pode operar com uma **resolução tática**.

> Exemplo: o jogador entra na ferraria e conversa com o ferreiro. Uma Cena se inicia sem evento aleatório; comprar uma espada produz uma transação validada pelo motor e um fato persistente.

## 5. Papéis e autoridades

| Responsável | Responsabilidades |
| --- | --- |
| Jogador | Decisões voluntárias de seu personagem, interpretação, confirmação ou contestação de operações quando aplicável. |
| Narrador IA | Descrição, interpretação de NPCs, condução de situações e propostas de ações estruturadas. |
| Motor do Henduran | Estado oficial, regras, resultados mecânicos, validação, histórico de alterações e persistência. |

O Narrador não decide arbitrariamente pelo personagem do jogador. A IA não altera estado oficial apenas escrevendo uma frase no chat.

## 6. Plataforma e IA

Distribuição **exclusivamente desktop**. Deve admitir modelos de linguagem locais obtidos/gerenciados pelo aplicativo e serviços online opcionais mediante chave de API do usuário. A escolha de modelo/provedor não deve alterar a lógica das regras ou a estrutura da Jornada.

## 7. Não objetivos da fase inicial

- Suporte a navegador, mobile ou multiplayer.
- Implementação de **Competências** e **Capacidades** do Astra.
- Reproduzir literalmente o ciclo de sessões de RPG de mesa.
- Incorporar todo o código ou todas as mecânicas do Caliope.
- Desenvolver primeiro um motor gráfico completo em detrimento do chat.

## 8. Decisões fechadas e questões abertas

**Fechadas:** desktop; chat como centro; RPG Astra adaptado; wiki própria; Competências e Capacidades fora da versão inicial; Narrador IA; modelos locais e online; mapa hexagonal; combate tático em grid; UI pixel art; desenvolvimento principalmente por agentes.

**Em aberto:** tecnologia final da aplicação; formatos detalhados de persistência; unidades e gatilhos adaptados de Ambição/Desejo; memória narrativa; geração do mundo; contratos completos de ferramentas; políticas de evolução e frequência de XP; detalhes da interface; integração/redistribuição dos componentes Caliope.
