# ADR-007 — Persistência híbrida da Jornada

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Referência:** P-09 (parte relativa ao modelo de persistência)
- **Origem:** aprovação explícita do responsável pelo Henduran

## Contexto

A Jornada é contínua e persiste entre sessões de uso do aplicativo. Cenas possuem históricos próprios e podem produzir alterações duradouras em personagens, inventários, lugares e relações. A narrativa gerada pelo modelo não é, por si só, uma alteração mecânica válida.

## Decisão aprovada

**Manter simultaneamente o estado atual persistido da Jornada e um histórico de eventos relevantes.**

- O **estado atual** permite carregar e consultar a situação efetiva do jogo sem reconstituir toda a Jornada a cada operação.
- O **histórico de eventos relevantes** oferece rastreabilidade das alterações efetuadas, com referências à origem e à Cena quando aplicável.
- Operações mecânicas são validadas pelo motor de regras e devem atualizar o estado e o histórico de modo consistente.
- Mensagens da IA não substituem operações registradas nem servem sozinhas como prova de que uma alteração ocorreu.

## Consequências e critérios de aceitação

1. Uma compra concluída permanece no inventário e no saldo após fechar e reabrir o aplicativo.
2. Repetir ou reenviar a mesma operação confirmada não deve duplicar efeitos, tais como entrega de item ou desconto de recursos.
3. Um teste confirmado deve vincular seus dados, resultado e consequências efetivamente aplicadas ao contexto que o produziu.
4. Uma alteração negada por validação não deve deixar efeitos parciais persistidos.
5. Falhas de processo ou interrupções durante uma gravação não devem tornar o estado atual incoerente com a operação correspondente no histórico.

Estes critérios expressam os resultados esperados; **não** aprovam uma tecnologia ou implementação física específica. Transações atômicas e identificadores idempotentes são sugestões de implementação.

## Fora do alcance desta decisão

- Permitir ou proibir desfazer livremente decisões narrativas.
- Definir rollback, restauração de pontos anteriores ou edição de fatos canônicos.
- Determinar quais eventos são relevantes e por quanto tempo ficam retidos.
- Escolher banco de dados, formato de snapshots, criptografia, backups ou mecanismo de migração.
- Definir o modelo de memória recuperável da IA e sua relação com fatos canônicos (P-10).

Essas questões permanecem pendentes e exigem decisões separadas.
