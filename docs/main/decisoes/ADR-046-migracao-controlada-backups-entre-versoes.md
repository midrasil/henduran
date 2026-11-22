# ADR-046 — Migração controlada de backups entre versões

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Questão:** P-45
- **Origem:** Aprovação explícita do responsável pelo Henduran

## Contexto

O Henduran permitirá exportar e importar backups portáteis de Jornadas, suas ramificações e dependências do Mundo (ADR-044). A importação poderá encontrar conflitos com dados existentes e deve ser assistida e segura (ADR-045). Atualizações do aplicativo poderão modificar esquemas de dados, fichas e estrutura de Mundos, de modo que backups antigos exigirão política de compatibilidade.

## Decisão aprovada

O Henduran oferecerá **migração de backups entre versões**, quando compatível e segura, com:

- **Identificação da versão de origem** do backup e da versão de destino.
- **Validação** de integridade, compatibilidade e coerência da conversão antes de torná-la efetiva.
- **Apresentação de riscos** e **confirmação explícita do jogador** antes de aplicar alterações ao estado instalado.
- **Preservação do arquivo de backup original, sem alterações** durante todo o processo.
- **Falha segura:** se a migração for impossível, inválida ou insegura, interromper sem modificar o backup original nem os dados instalados.

As opções de importação assistida da ADR-045 continuam válidas para os dados migrados; não há autorização para sobrescrita ou mesclagem silenciosa. Não se promete migrar indefinidamente qualquer versão antiga: as versões concretamente suportadas deverão ser especificadas e testadas.

## Consequências

- O backup precisa permitir reconhecer sua versão de esquema, mas o formato concreto ainda está pendente.
- A cadeia de migrações deve preservar relações entre Mundo, Jornada, ramificações e fatos canônicos.
- O sistema deve verificar o resultado antes de persistir no destino.
- Uma incompatibilidade não deve destruir o backup original nem uma Jornada já instalada.
- Restaurar os dados migrados respeita a política de ramificações e demais decisões já aprovadas.

## Pendências

- Estrutura e formato do pacote de backup.
- Esquema de versões, versões antigas efetivamente suportadas e saltos de migração.
- Algoritmos de validação, mapeamentos de entidades e regras concretas de compatibilidade.
- Fluxo transacional, rollback e tratamento de migrações parciais ou interrompidas.
- Interface para apresentar diferenças, riscos e resultados da migração.
