# ADR-005 — Mapas localizados apenas em situações táticas

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Referência:** P-06 do GDD
- **Decisão explícita do responsável:** Opção C — mapas localizados exclusivos de situações táticas.

## Contexto

O Henduran é um RPG solo centrado no chat com Narrador IA. Nem toda interação precisa representar espacialmente personagens e objetos. A exploração pelo mapa-múndi hexagonal ocorre Fora de Cena e é um subsistema independente.

## Decisão

1. **Cenas narrativas** (diálogo, comércio, investigação e interações semelhantes) funcionam pelo chat, **sem mapa localizado**.
2. **Mapas localizados** são reservados a **situações táticas**, não exclusivamente a combates. Uma perseguição ou infiltração pode exigir estrutura tática quando posição, distâncias ou turnos forem relevantes.
3. O **mapa-múndi hexagonal** continua sendo a interface de exploração **Fora de Cena**. Esta decisão não o elimina nem o converte em mapa de Cena.
4. O chat e o estado persistente de uma Cena continuam relevantes se ela passar a uma fase tática.
5. A apresentação do mapa localizado não deve ser acionada apenas porque a conversa menciona um lugar físico.

## Consequências

- Não criar mapas locais obrigatórios para visitas sociais ou estabelecimentos, como uma forja.
- Não exigir grade nem tokens para registrar presença, localização narrativa ou transações comerciais.
- Integrar o renderizador tático somente quando uma fase tática for efetivamente iniciada.
- O mapa tático, quando utilizado, deverá refletir estado espacial validado pelo motor de jogo, conforme projeto técnico futuro.

## Questões ainda pendentes

- Como o Narrador propõe e o motor reconhece o início de uma fase tática.
- Como se conserva a mesma Cena e o mesmo histórico de chat durante a alternância de modos.
- Como se gera, persiste e encerra o mapa tático.
- Quais critérios objetivos fazem uma perseguição/infiltração utilizar ou dispensar mapa.

Esta ADR resolve somente **P-06**, não a política de confirmação de testes **P-07**.
