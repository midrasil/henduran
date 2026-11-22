# ADR-045 — Importação assistida de backups com resolução de conflitos

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Questão:** P-44
- **Origem:** Decisão explícita do responsável pelo Henduran

## Contexto

A ADR-044 estabeleceu backups portáteis exportáveis/importáveis preservando Jornadas, ramificações e dependências necessárias dos Mundos. Em outra instalação, podem existir Mundos, Jornadas e continuidades com nomes, versões ou identificadores coincidentes. A importação não pode corromper ou sobrescrever dados preexistentes silenciosamente.

## Decisão aprovada

O Henduran realizará **importação assistida**, detectando conflitos antes de incorporar os dados e oferecendo ao jogador alternativas compatíveis com o caso:

1. **Importar como cópia independente**, mantendo os dados da instalação e criando identidade própria para a importação, quando necessário.
2. **Reutilizar dependências compatíveis**, como dados de Mundo já existentes, desde que a compatibilidade e as referências sejam verificadas e a importação preserve sua integridade.
3. **Substituir dados existentes**, exclusivamente mediante **confirmação explícita do jogador** e **validação de segurança** que impeça quebrar ramificações, salvamentos ou outras dependências.

Não é permitida sobrescrita, mesclagem ou substituição silenciosa de dados. O sistema deve impedir uma operação quando não puder garantir a integridade das informações envolvidas. As decisões de versionamento de Mundos e resolução de conflitos (ADR-024 e ADR-026) continuam válidas.

## Implicações

- Inspecionar e comparar o backup com a instalação antes de efetivar a importação.
- Apresentar conflitos relevantes e opções seguras, sem assumir que todo conflito admita todas as alternativas.
- Preservar vínculos de ramificações, históricos, dependências de Mundos e salvamentos existentes.
- Exigir confirmação expressa antes de substituir algo e não tratar ausência de resposta como consentimento.
- Não inferir compatibilidade apenas de nomes iguais; a verificação técnica será definida depois.

## Pendências não aprovadas

- Formato/estrutura do pacote de backup.
- Compatibilidade entre versões do Henduran e migrações de dados.
- Algoritmos de detecção e equivalência de dependências, identificadores e conflitos.
- Estratégia transacional de importação, rollback e verificação de integridade.
- Interface de comparação e escolhas, detalhes de cancelamento e recuperação após falhas.
