# ADR-053 — Continuidade da Jornada sem embeddings disponíveis

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Questão:** P-52
- **Origem:** Aprovação explícita do responsável pelo Henduran

## Contexto

A memória híbrida do Narrador utiliza o SQLite como fonte canônica, busca textual FTS5 e embeddings semânticos auxiliares reconstruíveis (ADR-008, ADR-050, ADR-051). A geração dos embeddings pode ocorrer localmente ou por API remota (ADR-052). É possível que o índice semântico esteja indisponível, incompatível com o modelo atual, corrompido ou em reconstrução.

## Decisão aprovada

O Henduran **não suspenderá a Jornada** por indisponibilidade ou reindexação dos embeddings.

- O Narrador continuará consultando **fatos estruturados e canônicos no SQLite**, filtros de contexto autorizados e **busca textual FTS5**.
- O aplicativo **informará ao jogador** que a recuperação semântica está temporariamente limitada; o Narrador não deverá pressupor recuperação completa de lembranças.
- Os embeddings serão reabilitados quando o índice voltar a ficar **disponível e validado**.
- A degradação do mecanismo auxiliar não poderá criar fatos, autorizar ações mecânicas, sobrescrever o estado canônico nem mesclar memórias de continuidades independentes.
- A decisão não autoriza presumir que toda operação de reindexação será em segundo plano ou que o provedor remoto estará disponível.

## Consequências

A camada de recuperação deverá oferecer uma modalidade funcional sem semântica vetorial e distinguir visivelmente seu estado operacional, preservando filtros de Mundo, Jornada e ramificação. Um eventual resultado incompleto deve ser tratado como limite de recuperação, não como ausência comprovada de acontecimentos.

## Pendências explícitas

- Implementação e agendamento da indexação/reindexação.
- Gatilhos e estratégia de atualização do índice após alterações canônicas.
- Reintentos, detecção de falhas, consistência de indexação e concorrência.
- Modelo de embeddings, provedor, hardware, dimensão, armazenamento vetorial e parâmetros de recuperação.
- Forma exata da indicação de limitação na interface e no contexto do Narrador.
