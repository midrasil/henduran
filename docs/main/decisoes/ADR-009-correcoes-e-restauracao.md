# ADR-009 — Correções pontuais e restauração de salvamentos

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Questão:** P-09 (política de correções e restauração)
- **Origem:** Decisão explícita do responsável pelo Henduran

## Contexto

O Henduran mantém o estado oficial da Jornada e um histórico de eventos relevantes (ADR-007), além de memória híbrida do Narrador (ADR-008). Em histórias extensas, a IA pode contradizer acontecimentos anteriores. É necessário distinguir erros a corrigir de escolhas legítimas que tenham produzido consequências.

## Decisão aprovada

O Henduran permitirá **correções narrativas pontuais** e **restauração de salvamentos anteriores**.

1. **Correção pontual:** o jogador pode indicar inconsistências, permitindo retificar os fatos envolvidos de modo controlado e consistente com o estado oficial. Não pressupõe retorno integral a um momento anterior da Jornada.
2. **Restauração:** o jogador pode restaurar um salvamento anterior. O estado oficial, os eventos relevantes, a Cena e a memória recuperável devem voltar a uma versão compatível com o ponto restaurado, sem misturar acontecimentos posteriores da continuidade abandonada.
3. **Autoridade:** a IA não pode editar diretamente o estado oficial nem executar livremente retcons. Correções persistentes passam por operações validadas, com consentimento apropriado do jogador.
4. **Limite:** a decisão **não aprova** desfazer arbitrariamente eventos isolados do passado nem recalcular automaticamente toda a cadeia de eventos dependentes.

## Requisitos de consistência

- Após correção de fato, não manter em resumos e buscas semânticas uma versão contraditória como se fosse atual.
- Após restauração, a partida ativa não pode conter itens, XP, danos, relações ou eventos exclusivos da continuidade posterior descartada.
- O histórico de correções e restaurações deve permitir diagnosticar divergências sem atribuir à IA autoridade sobre efeitos mecânicos.
- Se a restauração falhar, não aplicar uma versão parcialmente restaurada.

## Exemplo

Se a IA afirmar que um NPC poupado morreu, o jogador pode corrigir esse fato e o Narrador deve voltar a tratá-lo como sobrevivente. Se o jogador escolher restaurar um salvamento anterior à Cena, a Jornada retorna ao estado compatível com o salvamento, inclusive inventário e memórias.

## Ainda em aberto

- Frequência e criação manual/automática de pontos de restauração.
- UX de seleção, confirmação e nomenclatura de salvamentos.
- Se restaurações preservam ramificações separadas ou substituem a linha atual.
- Política detalhada de autorização e registro de correções pontuais.
- Versionamento, invalidação e reindexação de memórias retificadas.

## Relações

- ADR-004: autonomia do Narrador limitada por ferramentas validadas.
- ADR-007: persistência híbrida.
- ADR-008: fatos estruturados, resumos e busca semântica.
