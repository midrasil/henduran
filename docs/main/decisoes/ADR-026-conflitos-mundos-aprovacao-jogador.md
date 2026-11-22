# ADR-026 — Resolução assistida de conflitos de atualização de Mundos

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Questão:** P-25 do GDD
- **Origem:** Decisão explícita do responsável pelo Henduran (opção B)

## Contexto

A ADR-021 separa Mundos reutilizáveis e Jornadas com estados independentes; a ADR-024 define versionamento de Mundos e atualizações opcionais para Jornadas; a ADR-025 exige revisão e aprovação do jogador antes de canonizar dados externos. Uma nova versão do Mundo pode contradizer fatos ocorridos e fixados na Jornada, por exemplo uma mudança retroativa de governo de uma cidade que o personagem já ajudou a transformar.

## Decisão

**Conflitos detectados ao atualizar uma Jornada para uma versão nova de seu Mundo terão resolução assistida por IA**, com apresentação de alternativas ao jogador e **aprovação explícita antes de qualquer aplicação**. A IA pode sugerir preservar o fato já ocorrido, adaptar a alteração proposta ou descartá-la, mas não executa qualquer resolução sem consentimento.

O motor deve validar e registrar as alterações aprovadas. A ausência de aprovação mantém a Jornada na versão atual. O histórico e os fatos canônicos da Jornada não são reescritos silenciosamente.

## Consequências

- Comparar a atualização pretendida com os fatos canônicos e o estado persistente da Jornada.
- Apresentar conflitos e propostas de resolução, distinguindo dados originais, novidades e efeitos esperados.
- Somente aplicar alterações aprovadas explicitamente e validadas pelo motor.
- Preservar rastreabilidade de decisões sobre conflitos, alterações aceitas e a versão usada.
- Impedir alterações automáticas ou justificadas apenas por texto produzido pelo Narrador.
- Permitir que o jogador recuse a atualização e continue normalmente.

## Fora de escopo e pendências

- Algoritmo de detecção semântica e estrutural, formato do diff e comportamento em divergências complexas.
- Interface de aprovação por entidade, grupo ou migração inteira.
- Alteração retroativa de acontecimentos, edição manual de fatos da Jornada e regras específicas de reconciliação.
- Reversão, backups, migrações de save, compatibilidade de mapas e reindexação de memórias.
- Momento de aplicar atualização durante uma Cena ou situação tática.

## Critérios de aceite propostos

1. Uma atualização que contradiz fato canônico da Jornada é identificada e não aplicada automaticamente.
2. O jogador recebe alternativas e pode escolher uma resolução ou recusar a atualização.
3. Nenhuma mudança conflitante é aplicada antes da aprovação explícita e da validação.
4. A Jornada mantém seus acontecimentos registrados e segue jogável ao recusar uma atualização.
