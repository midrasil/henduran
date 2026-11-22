# ADR-051 — Recuperação de memória híbrida: SQLite, FTS5 e embeddings reconstruíveis

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Questão:** P-50
- **Origem:** Aprovação explícita do responsável pelo Henduran

## Contexto

A ADR-008 aprovou memória híbrida do Narrador com estado oficial, fatos estruturados, resumos e recuperação semântica. A ADR-050 definiu SQLite como banco de dados local principal. Era necessário escolher como combinar a busca textual e a recuperação por significado sem criar fontes de verdade conflitantes.

## Decisão aprovada

O Henduran utilizará **busca híbrida** na recuperação de contexto do Narrador:

- **SQLite:** fonte oficial persistente para fatos canônicos, estado, relações, eventos e referências.
- **FTS5:** pesquisa textual e por termos, combinável com filtros estruturados e escopo da continuidade ativa.
- **Embeddings semânticos:** índice auxiliar para recuperar lembranças relevantes por significado, inclusive quando o texto consultado emprega palavras diferentes.
- **Reconstruibilidade:** embeddings e estruturas auxiliares poderão ser gerados novamente a partir de dados persistidos canônicos, sem serem tratados como fonte de verdade.
- **Separação de responsabilidades:** a recuperação de memória apenas fornece contexto para a narração; não altera valores, estados ou eventos sem autorização e validação do motor.

## Consequências e garantias

A inconsistência ou ausência de vetores não altera o estado canônico. Deve ser possível reconstruir os índices a partir de seus dados de origem; o comportamento de consulta durante essa reconstrução ainda será especificado. A recuperação deverá respeitar o Mundo e a continuidade escolhidos e a política de acesso a conhecimentos e segredos que vier a ser estabelecida. A solução não implica adotar um banco vetorial separado.

## Pendências explícitas

- Modelo e provedor de embeddings, custos e disponibilidade local/remota.
- Armazenamento físico dos vetores e eventual extensão SQLite ou biblioteca de busca vetorial.
- Critérios para segmentação de textos, indexação incremental, invalidação e reconstrução.
- Filtros de acesso a segredos, origem de fatos, versões e continuidade ativa.
- Combinação de resultados de FTS5, consultas estruturadas e busca semântica; ranking, parâmetros e limites de contexto.
- Procedimentos de atualização de índices diante de restores, importações, exclusão e arquivamento de ramificações.
