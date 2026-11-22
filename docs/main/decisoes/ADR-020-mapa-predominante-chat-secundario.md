# ADR-020 — Mapa predominante e chat secundário em situações táticas

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Questão:** P-13 do GDD
- **Origem:** Decisão explícita do responsável pelo Henduran (opção C)

## Contexto

O Henduran é centrado na narrativa via chat, mas situações táticas exigem leitura de posições, distâncias, terreno e tokens. A interface precisa apoiar a execução mecânica sem perder a continuidade do Narrador IA.

## Decisão

Durante **situações táticas**, o **mapa localizado será predominante**, enquanto o **chat será secundário**, mantendo-se disponível para acompanhar a narração e os resultados das ações. O chat não é substituído pelo mapa.

A decisão respeita a ADR-005: **mapas localizados só são usados em situações táticas**. Em Cenas exclusivamente narrativas, o chat mantém a prioridade. O mapa-múndi hexagonal utilizado Fora de Cena continua independente.

## Consequências

- A interface tática reservará maior relevância visual para mapa, tokens, terreno e interações espaciais.
- O chat permanece acessível para comunicações com o Narrador e relato de resultados.
- A transição entre fase narrativa e fase tática deve preservar histórico, estado da Cena e alterações oficiais.
- O motor Astra adaptado continua responsável pela resolução mecânica; a distribuição visual não muda a autoridade dos sistemas.
- A biblioteca pixel art da ADR-017 deverá contemplar componentes do painel do mapa e do chat secundário.

## Fora do escopo desta decisão

- Proporções numéricas dos painéis, posição fixa do chat ou requisitos de resolução.
- Controles de expansão/recolhimento, layout responsivo e fluxo de foco.
- Comandos de ataque, movimentação e respostas do combate: dependem da especificação tática.

## Critérios de verificação

1. Ao entrar em situação tática, o mapa se torna visualmente predominante sem ocultar definitivamente o chat.
2. Mensagens e resultados narrativos continuam consultáveis.
3. Ao sair da situação tática, retorna-se à interface narrativa com histórico e estado preservados.
4. O mapa-múndi de exploração não se confunde com o mapa localizado.

## Relações

- ADR-005 — Mapas localizados somente em situações táticas.
- ADR-017 — Biblioteca reutilizável de UI pixel art.
- ADR-019 — Hexágonos regionais no mapa-múndi.
