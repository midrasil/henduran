# ADR-067 — Transmissão e revelação de conhecimento por eventos estruturados

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Questão:** P-66
- **Origem:** Escolha explícita do responsável pelo Henduran

## Contexto

As ADR-060 a ADR-066 separam conhecimento por personagem, crenças, evidências e verdade canônica. O Narrador precisa poder interpretar diálogos em que informações são comunicadas, inclusive alegações falsas, sem dar à própria narração autoridade para alterar conhecimentos persistentes ou confirmar fatos.

## Decisão aprovada

A transmissão ou revelação de conhecimento será persistida por meio de **eventos estruturados propostos pelo Narrador e validados pelo motor**. Cada evento deverá identificar **fonte, destinatários, conteúdo comunicado e contexto**, incluindo a continuidade em que ocorreu. Antes de persistir, o motor validará origem e acesso ao conhecimento, comunicação e participantes, permissões, coerência do estado e escopo da ramificação.

O registro de que uma informação foi **comunicada** é distinto de declará-la **verdadeira**. O receptor pode ouvir uma alegação, mentira, rumor, suspeita ou fato real e passar a conhecer apenas a versão que recebeu, conforme as evidências e o histórico pertinentes. A comunicação não promove por si só a verdade canônica nem garante que o destinatário acredite na informação.

## Consequências

- Preservar proveniência, destinatários e circunstâncias da revelação para consulta e auditoria.
- Não presumir que todos os personagens presentes perceberam ou compreenderam a comunicação; regras de percepção ainda não estão especificadas.
- Respeitar isolamento de Jornadas e ramificações (ADR-058 e ADR-059).
- Evitar duplicação ou mudanças parciais por eventos repetidos, obedecendo persistência transacional (ADR-049).
- Não exigir confirmação do jogador para toda revelação somente por ser narrativa; continuam aplicáveis confirmações mecânicas já definidas, como testes fora de combate (ADR-006).

## Pendências

- Esquema exato dos eventos e vínculo com trechos de diálogos.
- Taxonomia de sigilo e níveis de permissão; classificação de comunicações falsas ou ambíguas.
- Percepção, alcance, presença, testemunhas e compreensão de uma revelação.
- Comunicação indireta, transmissão em cadeia e atualização de confiança/crenças.
- Implementação de filtros, idempotência e validação transacional.
