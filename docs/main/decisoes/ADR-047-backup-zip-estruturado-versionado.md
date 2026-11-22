# ADR-047 — Backups em ZIP estruturado e versionado

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Questão:** P-46
- **Origem:** Aprovação explícita do responsável pelo Henduran

## Contexto

A ADR-044 estabelece backups portáteis exportáveis e importáveis de Jornadas, ramificações e dependências necessárias dos Mundos. A ADR-045 define importação assistida com detecção de conflitos e proteção contra sobrescritas silenciosas. A ADR-046 define migração entre versões, mediante validação, confirmação e preservação do backup original. Restava escolher o formato físico/lógico de empacotamento.

## Decisão aprovada

O Henduran utilizará **um pacote ZIP estruturado e versionado** para backups portáteis. O pacote conterá:

- **Manifesto** para identificação do pacote e das versões pertinentes.
- **Dados estruturados da Jornada**, estado e histórico necessários à sua restauração.
- **Dados e referências das ramificações**, preservando independência e relações entre continuidades.
- **Dependências necessárias do Mundo**, incluindo as referências às versões usadas.
- **Anexos permitidos**, quando necessários e com direitos de inclusão compatíveis.

O arquivo ZIP terá estrutura organizada e identificável, permitindo validação e identificação da versão antes da importação ou migração.

## Restrições

- Não incluir automaticamente chaves ou segredos de API, modelos de IA instalados ou assets comerciais sem autorização de redistribuição.
- Um backup não substitui os arquivos literários Markdown/PDF/EPUB.
- A importação permanece sujeita à detecção de conflitos, validação e confirmação nos termos das ADR-045 e ADR-046.
- Preservar a integridade referencial entre Mundo, Jornada, memória e ramificações, sem misturar continuidades incompatíveis.
- A decisão aprova o formato ZIP e a organização conceitual; **não** estabelece um esquema definitivo.

## Pendências explícitas

- Esquema exato e nomes dos arquivos internos.
- Campos, versão e estrutura do manifesto.
- Algoritmos e parâmetros de compressão.
- Checksums, assinaturas e validações de integridade, limites de tamanho/extração e defesas contra arquivos hostis.
- Detalhes de migração, rollback, importação, restauração e compatibilidade entre versões.
- Inclusão opcional de anexos e dependências, com política de licenciamento e tamanho.
