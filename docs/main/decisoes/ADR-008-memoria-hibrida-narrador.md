# ADR-008 — Memória híbrida do Narrador e separação do estado oficial

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Questão:** P-10 do GDD
- **Origem:** Decisão explícita do responsável pelo Henduran

## Contexto

Uma Jornada do Henduran pode abranger muitas Cenas. Uma única janela de contexto de LLM não consegue preservar integralmente todo o histórico. O Narrador precisa recuperar acontecimentos relevantes sem confundir lembranças, resumos ou inferências com fatos e alterações oficialmente registrados.

## Decisão aprovada

O Narrador utilizará **memória híbrida composta por fatos estruturados, resumos narrativos e busca semântica**, mantendo o **estado oficial do jogo separado da memória recuperável**.

- **Estado oficial:** fonte de verdade sobre recursos, inventário, posições, condições, vínculos, acontecimentos e consequências efetivamente validados.
- **Fatos estruturados:** registros consultáveis sobre acontecimentos, personagens, lugares e relações; sujeitos à política de canonização e correção ainda pendente.
- **Resumos narrativos:** condensações de Cenas e outros trechos relevantes para prover contexto ao Narrador.
- **Busca semântica:** recupera memórias pertinentes ao contexto atual; o mecanismo técnico exato ainda será definido.

Nenhum resumo, resultado de busca ou texto gerado pela IA, isoladamente, altera o estado oficial. Efeitos mecânicos continuam condicionados às ferramentas validadas e às regras adaptadas do Astra.

## Consequências para a implementação

1. A memória e o estado oficial terão responsabilidades distintas, com interfaces claras.
2. Uma Cena poderá produzir eventos oficiais e um resumo, sem pressupor que todo detalhe do resumo seja automaticamente canônico.
3. O Narrador poderá consultar fatos anteriores sem receber necessariamente o histórico inteiro da Jornada.
4. A recuperação deve tolerar memórias ausentes, contraditórias ou desatualizadas sem sobrescrever o estado oficial.
5. Os testes de aceitação deverão demonstrar continuidade narrativa entre Cenas e respeito aos fatos oficiais.

## Exemplo de validação

O jogador poupa um bandido, e o acontecimento é registrado como fato validado. Muitas Cenas depois, quando esse NPC retorna, o Narrador recupera a informação e pode reagir de forma coerente. Uma memória imprecisa não deve transformar a decisão de poupar em uma morte oficial.

## Questões ainda não decididas

- **Política de retificação, desfazer, restaurar e versionar o estado oficial.**
- Regras de promoção de afirmações narrativas a fatos canônicos.
- Conhecimento individual e segredos de NPCs.
- Formato de armazenamento, modelo de indexação, embeddings e reindexação.
- Política de retenção, truncamento e limites de contexto por modelo.
- Quando e como gerar resumos e validar extrações de fatos.

## Relações

- ADR-004: Narrador autônomo com ferramentas validadas.
- ADR-007: persistência híbrida (estado atual + eventos relevantes).
- ADR-008 não concede novos poderes de mutação ao Narrador.
