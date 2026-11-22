# Notas de desenvolvimento — Mapeamento UI/UX

## Rodada 1

### Tarefas executadas

1. Registradas contagens e integridade Git do pacote comercial; originais permaneceram somente leitura.
2. Lidos GDD, documentos principais e ADRs de testes, mapas, UI, Mundos/Jornadas, diário, continuidades, salvamentos, backup, memória e IA.
3. Criado `scripts/ui-ux/inspect-franuka.ps1`, compatível com Windows PowerShell, sem dependências externas.
4. Extraídos caminho, extensão, bytes, dimensões PNG/GIF, escala, categoria, família e estado de 1.917 arquivos. Contagem/duração de frames GIF foi deliberadamente deixada nula: varredura binária ingênua não é confiável.
5. Confirmadas três sheets agregadas, três TTF, exemplos e ausência de atlas/metadados formais.
6. Agrupadas famílias/estados/escalas no manifesto. Foi executada uma validação estrutural das dimensões entre arquivos individuais pareados pela chave `categoria + família normalizada + estado`: o primeiro exemplar 1x de cada grupo foi comparado aos primeiros 2x e 3x disponíveis, exigindo dimensões exatamente 2× e 3×. A validação não comprova equivalência visual, conteúdo interno nem regiões de composições/sheets.
7. Inspecionadas visualmente `Reference sheet.png`, `UI assets (1x).png` e `Examples/Game mockup.png`, além dos arquivos individuais pelo catálogo.
8. Candidatos a 9-slice limitados às famílias cuja folha de referência marca centro/lados/cantos tileáveis; insets não foram inventados.
9. Registrada paleta descritiva não normativa a partir das três amostras.
10. Criados README e documentos 01–06, com 21 componentes (o pedido diz 20, mas enumera 21), 15 telas, wireframes, 14 fluxos e guia técnico.
11. Gerado catálogo HTML local com filtro textual/escala e 1.913 referências de imagem, sem Base64, thumbnail ou recurso remoto.
12. Atualizado backlog com sequência recomendada e pendências reais.

### Arquivos alterados

- `docs/ui-ux/README.md`, `01-inventario-franuka.md` a `06-guia-implementacao.md`
- `docs/ui-ux/franuka-manifest.json`, `docs/ui-ux/catalogo-franuka.local.html`
- `scripts/ui-ux/inspect-franuka.ps1`
- `docs/backlog.md`
- artefatos da esteira em `docs/esteira/mapeamento-ui-ux/`

### Comandos e resultados

- `./scripts/ui-ux/inspect-franuka.ps1`: passou após duas correções de compatibilidade (substituição de `Path.GetRelativePath`; cast explícito na leitura big-endian). Resultado final: 1.917 = 1.907 PNG + 6 GIF + 3 TTF + 1 TXT.
- inspeção visual local das três amostras: passou; confirmou categorias, linguagem visual e marcações de composição da referência.
- duas execuções consecutivas do inspetor: passou; manifesto e catálogo determinísticos. SHA-256 final do manifesto: `43B042F56C37DF1D73749574BAE222DA7C2162D35F65D23ECD277B037E8C351E`.
- integridade: passou; `total=1917`, soma por extensão `1917`, caminhos únicos `1917`, imagens sem dimensão `0`.
- escalas: passou no escopo estrutural descrito acima; `0` exceções dimensionais nos pares encontrados por `categoria + família + estado`. Permanecem fora do teste a equivalência visual, regiões internas, sheets e grupos ambíguos que exigiriam pareamento semântico/visual.
- atlas: passou; `0` arquivos `.json`, `.xml`, `.plist` ou `.atlas`.
- links Markdown: passou; `0` links relativos quebrados em `docs/ui-ux/*.md`.
- cobertura: passou; `21/21` componentes e `15/15` linhas de telas detectados.
- catálogo: passou; hashes iguais entre execuções, sem `data:image`, Base64 ou URL remota; 1.913 imagens são referenciadas por caminho local.
- licença/integridade Git: passou; `git diff -- assets/tilesets/ui/franuka` vazio e nenhum raster novo fora do diretório comercial.
- não há `package.json`, `pyproject.toml` ou aplicação nesta fase; lint/type-check/testes de produto não se aplicam ao repositório de pré-produção.

### Desvios justificados

- O plano previa frames/duração GIF “quando a API suportar”. O script portátil registra dimensões, mas deixa frames/duração nulos; uma contagem por byte gerava falsos positivos.
- O manifesto textual foi adicionado a `docs/ui-ux/franuka-manifest.json` para provar cobertura exaustiva sem transformar o documento humano em 1.917 linhas.
- Não foi criada página React: a stack ainda não está fechada e o HTML estático atende à auditoria local.

## Rodada 2 — correções da revisão

- Corrigido `02-design-system.md`: React/TypeScript, DOM/PixiJS e tokens de implementação agora estão explicitamente **PROPOSTOS**; somente prioridades de chat/mapa e biblioteca baseada em inventário permanecem **CONFIRMADAS**.
- Corrigida a descrição da validação de escalas nesta nota: documentados chave de agrupamento, seleção dos exemplares, verificação dimensional e limites. Removida a contradição entre “verificação futura” e “passou”.
- Verificações repetidas: busca normativa confirmou a stack candidata no README, design system e guia; validação dimensional retornou novamente `0` exceções no escopo declarado; `git diff --check` não encontrou erro.

