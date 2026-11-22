# Entrega — mapeamento UI/UX

## Identificação

- Branch: `docs/mapeamento-ui-ux`
- Commit principal: `1bfa7e3` — `docs(ui-ux): mapeia interface e assets Franuka`
- Commit de registro de entrega: o commit que adiciona este arquivo

## Contexto

Esta entrega transforma o pacote comercial Franuka e as decisões existentes do Henduran em uma especificação auditável de UI/UX. Não implementa telas definitivas, não altera regras de gameplay e não redistribui os assets licenciados.

## O que mudou

- inventário recursivo de 1.917 arquivos, com manifesto determinístico e dimensões das imagens;
- catálogo HTML local que referencia os assets na origem, sem Base64 ou cópias;
- design system de 21 componentes, mapa de 15 telas, wireframes e 14 fluxos;
- guia de implementação para a stack candidata, sempre distinguindo `CONFIRMADO`, `PROPOSTO` e `PENDENTE`;
- inspetor local reproduzível em `scripts/ui-ux/inspect-franuka.ps1`;
- backlog atualizado com a sequência recomendada de implementação.

## Como verificar

1. Execute `./scripts/ui-ux/inspect-franuka.ps1` na raiz do projeto.
2. Confirme que o manifesto registra 1.917 caminhos únicos e nenhuma imagem sem dimensões.
3. Abra `docs/ui-ux/catalogo-franuka.local.html` localmente; ele deve carregar imagens apenas de `assets/tilesets/ui/franuka`.
4. Consulte `docs/esteira/mapeamento-ui-ux/05-qa.md` para as evidências dos 12 critérios de aceite.

## Validação realizada

- Revisor: `APROVADO` na segunda rodada.
- QA: `PASSOU` nos 12 critérios.
- 1.262 comparações dimensionais entre variantes 1x/2x/3x, sem exceções.
- zero links Markdown relativos quebrados;
- manifesto e catálogo reproduzidos de forma determinística em duas execuções;
- nenhum asset comercial modificado, duplicado ou incorporado ao catálogo.

## Riscos e limitações

- duração e quantidade de frames dos seis GIFs não foram extraídas; suas dimensões foram registradas;
- não há atlas ou metadados formais no pacote; 9-slice permanece candidato quando não comprovado;
- resolução-base, breakpoints, acessibilidade formal e detalhes de algumas interações continuam `PROPOSTO` ou `PENDENTE`;
- a distribuição dos assets comerciais no executável e em repositório público ainda requer validação jurídica/licenciante.

## Decisões registradas

- a stack React/TypeScript/PixiJS é candidata, não decisão fechada;
- o catálogo é exclusivamente local e referencia os arquivos licenciados sem duplicá-los;
- a implementação deve começar pela interface principal da Jornada, preservando chat predominante na narrativa e mapa predominante na tática;
- a atualização semântica do Graphify com documentos é opcional porque consome tokens.

## Artefatos da esteira

- PRD: `docs/esteira/mapeamento-ui-ux/01-prd.md`
- Plano técnico: `docs/esteira/mapeamento-ui-ux/02-plano-tecnico.md`
- Notas de desenvolvimento: `docs/esteira/mapeamento-ui-ux/03-dev-notas.md`
- Revisão: `docs/esteira/mapeamento-ui-ux/04-revisao.md`
- QA: `docs/esteira/mapeamento-ui-ux/05-qa.md`

## Próximos passos

1. ⭐ Implementar o primeiro slice da interface principal da Jornada a partir da especificação UI/UX — rota completa de feature.
2. Decidir e registrar resolução-base, breakpoints e acessibilidade formal — rota de decisão/ADR conforme necessário.
3. Atualizar o grafo com os documentos usando `/graphify . --update` — opcional, consome tokens.
