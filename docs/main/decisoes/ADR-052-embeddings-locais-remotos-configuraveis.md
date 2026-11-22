# ADR-052 — Embeddings locais ou remotos configuráveis

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Questão:** P-51
- **Origem:** Decisão explícita do responsável pelo Henduran

## Contexto

A ADR-008 estabelece memória híbrida do Narrador, e a ADR-051 aprova recuperação por consultas canônicas no SQLite, busca textual FTS5 e embeddings auxiliares reconstruíveis. Era necessário decidir onde gerar esses embeddings, considerando custos, privacidade, hardware e alternativas offline.

## Decisão aprovada

O Henduran permitirá que o jogador configure a geração de embeddings por:

- **Modelo local**, executado no computador do jogador, sem necessidade de enviar o conteúdo indexado a um provedor externo.
- **API remota compatível**, configurada pelo jogador, sujeita a disponibilidade de conexão, condições de privacidade do provedor e custos aplicáveis.

O modelo de embeddings poderá ser independente do modelo de IA narradora.

Ao trocar de modelo ou provedor, o aplicativo deverá permitir **reconstruir os índices semânticos auxiliares** a partir dos dados canônicos persistidos, respeitando a eventual incompatibilidade entre espaços vetoriais e dimensões de embeddings. O SQLite continuará sendo a única fonte canônica dos fatos; a reindexação não deve modificar o histórico ou os estados da Jornada.

## Consequências e restrições

- A opção remota deve ser explícita e não pressupõe autorização permanente para transmitir conteúdo narrativo.
- Tokens e chaves de API não pertencem aos backups de Jornadas, conforme ADR-044.
- A ausência de embeddings utilizáveis não pode produzir alterações na verdade canônica.
- Esta decisão não seleciona um modelo específico, uma biblioteca vetorial ou um processo técnico de reconstrução.

## Pendências explícitas

- Modelos e provedores locais/remotos suportados.
- Requisitos de memória, CPU/GPU, instalação e distribuição do modelo local.
- Formato, dimensão e localização dos vetores e respectivos metadados.
- Política de reindexação ao alternar modelos, inclusive invalidação do índice antigo.
- Atualização incremental, bloqueios e concorrência durante indexação.
- Parâmetros de recuperação, ranking, autorização de acesso a memórias e política de indisponibilidade do índice.
