# ADR-042 — Árvore visual de continuidades da Jornada

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Questão:** P-41
- **Origem:** Aprovação explícita do responsável pelo Henduran

## Contexto

A ADR-041 estabelece que continuar de um salvamento anterior cria automaticamente uma ramificação independente, preservando a continuidade original. Era necessário definir como o jogador navegará e gerenciará essas linhas sem misturar estados ou históricos.

## Decisão aprovada

O Henduran apresentará as ramificações de uma Jornada em uma **árvore visual de continuidades**. A representação deverá permitir identificar:

- **Relações entre as ramificações**, incluindo suas linhas de origem.
- **Pontos de divergência** resultantes da retomada de salvamentos anteriores.
- **Progresso** de cada continuidade, permitindo distinguir linhas disponíveis.
- **Acesso à consulta e retomada** das continuidades preservadas.

A árvore é uma interface de navegação e representação, não uma permissão para transferir itens, fatos, recursos ou derrotas entre linhas de continuidade. Cada ramificação conserva seu próprio estado, histórico, memória e contador de derrotas, conforme ADR-041. A simples consulta não inicia uma nova ramificação.

## Consequências

- Representar relações de origem e divergência para permitir visualização em árvore.
- Permitir ao jogador reconhecer e selecionar a continuidade desejada.
- Manter navegação consistente mesmo com ramificações múltiplas.
- Preservar a continuidade original ao retomar uma linha derivada.

## Pendências não aprovadas

- Tecnologia e organização física dos dados das ramificações.
- Política de exclusão, arquivamento, recuperação e proteção de ramificações.
- Layout, níveis de zoom, filtragem e detalhes da interação na árvore visual.
- Nomeação, metadados de progresso e regras de exibição dos pontos de divergência.
- Limites de ramificações e consumo de armazenamento.
