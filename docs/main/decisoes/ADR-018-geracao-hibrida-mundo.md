# ADR-018 — Geração híbrida e persistente do mundo

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Questão do GDD:** P-11
- **Origem:** Escolha explícita da opção C pelo responsável pelo Henduran

## Contexto

A Jornada do Henduran acontece em um mundo procedural persistente, explorado pelo mapa-múndi hexagonal. A geração completa antecipada teria custo e rigidez; a geração inteiramente sob demanda precisaria de mecanismos robustos para preservar coerência geográfica e fatos estabelecidos.

## Decisão

Adotar **geração híbrida do mundo**: cada Jornada terá uma **estrutura geográfica inicial** e o sistema realizará **detalhamento e/ou expansão procedural conforme necessário**. Locais descobertos, NPCs, acontecimentos e alterações estabelecidas tornam-se persistentes.

Esta decisão define a **estratégia geral**, não o tamanho do mundo ou a implementação específica do gerador.

## Consequências

1. O mundo tem identidade espacial própria, independente do texto do chat ou de uma Cena isolada.
2. Exploração e geração respeitam os fatos, locais e mudanças já registrados no estado oficial da Jornada.
3. Regiões e locais estabelecidos mantêm sua identidade ao serem revisitados; a geração não substitui automaticamente dados anteriores.
4. O Narrador IA poderá contribuir com conteúdo, mas o estabelecimento de fatos oficiais deverá passar por ferramentas validadas (ADR-004).
5. Eventos relevantes e estado atualizado serão persistidos (ADR-007); memórias narrativas não substituem dados oficiais (ADR-008).
6. A geração procedural pode produzir conteúdo sem exigir uma chamada ao LLM para cada hexágono. Essa separação é uma **recomendação técnica**, não uma estratégia algorítmica aprovada.

## Critérios de aceite propostos

- Uma localização descoberta mantém identidade, posição e fatos oficiais após fechar e reabrir a Jornada.
- Retornar a um local não gera uma versão incompatível dele.
- Uma alteração no mundo validada pelo motor persiste após transições entre Cenas e viagens.
- Gerar novas áreas não altera retroativamente o conteúdo já estabelecido.
- Restauração de salvamento anterior é coerente com o estado e o histórico escolhidos (ADR-009).

## Em aberto

- **P-12:** escala de hexágonos, orientação, custos de deslocamento, rotas e visibilidade.
- **P-15:** cenário, lore e conteúdo canônico inicial versus procedural.
- Forma, extensão e limites da estrutura macro geográfica.
- Sementes de geração, algoritmos e reprodução determinística.
- Distribuição de regiões, assentamentos, NPCs, encontros e biomas.
- Quando canonizar detalhes improvisados e como conciliar propostas divergentes.

## Relações

ADR-004 (Narrador), ADR-005 (mapas táticos e mapa-múndi), ADR-007 (persistência), ADR-008 (memória) e ADR-009 (restauração).
