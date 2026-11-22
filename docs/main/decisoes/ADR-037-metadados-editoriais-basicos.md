# ADR-037 — Metadados editoriais básicos para diário e livro

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Questão:** P-36
- **Origem:** Escolha explícita da opção B pelo responsável pelo Henduran

## Contexto

O Henduran já terá diário e livro literário exportáveis em Markdown, PDF e EPUB (ADR-023, ADR-033), editor assistido por IA (ADR-032), organização híbrida de capítulos (ADR-034), modelos editoriais (ADR-035) e capas híbridas (ADR-036). Restava decidir os metadados bibliográficos iniciais.

## Decisão aprovada

A exportação inicial terá **metadados editoriais básicos**:

- Título da obra;
- Subtítulo;
- Autor;
- Pseudônimo opcional;
- Sinopse;
- Data de exportação;
- Nome da Jornada;
- Nome do Mundo;
- Idioma.

O jogador deverá ter controle sobre os metadados apresentados como autoria e descrição da obra. Dados existentes de Mundo e Jornada podem fundamentar o preenchimento sem transformar inferências da IA em fatos canônicos. A exportação desses metadados não deve alterar o registro canônico da Jornada nem o conteúdo literário aprovado.

## Consequências

- Adicionar metadados à representação do livro/diário e disponibilizá-los aos formatos que os suportarem.
- Permitir associação entre o livro, a Jornada e o Mundo utilizados como origem.
- Distinguir nome do autor, pseudônimo e protagonista; nenhum deles precisa coincidir.
- Tratar campos opcionais sem impedir a exportação quando não forem exigidos pelo formato.

## Pendências

- Campos obrigatórios, valores padrão e validação.
- Identificadores bibliográficos e padrões específicos de EPUB/PDF.
- Folha de rosto, quarta capa, sumário, créditos e informações legais.
- Publicação e compartilhamento, ISBN, licenciamento ou comercialização de obras.
- Diagramação e detalhes técnicos de exportação.
