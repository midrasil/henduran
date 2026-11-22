# ADR-043 — Arquivamento e exclusão controlada de ramificações

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Questão:** P-42
- **Origem:** Aprovação explícita do responsável pelo Henduran

## Contexto

As ADR-039 e ADR-040 preveem salvamentos híbridos e retenção de checkpoints. A ADR-041 determina que continuar a partir de um salvamento anterior cria uma ramificação independente, e a ADR-042 aprova uma árvore visual para navegar entre as continuidades. Jornadas extensas podem acumular ramificações e ocupar armazenamento.

## Decisão aprovada

O Henduran permitirá **arquivar e excluir de maneira controlada** as ramificações da Jornada:

1. **Arquivamento:** ocultar ou retirar uma ramificação da árvore principal sem apagar seus dados, preservando a possibilidade de consulta e retomada posterior.
2. **Exclusão definitiva:** disponibilizar uma operação deliberada, com **confirmação explícita do jogador** e **verificação prévia das dependências**.
3. **Proteção de continuidades dependentes:** não remover informações cuja exclusão invalide outras linhas, pontos de divergência ou salvamentos ainda preservados. Quando não for possível demonstrar a integridade da operação, a exclusão deverá ser bloqueada ou depender de uma resolução específica.

Não haverá exclusão automática de ramificações por inatividade. Arquivamento não equivale a exclusão, nem altera o estado dos demais ramos. Essas regras não definem o mecanismo físico de referências compartilhadas.

## Implicações

- O gerenciador deverá distinguir ramificações ativas, arquivadas e candidatas a exclusão.
- O arquivamento será reversível sem reconstruir o estado a partir de texto literário.
- A exclusão precisará mapear dependências e salvamentos antes de agir, preservando a integridade do histórico.
- A operação não poderá misturar estados entre ramificações ou remover silenciosamente continuidades descendentes.
- A política de rotação de autosaves da ADR-040 não autoriza excluir ramificações inteiras.

## Pendências não aprovadas

- Armazenamento físico, referências compartilhadas, compactação, limpeza de dados e transações de exclusão.
- Tratamento detalhado de exclusão de ancestral com filhos, inclusive escolhas oferecidas ao jogador.
- Interface de arquivamento, exibição de itens arquivados, confirmação e recuperação após falhas.
- Política de lixeira, desfazer ou recuperação de uma exclusão definitiva.
- Importação/exportação de saves e backups.
