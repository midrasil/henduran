# Backlog

- [ ] ⭐ docs: propagar o ADR-069 (UI em CSS sem tileset) em GDD IX, P-18 e D-033, ADR-020 e `docs/ui-ux/` (02-design-system e demais), marcando o catálogo Franuka como referência não normativa; fazer em conjunto com a propagação do ADR-068 abaixo — origem: ADR-069
- [ ] design: definir tokens (paleta, bordas, sombras, espaçamento) e fontes (pixel para títulos/HUD, legível para chat) — origem: ADR-069
- [ ] infra: página de componentes como prova visual inicial, após scaffolding aprovado — origem: ADR-069
- [ ] ⭐ docs: propagar o ADR-068 (referência cruzada em ADR-017 e ADR-020; GDD IX.2, IX.4, IX.5, linha 42, P-13, P-18, contagem de ADRs na linha 644 e histórico de versões; docs/ui-ux 01 (orbs, se confirmado), 02, 03, 04, 05, 06 e README; docs/main/04-arquitetura.md) sem transformar "alvo 44 px" em altura mínima de Button — origem: ADR-068; rota: `dev-economico` → `revisor`
- [ ] design: conciliar janela mínima e breakpoints com o SC 1.4.10 (reflow em 320 CSS px) e definir "controles primários" e alturas visuais — origem: pendências do ADR-068
- [ ] docs: reconferir no manifesto a faixa de dimensão das orbs (48–240 px vs 48–80 px) e a regra de antialiasing da fonte na licença — origem: pendências do ADR-068
- [x] design: decidir e registrar resolução-base, breakpoints e acessibilidade formal — decidido no ADR-068 (política); valores numéricos seguem pendentes nos itens de design e infra desta lista
- [ ] infra: com instrução explícita, executar a prova de conceito da stack aprovada (chat com streaming, UI pixel art, empacotamento Windows) e registrar ADRs de motor, protocolo e empacotamento; na mesma prova, medir telas narrativa e tática em 100%, 125%, 150% e 200% de DPI para fixar janela mínima, breakpoints, proporção de painéis, texto base do chat e viewport tático mínimo — origem: ADR-001, reconciliação da stack e ADR-068
- [ ] feat: implementar o primeiro slice da interface principal da Jornada a partir da especificação UI/UX — origem: mapeamento UI/UX; rota completa de feature, depois do ADR de resolução e da decisão sobre a prova de conceito
- [ ] docs: atualizar o grafo com os documentos usando `/graphify . --update` — origem: mapeamento UI/UX; opcional, consome tokens
- [ ] feat: implementar DicePrompt fora da tática com confirmação explícita e motor determinístico — origem: mapeamento UI/UX e ADR-006
- [ ] test: validar escala pixel-perfect, foco, teclado, zoom e legibilidade das fontes em Windows — origem: mapeamento UI/UX
- [ ] legal: validar distribuição dos assets Franuka dentro do executável e política do repositório público — origem: licença comercial Franuka
- [ ] docs: corrigir links quebrados para `docs/main/` no README (trocar também o rótulo "Arquitetura proposta"), na lista de leitura de `AGENTS.md` (linhas 55-60), em `rules/README.md:16` e o caminho `docs/decisoes/` em `docs/main/planejamento/BRIEFING-PARA-AGENTES.md` — origem: entrega inicial; revisão da reconciliação da stack
- [x] docs: registrar referência/licença do pacote de UI sem redistribuir os arquivos — origem: decisão de licença Franuka
- [ ] infra: confirmar com o autor da Franuka a autorização para publicar os assets — origem: ADR-017 e licença local
- [ ] docs: extrair frames e duração dos seis GIFs Franuka — origem: mapeamento UI/UX
- [ ] docs: registrar nota de superação no ADR-049 (SQLite deixou de ser candidato com o ADR-050) — origem: revisão da reconciliação da stack
