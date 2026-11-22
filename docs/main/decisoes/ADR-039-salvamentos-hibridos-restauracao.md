# ADR-039 — Salvamentos híbridos e restauração consistente

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Questão:** P-38
- **Origem:** Aprovação explícita do responsável pelo Henduran

## Contexto

A ADR-007 aprova a persistência híbrida (estado atual e histórico de eventos relevantes). A ADR-009 aprova correções pontuais e restauração de salvamentos anteriores, sem autorizar desfazer seletivamente ações arbitrárias. Restava determinar a política geral de criação de salvamentos.

## Decisão aprovada

O Henduran adotará **salvamentos híbridos**:

1. **Salvamentos automáticos** após alterações relevantes do estado da Jornada, para reduzir perda de progresso.
2. **Salvamentos manuais identificáveis**, criados por iniciativa do jogador.
3. **Restauração de estados anteriores**, abrangendo informações mecânicas e narrativas em uma linha de continuidade consistente.

A restauração deve recuperar um ponto coerente, inclusive inventário, recursos, NPCs, relações, eventos registrados e memória relevante, sem mesclar indevidamente estado de diferentes pontos. O contador de derrotas deve corresponder ao ponto restaurado. A regra de permanência das derrotas da ADR-027 não elimina a restauração integral já autorizada pelas ADR-009 e ADR-039.

A restauração não constitui autorização para reversão seletiva de eventos isolados da continuidade atual.

## Consequências para a implementação

- Diferenciar autosaves e saves manuais na interface e persistência.
- Associar cada save a um estado recuperável e consistente, inclusive histórico e dados de contexto.
- Registrar identificação legível dos salvamentos manuais.
- Garantir que a restauração não duplique transações nem reaplique eventos posteriores incompatíveis.
- Verificar recuperação em condições de fechamento inesperado e integridade referencial do save.

## Pendências não aprovadas

- Frequência e gatilhos exatos para autosaves.
- Retenção, quantidade máxima e política de descarte de autosaves.
- Formato físico e tecnologia de armazenamento.
- Nomenclatura e metadados de slots de salvamento manual.
- Política para sobrescrever, ramificar ou manter continuidade anterior após restaurar.
- Importação/exportação de saves e UX detalhada de recuperação.
