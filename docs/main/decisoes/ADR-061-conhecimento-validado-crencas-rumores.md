# ADR-061 — Aquisição de conhecimento validada, com distinção entre fatos, crenças e rumores

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Questão:** P-60
- **Origem:** Aprovação explícita do responsável pelo Henduran

## Contexto

A ADR-060 definiu que o Narrador pode acessar segredos com controle, mas o protagonista e os NPCs somente conhecem informações adquiridas em suas respectivas continuidades. Uma afirmação recebida de outra entidade pode ser mentira, interpretação incorreta, suspeita ou informação comprovada. Portanto, conhecimento subjetivo e verdade canônica não são equivalentes.

## Decisão aprovada

O Henduran exigirá **validação do motor** para aquisições ou revelações de conhecimentos propostas pelo Narrador. Os registros de conhecimento deverão distinguir:

- **Fato confirmado:** informação sustentada como fato confirmado no escopo permitido, sem confundir a confirmação com mera confiança de um NPC.
- **Crença:** informação que a entidade considera verdadeira, independentemente da verdade canônica.
- **Suspeita:** hipótese ainda não confirmada.
- **Rumor:** informação que circula sem confirmação confiável.
- **Alegação:** afirmação atribuída a pessoa, fonte ou entidade específica, cuja veracidade não é presumida.

O motor validará a origem, os participantes e o escopo de Mundo, Jornada e ramificação antes de persistir a atualização de conhecimento; deve também respeitar regras de autorização para revelações. O narrador não poderá elevar automaticamente uma alegação a verdade canônica por apenas tê-la narrado.

## Consequências

- NPCs poderão mentir, acreditar em falsidades, transmitir rumores e mudar de opinião sem alterar diretamente o cânone do Mundo.
- O protagonista poderá agir com base em informação incompleta ou falsa, mantendo a distinção entre saber, suspeitar e acreditar.
- Registros de conhecimento serão persistidos de maneira consistente, respeitando ramificações e o passado comum definido na ADR-059.
- Recuperação por SQLite, FTS5 e embeddings deverá respeitar tanto acesso quanto tipo de conhecimento, sem tratar rumor como prova.

## Pendências explícitas

- Modelo de evidências, proveniência, grau de confiança e referências a fontes.
- Critérios de confirmação e revisão de conhecimento quando surgirem novas provas.
- Tratamento de versões contraditórias de um mesmo acontecimento.
- Esquema de permissões, classificação de segredos e regras de revelação.
- Modelo físico de tabelas, índices, API do motor, interface e testes.
