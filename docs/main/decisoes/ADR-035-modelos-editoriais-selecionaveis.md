# ADR-035 — Modelos editoriais selecionáveis para a exportação literária

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Questão:** P-34
- **Origem:** Aprovação explícita do responsável pelo Henduran

## Contexto

O Henduran já possui decisões para diário e livro literário, edição/revisão com aprovação, organização híbrida de capítulos e exportação em Markdown, PDF e EPUB (ADR-023, ADR-032, ADR-033 e ADR-034). Restava definir a abordagem inicial de diagramação, sem decidir ainda detalhes específicos de publicação e capa.

## Decisão

O Henduran **disponibilizará modelos editoriais selecionáveis** para o livro literário. Antes de exportar, o jogador poderá escolher entre modelos predefinidos de apresentação, evitando tanto um único layout obrigatório como a implementação inicial de um editor completo de diagramação.

Os modelos poderão organizar elementos de apresentação, como estilos de título, tipografia, espaçamento e margens, respeitando as características de cada formato de saída:

- **PDF:** apresentação paginada.
- **EPUB:** conteúdo refluível, considerando preferências e capacidades do leitor.
- **Markdown:** representação textual estruturada, sem garantia de paginação ou aparência idêntica.

A escolha de modelo é uma operação de apresentação/exportação. Ela **não altera o conteúdo literário aprovado nem o estado canônico** da Jornada. Não pressupõe redesenho automático da obra pela IA.

## Consequências

- Projetar um mecanismo que separe conteúdo literário e parâmetros de apresentação.
- Permitir selecionar um modelo ao exportar livro.
- Garantir que um modelo não imponha ao EPUB o mesmo posicionamento fixo do PDF.
- Preservar a compatibilidade com os três formatos iniciais estabelecidos na ADR-033.

## Pendências não aprovadas

- Número, nomes, aparência, disponibilidade e especificação concreta dos modelos.
- Personalizações adicionais de fontes, margens, estilos e imagens.
- Capa, ilustrações, metadados bibliográficos e sumário.
- Publicação, distribuição e mecanismos de compartilhamento.
- Ferramentas, bibliotecas, pipeline e detalhes técnicos de geração de PDF e EPUB.
- Se e como estilos selecionados serão preservados entre exportações ou projetos.
