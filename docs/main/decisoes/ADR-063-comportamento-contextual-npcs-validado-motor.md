# ADR-063 — Comportamento contextual dos NPCs validado pelo motor

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Questão:** P-62
- **Origem:** Decisão explícita do responsável pelo Henduran

## Contexto

As ADR-060 a ADR-062 separam a verdade canônica do conhecimento e das crenças por personagem, registram aquisição validada e preservam informações contraditórias e sua proveniência. Faltava decidir como os NPCs agiriam em função dessas crenças sem dar ao Narrador autoridade irrestrita sobre o estado do jogo.

## Decisão aprovada

O **Narrador interpretará contextualmente** crenças, personalidade, objetivos e situação dos NPCs, podendo propor diálogos e ações de modo compatível com o conhecimento de cada entidade. O **motor validará conhecimento, permissões e consequências persistentes** antes de registrá-las ou aplicá-las.

- NPCs podem agir por engano, boatos, suspeitas ou crenças equivocadas, sem que isso torne a informação verdadeira no Mundo.
- Propostas que alterem o estado persistente — como inventário, recursos, relações, condições, posição, resultados mecânicos ou eventos — exigem operação validada pelo motor.
- O modelo não pode atribuir ao NPC informações que ele não conhece ou cuja revelação não é permitida.
- Falas e expressões narrativas sem efeitos persistentes não exigem aprovação mecânica individual.
- A decisão **não** estabelece uma matriz determinística de reações para cada crença; preserva a autonomia interpretativa do Narrador e a agência do jogador sobre seu protagonista.
- A execução permanece subordinada às regras de Astra adaptadas, às ferramentas autorizadas e à integridade canônica.

## Consequências

Ações narrativas e alterações mecânicas devem ter fronteira explícita; efeitos duráveis precisam ser submetidos ao motor. A implementação deverá permitir verificar conhecimento, contexto, condições e permissões antes de uma mudança persistente, com registro suficiente para inspeção ou correção pontual.

## Pendências explícitas

- Critérios para intensidade/confiança nas crenças, pesos de evidências e mudanças na opinião do NPC.
- Esquemas de personalidade, objetivos, motivação e comportamento, sem impor respostas rígidas.
- Permissões e verificações específicas por tipo de ação ou efeito persistente.
- Validações contra revelações indevidas e contra alterações canônicas pelo texto gerado.
- Procedimentos de auditoria, testes de coerência, explicabilidade e correção pelo jogador.
