# ADR-038 — Exportação local e publicação externa por iniciativa do jogador

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Questão:** P-37
- **Origem:** Aprovação explícita do responsável pelo Henduran

## Contexto

As ADR-023 a ADR-037 estabeleceram o diário e o livro literário, geração sob demanda, editor com revisão, capítulos, exportação em Markdown/PDF/EPUB, diagramação por modelos, capas híbridas e metadados editoriais básicos. Restava decidir se o Henduran também deveria publicar ou compartilhar obras por meio de integrações externas ou de uma comunidade própria.

## Decisão aprovada

O Henduran realizará a **exportação local** dos arquivos literários. A **publicação e o compartilhamento serão externos ao aplicativo e realizados por iniciativa do jogador**.

No escopo inicial, o Henduran:
- Não precisa de integração direta com plataformas de publicação.
- Não manterá uma biblioteca pública própria para disponibilizar obras aos demais usuários.
- Não publicará nem transmitirá automaticamente a terceiros arquivos, capas ou metadados apenas por terem sido exportados.
- Deixará a escolha do destino, momento e condições da publicação ao jogador.

Essa decisão não revoga os provedores de IA já previstos para outras funcionalidades, como geração opcional de capas mediante configuração, nem equivale a uma decisão sobre telemetria ou conectividade de IA.

## Consequências

- A experiência de exportação deve funcionar localmente, sem depender de serviços de publicação.
- Os arquivos exportados devem poder ser localizados e usados pelo jogador fora do Henduran.
- Nenhum fluxo de compartilhamento/publicação deve iniciar sem uma decisão explícita do jogador.
- Conectores, biblioteca pública e recursos de publicação internos não integram o escopo inicial.
- As decisões de exportação (ADR-033), capas (ADR-036) e metadados (ADR-037) permanecem válidas.

## Pendências não aprovadas

- Detalhes técnicos de implementação dos exportadores e destino/nome dos arquivos.
- Fluxo de salvamento e escolha do diretório para exportação.
- Política de direitos autorais, atribuição e redistribuição de conteúdos baseados em mundos ou fontes de terceiros.
- Eventuais integrações futuras de publicação e compartilhamento.
