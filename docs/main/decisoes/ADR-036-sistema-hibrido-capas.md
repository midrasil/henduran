# ADR-036 — Sistema híbrido de capas para livros literários

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Questão:** P-35
- **Origem:** Aprovação explícita do responsável pelo Henduran

## Contexto

As ADR-023, ADR-032, ADR-033, ADR-034 e ADR-035 definem diário/livro literário exportável, editor com revisão, exportação em Markdown/PDF/EPUB, organização híbrida de capítulos e modelos editoriais selecionáveis. Restava decidir como as capas desses livros seriam tratadas.

## Decisão aprovada

O Henduran adotará um **sistema híbrido de capas** para livros literários, oferecendo três caminhos:

1. **Modelos predefinidos** fornecidos pelo Henduran.
2. **Importação de imagens externas** escolhidas pelo jogador.
3. **Geração opcional por IA**, quando existir um provedor compatível configurado.

A capa poderá combinar imagem, título, subtítulo e autoria, mas não modifica o texto aprovado, os fatos canônicos da Jornada nem o estado do jogo. A exportação do livro não dependerá da geração por IA: quando não houver provedor configurado, os outros caminhos continuarão disponíveis.

## Consequências

- O fluxo de exportação literária poderá incluir criação ou seleção de capa.
- O sistema precisará tratar separadamente conteúdo textual e elementos visuais da capa.
- A geração por IA será opcional e não bloqueará o uso dos modelos predefinidos ou de imagens externas.
- O sistema deverá aceitar imagens do jogador sem presumir direitos de redistribuição.
- A presença de modelos predefinidos garante uma opção funcional mesmo sem provedor de imagem.

## Pendências não aprovadas

- Quantidade, estilo e parâmetros dos modelos de capa.
- Regras de enquadramento, corte, resolução e composição tipográfica.
- Metadados editoriais, publicação e compartilhamento.
- Implementação técnica da integração com provedores de imagem.
- Critérios de moderação, licença e uso de imagens importadas ou geradas.
