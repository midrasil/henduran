# ADR-044 — Backups portáteis de Jornadas e dependências dos Mundos

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Questão:** P-43
- **Origem:** Decisão explícita do responsável pelo Henduran

## Contexto

O Henduran já prevê salvamentos híbridos (ADR-039), retenção de autosaves recentes e marcos relevantes (ADR-040), ramificações independentes (ADR-041), navegação pela árvore de continuidades (ADR-042) e arquivamento/exclusão controlada (ADR-043). A preservação e a transferência entre instalações necessitam de um mecanismo distinto da exportação de livros literários.

## Decisão aprovada

O Henduran disponibilizará **exportação e importação de backups portáteis**, preservando:
- **Jornada**, incluindo seu estado canônico e histórico necessário à restauração.
- **Ramificações** e dados suficientes para manter suas continuidades independentes.
- **Dependências necessárias do Mundo** e referências/versionamento para que a Jornada possa ser retomada coerentemente em outra instalação.

O mecanismo será **local e portátil**; não requer conta, sincronização em nuvem ou serviço remoto. Os arquivos de backup de jogo são diferentes dos arquivos literários Markdown/PDF/EPUB.

## Restrições e implicações

- A importação não deve corromper Jornadas ou Mundos já presentes na instalação de destino.
- Integridade de estado e histórico e vínculo correto de ramificações precisam ser preservados.
- Não incluir automaticamente segredos de API, modelos de IA instalados ou assets comerciais cuja redistribuição não esteja autorizada.
- A lógica de versionamento de Mundos (ADR-024) e resolução de conflitos sob aprovação explícita (ADR-026) continua válida.
- A adoção do formato de pacote ainda não está decidida; a decisão não exige um formato ou implementação específicos.

## Pendências explícitas

- Estrutura e formato dos pacotes de backup.
- Política de compatibilidade entre versões do Henduran e migração dos dados.
- Tratamento de conflitos de nomes, identificadores, Mundos e Jornadas existentes no destino.
- Regras de inclusão de dependências, anexos, imagens e assets licenciados.
- Verificação de integridade e procedimentos de recuperação frente a backups incompletos ou corrompidos.
- UX de exportação/importação, seleção e localização dos arquivos, requisitos de armazenamento e testes.
