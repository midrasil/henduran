# UI/UX do Henduran

Especificação de pré-produção para transformar o pacote comercial Franuka em uma biblioteca reutilizável e compor a experiência desktop do Henduran. Não implementa telas finais nem altera regras.

## Legenda

- **CONFIRMADO**: decisão aprovada no GDD/ADR ou fato medido nos arquivos locais.
- **PROPOSTO**: recomendação de UI sujeita a validação.
- **PENDENTE**: lacuna que não pode ser resolvida sem decisão ou evidência adicional.

## Documentos

1. [Inventário Franuka](01-inventario-franuka.md)
2. [Design system](02-design-system.md)
3. [Mapa de telas](03-mapa-de-telas.md)
4. [Wireframes](04-wireframes.md)
5. [Fluxos e interações](05-fluxos-e-interacoes.md)
6. [Guia de implementação](06-guia-implementacao.md)
7. [Ambiente de dia e noite](07-ambiente-dia-noite.md)
8. [Guia de componentes (pixel art em CSS, ADR-069)](08-guia-de-componentes.md) — tokens, fontes e componentes em uso; substitui `02-design-system.md` para os tokens.
9. [Tela da Jornada (MVP)](09-tela-da-jornada.md) — aprovada com protótipo (`prototipos/tela-da-jornada.html`): visual livro, céu do período na barra, Arcos, chat com Aduran e Log, ficha com retrato e ficha completa em abas.
10. [Prototipagem de telas](10-prototipagem.md) — toda tela nova passa por protótipo navegável aprovado antes do dev; lista das telas a prototipar.
11. [Menu inicial (redesenho)](11-menu-inicial.md) — aprovado com protótipo (`prototipos/menu-inicial.html`): eixo central, paisagem animada, última Jornada à direita, Modelos no rodapé.
12. [Nova Jornada (assistente)](12-nova-jornada.md) — aprovado com protótipo (`prototipos/nova-jornada.html`): três passos com trilho e abas (Mundo com lista de Mundos, Protagonista com retrato, editor de História e Narrador, Revisão) e tela Iniciar Jornada com nome e descrição.

Recursos auxiliares locais: [catálogo visual](catalogo-franuka.local.html) e [manifesto completo](franuka-manifest.json). Regenere ambos com `./scripts/ui-ux/inspect-franuka.ps1` a partir da raiz.

## Fontes de verdade

Ordem: GDD e ADRs aprovadas em `docs/main/`; regras aprovadas em `rules/`; código/testes futuros coerentes; arquivos locais Franuka como evidência visual. A stack React/Tauri/PixiJS está aprovada pelo ADR-001; a prova de conceito e os pontos em aberto (motor, protocolo, empacotamento) seguem em `docs/main/04-arquitetura.md`.

> **Licença:** os binários Franuka são comerciais. O catálogo referencia os arquivos locais e não os incorpora. Não publicar os assets, o catálogo funcional isolado ou capturas do pacote sem autorização. A licença local permite uso/edição e proíbe redistribuição “as is”; a distribuição no executável ainda requer validação.

