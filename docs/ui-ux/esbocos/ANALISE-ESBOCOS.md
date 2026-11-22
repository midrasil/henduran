# Análise dos esboços visuais do MVP

**Data:** 2026-11-22
**Status:** referência visual **não normativa**. Os esboços foram fornecidos pelo responsável como base visual e **não refletem 100% a realidade do projeto**. Este documento diz o que aproveitar, o que fica fora do MVP e o que precisa de decisão.

## Arquivos

| Arquivo | Tela |
| --- | --- |
| `menu incial.png` | Menu inicial |
| `criando jornada.png` | Nova Jornada, passo 1 de 5 (escolha do Mundo) |
| `em jornada.png` | Jornada em andamento, dentro de uma Cena |

## 1. Leitura geral do visual

- Paleta de **roxo escuro** com **dourado** nas bordas e destaques e **pergaminho** claro nas áreas de leitura. Bordas ornamentadas com cantos decorados.
- **Texto em serifa legível**, e não em fonte pixel. Isso combina com o ADR-069 (fonte legível no texto longo; pixel só em títulos e HUD).
- Painéis com moldura dourada, botões em degraus de cor (roxo ativo, marrom escuro inativo), barras de recurso, retratos e ilustrações em pixel art.
- Sensação de jogo de RPG, que é o objetivo declarado. O esboço é um **ponto de chegada** visual, não o ponto de partida do MVP.

### O que o CSS do ADR-069 alcança e o que não alcança

- **Alcança:** painéis, botões, abas, barras, cartões de lista, paleta, bordas douradas, tipografia, layout de três colunas.
- **Não alcança sozinho:** cantos ornamentados, faixas e brasões, **ilustrações** de fundo, de cena e retratos. Isso exige assets desenhados ou gerados.
- Para o MVP, a proposta é usar **placeholders** (cor sólida ou gradiente simples e iniciais no lugar de retratos) e tratar os ornamentos e as ilustrações como trabalho posterior (ver seção 5).

## 2. Mapeamento tela por tela

### 2.1 Menu inicial

| Elemento | MVP | Observação |
| --- | --- | --- |
| Continuar Jornada | Sim | Com cartão "Última Jornada" (nome, personagem, local, data do save). |
| Nova Jornada | Sim | Abre o assistente. |
| Mundos | **A decidir** | Pode listar mundos gerados; sem "Comunidade". |
| Biblioteca | Fora | Depende de diário e exportação de livros. |
| Configurações | Sim | Inclui **gerenciar modelos**, que não aparece no esboço e é obrigatório no MVP. |
| Créditos | Sim | Simples. |
| Sair | Sim | |
| Ilustração de fundo | Fora (placeholder) | Ver seção 5. |

### 2.2 Nova Jornada (assistente de 5 passos)

Passos do esboço: **Mundo, Protagonista, Jornada, Configurações, Revisão.** O fluxo é compatível com o MVP.

- **Mundo:** abas "Meus Mundos, Oficiais, Comunidade, Importar". No MVP, só mundos gerados pelo gerador simples (equivalente a "Meus Mundos"). Oficiais, Comunidade e Importar ficam fora. "Criar Novo Mundo" corresponde ao gerador.
- **Etiquetas "Astra" nos mundos:** significam o sistema de regras. O MVP não usa regras mecânicas; a etiqueta fica fora até a adaptação do Astra ser aprovada.
- **Protagonista:** nome, descrição, histórico, Ambição e Desejo (sem atributos).
- **Jornada:** título e premissa. Conteúdo a definir.
- **Configurações:** escolha de modelo e opções do Narrador. A definir.

### 2.3 Jornada em andamento

Esboço: barra de abas superior, painel do personagem à esquerda, chat no centro, painel de contexto à direita, barra de status embaixo.

