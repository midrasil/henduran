# ADR-033 — Exportação literária inicial em Markdown, PDF e EPUB

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Questão:** P-32
- **Origem:** Aprovação explícita do responsável pelo Henduran

## Contexto

As ADR-023, ADR-030, ADR-031 e ADR-032 estabelecem diário e livro literário exportável, geração apenas sob solicitação, perspectiva e voz configuráveis e edição/revisão com aprovação de versões. Restava definir os formatos iniciais de exportação sem assumir regras de diagramação ou publicação.

## Decisão aprovada

A exportação inicial do **diário narrativo** e do **livro literário** terá os formatos:

- **Markdown (`.md`):** preservação estruturada de texto para edição externa, armazenamento e interoperabilidade.
- **PDF (`.pdf`):** documento paginado para leitura e eventual impressão, sem definir ainda um modelo de diagramação.
- **EPUB (`.epub`):** livro digital de texto refluível, apropriado a leitores eletrônicos.

Os três formatos representam o material literário produzido e aprovado a partir da Jornada; exportá-lo não altera o estado canônico, as fichas, os eventos ou as regras do jogo. O resultado deve respeitar a perspectiva e a voz aprovadas para o texto, sem introduzir ou corrigir fatos do jogo silenciosamente.

## Consequências

- Disponibilizar três rotas/formats de exportação literária na implementação inicial.
- Preservar o texto e a estrutura lógica dos capítulos entre formatos, considerando diferenças entre paginação de PDF e fluxo de EPUB.
- Usar material aprovado no editor, sem invocar automaticamente a IA para reescrita apenas porque o jogador solicitou exportação.
- Tratar falhas de exportação sem corromper o material literário salvo.
- Não confundir o arquivo de exportação literária com um save de jogo.

## Fora do escopo desta decisão

- Diagramação, modelos editoriais, capa, sumário, imagens e metadados de publicação.
- Editoração automática, configuração de margens/fontes e qualidade tipográfica final.
- Publicação ou distribuição automática de obras.
- Suporte inicial aos formatos DOCX e TXT.
- Política de exportação de rascunhos não aprovados, seleção de capítulos, nomes dos arquivos e mecanismos de compatibilidade.
- Biblioteca ou ferramenta específica para geração de PDF/EPUB e detalhes da pipeline.
