# 07 — Ambiente procedural: ciclo de dia e noite

**Data:** 2026-11-22
**Status:** direção **decidida** pelo responsável; detalhes marcados **[PROPOSTO]** aguardam aprovação. Substitui, no MVP, as ilustrações dos esboços (fundo do menu, cena, paisagens) por um ambiente desenhado em código.

## 1. Ideia

Em vez de imagens prontas, a interface mostra um **céu desenhado em código** que representa o período do dia do mundo da Jornada, cada período com o seu astro. O jogo "fica" no estado atual da última Jornada jogada: ao abrir o app, o menu mostra o céu daquele momento.

## 2. Períodos e astros **[PROPOSTO]**

| Período | Astro | Céu |
| --- | --- | --- |
| Madrugada | Lua baixa, estrelas esmaecendo | Azul muito escuro |
| Amanhecer | Sol rente ao horizonte | Rosa e laranja |
| Manhã | Sol alto, à esquerda | Azul claro |
| Tarde | Sol alto, à direita | Azul quente |
| Entardecer | Sol baixo e grande | Laranja e roxo (próximo ao menu do esboço) |
| Noite | Lua e estrelas | Azul escuro e roxo |

Seis períodos são uma proposta de partida; podem ser reduzidos a quatro (manhã, tarde, entardecer, noite) se o jogo não precisar da distinção.

## 3. De onde vem o horário

- O período do dia é **estado do mundo**, guardado na Jornada junto com a data do calendário gerado. **Não usa o relógio real** do computador.
- **[PROPOSTO]** O Narrador **propõe** que o tempo avance (por exemplo, "a tarde passou") e o **motor valida e registra**, sem tempo numérico em minutos. Isso evita criar regras de tempo que o projeto ainda não aprovou (`02-loop-de-gameplay.md`, seção 7).
- **[PROPOSTO]** Candidato inspirado no Caliope: um comando do jogador para deixar o tempo passar ("esperar até a manhã"), de modo que o tempo só avance quando o jogador escolhe ou quando a narrativa justifica.
- Sem Jornada salva, o menu usa um período padrão (**[PROPOSTO]**: entardecer).

## 4. Onde aparece

- **Menu inicial:** céu de fundo no período da última Jornada.
- **Tela da Jornada:** faixa ou fundo de ambiente, e ícone de sol ou lua na barra de status, junto da data.
- **Nova Jornada:** fundo neutro; o ambiente pode refletir o mundo escolhido depois.

## 5. Desenho em código **[PROPOSTO]**

- Um componente isolado (por exemplo, `SkyBackdrop`) que recebe o período como parâmetro e desenha o céu em degradê, o astro em pixel art desenhado por código (sem arquivo de imagem), estrelas e, opcionalmente, nuvens e uma silhueta simples de relevo e árvores.
- Implementar primeiro com DOM, CSS e um pequeno canvas com `image-rendering: pixelated`. O PixiJS fica reservado aos mapas (ADR-001); só entra aqui se o desempenho exigir.
- Pixels inteiros, sem blur, coerente com o ADR-069.

## 6. Acessibilidade e legibilidade (ADR-068)

- **Reduced motion:** com a preferência ativa, a troca de período é imediata e o ambiente fica estático.
- **Contraste:** o texto nunca fica diretamente sobre o céu. O chat e os painéis têm fundo sólido.
- **Equivalente em texto:** o período e a data aparecem em texto na barra de status, e não só como imagem.
- O movimento é lento e discreto; nada pisca.

## 7. Fora do MVP

- Clima (chuva, neblina), fases da lua ligadas ao calendário do mundo, mais de uma lua, estações visuais, sons ambiente.
- Ilustrações de cena e retratos desenhados: no MVP, retratos usam iniciais e as cenas usam o ambiente procedural. A origem de arte desenhada fica para depois.

## 8. Em aberto

- Número final de períodos e a paleta de cada um (extrair dos esboços na tarefa de tokens).
- Se o ambiente também cobre a tela da Jornada em volta do chat ou só uma faixa.
- Como o jogador deixa o tempo passar (comando, botão ou só pela narrativa).
