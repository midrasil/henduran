# Wiki de regras — Henduran

Esta pasta é a **fonte de verdade textual das regras utilizadas no Henduran**. As regras partem do sistema [Astra](https://github.com/midrasil/astra-rules), mas passam por adaptações específicas para o RPG solo contínuo conduzido por IA.

**Status:** fatia 1 **aprovada** em 2026-11-22. Versão das regras: `fatia-1`. As fatias 2 e 3 ainda não estão aqui.

## Diretrizes

- Publicar somente regras adaptadas, revisadas e aprovadas para o Henduran.
- Não implementar **Competências e Capacidades**.
- Adaptar referências a sessões de RPG de mesa sem transformar cada Cena em sessão (ADR-010 e ADR-073).
- Deixar claro quando uma regra é interpretativa e quando deve ser executada pelo motor.
- Manter a origem de cada regra e o registro das diferenças da adaptação.
- Garantir correspondência entre a wiki, o motor de regras e seus testes. A versão das regras aplicada a um salvamento deve ser identificável.

Leia também [Adaptação do Astra](../docs/main/03-adaptacao-astra.md).

## Convenções dos textos

- **[ASTRA]**: regra de origem, mantida.
- **[ADAPTAÇÃO]**: mudança para o Henduran, com a decisão que a sustenta.
- **[FATIAS 2 E 3]**: regra de origem que só vale depois da fatia 1.
- **[PENDENTE]**: ponto sem decisão; não implementar.

Os textos são reescritas curtas das regras do Astra (commit `1c51aea`), e não cópias; os números seguem a fonte.

## Fatia 1

| Arquivo | Tema |
| --- | --- |
| [01-mecanica-basica.md](01-mecanica-basica.md) | Reserva de Dados, Sucessos, Dificuldade, testes opostos |
| [02-atributos.md](02-atributos.md) | Os seis Atributos |
| [03-pericias.md](03-pericias.md) | As 22 Perícias do mundo medieval |
| [04-vida.md](04-vida.md) | Trilha de Vida (sem dano nesta fatia) |
| [05-vontade.md](05-vontade.md) | Trilha de Vontade e uso de Vontade |
| [06-conviccoes-e-pilares.md](06-conviccoes-e-pilares.md) | Convicções, Pilares e Fraturas |
| [07-ambicao-e-desejo.md](07-ambicao-e-desejo.md) | Ambição e Desejo |
| [08-dia-do-mundo-e-descanso.md](08-dia-do-mundo-e-descanso.md) | Dia do Mundo e Descanso Prolongado |
| [09-criacao-de-personagem.md](09-criacao-de-personagem.md) | Passos da criação |

## Decisões que sustentam a fatia 1

| Decisão | Origem |
| --- | --- |
| Competências e Capacidades fora | `AGENTS.md`, `docs/main/03-adaptacao-astra.md` |
| Sem unidade universal no lugar da sessão; gatilho por acontecimento validado | ADR-010, ADR-012, ADR-013 |
| Dia do Mundo como limitador, começando no Amanhecer; troca livre de Ambição e Desejo | ADR-073 |
| Teste fora de combate: o Narrador propõe, o jogador confirma, o motor rola | ADR-006 |
| Rerrolagem gratuita por Convicção excluída | ADR-013 |
| 22 Perícias, sem Conhecimento Específico; foco em fantasia medieval | decisão do responsável, 2026-11-22 |
| Fatia 1 sem dano de Vida, Tratamento e Condições | decisão do responsável, 2026-11-22 |
| Descanso Prolongado na fatia 1 | decisão do responsável, 2026-11-22 |
| Interpretações (Fratura, progresso de Ambição): o Narrador propõe, o motor registra, o jogador pode contestar | decisão do responsável, 2026-11-22; ADR-012 |

## Princípio geral de aplicação

Onde o Astra diz que "o Narrador decide", o Henduran entende: **o Narrador (IA) propõe, o motor valida e registra, e o jogador pode contestar**. A IA nunca rola dados, nunca marca dano e nunca concede recurso por conta própria (ADR-004).
