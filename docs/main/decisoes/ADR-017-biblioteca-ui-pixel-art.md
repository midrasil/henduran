# ADR-017 — Biblioteca reutilizável de UI pixel art

- **Estado:** Parcialmente substituída pelo ADR-069 (a base visual em sprites Franuka foi retirada do MVP; o princípio de biblioteca reutilizável permanece)
- **Data:** 2026-11-22
- **Questão:** P-18 do GDD
- **Origem:** Decisão explícita do responsável pelo Henduran

## Contexto

O Henduran é um aplicativo Windows com interface React + TypeScript, mapas em PixiJS e identidade pixel art baseada no RPG UI Pack comercial da Franuka, cujos arquivos estão na cópia local do projeto. O desenvolvimento será realizado por Codex/Claude Code. O conteúdo exato do pacote não foi inspecionado neste contexto.

## Decisão

Construir uma **biblioteca reutilizável de componentes de UI pixel art** a partir de um **inventário automatizado local dos assets da Franuka**, antes de compor as telas finais.

- Usar React/TypeScript para componentes e estados de interface; CSS para layout, tipografia e responsividade, mantendo a aparência baseada nos sprites.
- Inventariar, sem alterar os originais, arquivos, formatos, dimensões, estados de botões, molduras, painéis e possibilidades reais de 9-slice/redimensionamento.
- Construir componentes reaproveitáveis somente após identificar os sprites apropriados. Exemplos potenciais: botão, painel, janela, barra, tooltip, slots de inventário e molduras do chat.
- Evitar implementação visual duplicada entre telas. Exigir exemplos de uso, estados (quando disponíveis), testes de comportamento e validação visual.
- Preservar escala e nitidez de pixel art, com atenção à leitura de textos longos no chat e acessibilidade.
- Não disponibilizar os assets originais em repositório público sem verificação prévia das condições de licença. Uma cópia local do pacote não concede automaticamente permissão para publicá-lo no Git.

## Consequências e limites

- A primeira atividade do agente será **auditoria local + catálogo de assets + prova visual**, não implementação direta de telas finais.
- O pacote é referência visual, mas não se presume que contenha todos os estados, fontes ou componentes desejados.
- Componentes ausentes no pacote dependerão de decisão de design: composição com recursos existentes, CSS ou novos assets licenciados/autoriais.
- Esta decisão não altera o uso de PixiJS para mapas e tokens nem aprova o compartilhamento público dos arquivos do pacote.

## Critérios de aceite propostos para implementação

1. Inventário reproduzível com caminhos relativos, formatos e dimensões.
2. Arquivos originais não são modificados.
3. Componentes comuns são documentados e reutilizados em pelo menos duas telas ou exemplos quando houver uso repetido.
4. Textos longos, foco por teclado, zoom e escalonamento de sprites são verificados.
5. O Git público não inclui arquivos comerciais sem direito de redistribuição comprovado.

## Em aberto

- Conteúdo efetivo e licença do RPG UI Pack.
- Convenções de escala, resolução-base e fonte para textos longos.
- Estrutura exata da biblioteca, ferramentas de catálogo e testes de imagem.
- Geração de assets suplementares e permissões de distribuição do executável.