| Elemento | MVP | Observação |
| --- | --- | --- |
| Abas **Jornada** | Sim | |
| Aba **Ficha** | Sim, simplificada | Sem atributos. Nome, descrição, Ambição, Desejo. |
| Aba **Mundo** | Sim | Calendário, religiões, lugares, época e tom do gerador. |
| Aba **Diário** | Possível | Histórico de Cenas e fatos registrados. A definir. |
| Aba **Mapa** | Fora | Sem mapas no MVP. |
| Aba **Inventário** | Fora | Depende de economia e regras. |
| Painel esquerdo: retrato, nome | Sim | Retrato como placeholder. |
| PV, PM, Vigor, atributos, XP, nível, moeda, peso | **Fora** | Regras Astra adaptadas ainda não aprovadas (AGENTS.md). No lugar: Ambição e Desejo. |
| Cabeçalho "Jornada / Capítulo / Cena" | Sim | Cena ativa visível. |
| Falas de NPC com retrato e balão | Sim | Retrato como placeholder. |
| Bloco "Narrador" em itálico | Sim | Narração da Cena. |
| Lista "O que você faz?" (ações sugeridas) | Possível | Respostas rápidas sugeridas pelo Narrador **sem mecânica**. **[PROPOSTO]** |
| "Possível teste: Diplomacia (CAR) CD 12" | **Fora** | Testes dependem de regras aprovadas. |
| Botão de dados | **Fora** | Idem. |
| Campo de texto e "Enviar" | Sim | Com cancelar e regenerar. |
| Botão de lista (ao lado dos dados) | A definir | Provável alternância das ações sugeridas. |
| Painel direito: **Contexto da Cena** | Sim | |
| **Locais Próximos** (com tempo de viagem em minutos) | Parcial | Lista de lugares do mundo, **sem tempo de viagem** (exigiria regras de tempo e mapa). |
| **Objetivos da Jornada** (com marcação) | A decidir | Relacionar com Ambição e Desejo, sem criar mecânica nova. |
| **Anotações** | A decidir | Notas da Cena ou do jogador. |
| Barra de status: local, data, período do dia | Sim, parcial | Local e data vêm do calendário do mundo. Período do dia só se o mundo definir. |
| "Memória: 87%" | Possível | Indicador do uso de contexto, como no Caliope. |
| "Salvo há 2 min" | Sim | Persistência (ADR-050). |
| Ilustração da cena e minipaisagem lateral | Fora (placeholder) | Ver seção 5. |

## 3. Decisão: apresentação do Narrador Geral (opção C)

**Decidido pelo responsável (2026-11-22):** as duas formas, ou seja, **chat próprio recolhido no canto inferior direito** e **acesso por `@` a partir do chat da Cena.**

O esboço mostra só a Cena e o seu "Narrador". O Narrador Geral não aparece. Uma leitura coerente com o loop de gameplay, **[PROPOSTO]** para aprovação:

1. **Fora de Cena:** o chat central da aba Jornada **é** o chat do Narrador Geral, em tamanho cheio. Ali o jogador declara ações, tira dúvidas e decide para onde vai.
2. **Em Cena:** o chat central passa a ser o da Cena. O Narrador Geral continua disponível de duas formas:
   - **Painel recolhido** ancorado no canto inferior direito, sobre a barra de status, que expande como gaveta por cima do painel de contexto. Mostra uma etiqueta ("Narrador") e um aviso de resposta nova.
   - **`@Narrador`** no campo de texto da Cena, com autocompletar. A pergunta e a resposta aparecem no painel do Narrador Geral, **não** no histórico da Cena. Na Cena fica, no máximo, uma marca discreta de que o jogador consultou o Narrador.
3. **A consulta ao Narrador Geral durante a Cena não pausa a Cena nem altera o mundo por si só.** Ações com efeito continuam a passar pelo motor.
4. **Transições:** quando o Narrador Geral abre uma Cena, o chat central troca para a Cena e o chat Fora de Cena vai para o painel recolhido. Ao encerrar a Cena, o inverso.

Pontos que ainda pedem decisão:

- Se o `@` abre o painel recolhido ou responde em linha dentro da Cena.
- Se o painel recolhido guarda histórico próprio por Cena ou um histórico único Fora de Cena.
- Nome final do Narrador Geral.

## 4. Impactos em outros documentos

- `docs/ui-ux/03-mapa-de-telas.md` e `04-wireframes.md` foram escritos para a base Franuka e para o escopo completo do jogo. Devem ser reconciliados com estes esboços e com o `ESCOPO-MVP.md`.
- `docs/main/planejamento/ESCOPO-MVP.md` ganha as decisões desta análise.

## 5. Questões em aberto

1. **Origem das ilustrações** (fundo do menu, cenas, retratos, brasões). Opções: placeholders no MVP; arte gerada por IA, com decisão de licença e de consistência; arte encomendada. **Não decidido.**
2. **Ornamentos dos painéis** (cantos, faixas): CSS puro no MVP, ou molduras 9-slice próprias (opção 2 discutida ao decidir o ADR-069).
3. **Tokens de cor:** extrair a paleta a partir dos esboços (roxo escuro, dourado, pergaminho) na tarefa de tokens. Os valores exatos ainda não foram medidos.
