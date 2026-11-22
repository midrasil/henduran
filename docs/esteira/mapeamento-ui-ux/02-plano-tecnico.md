# Plano técnico — Mapeamento completo de UI/UX

## Arquivos afetados

| Caminho | Mudança |
|---|---|
| `docs/ui-ux/README.md` | Índice, escopo, fontes de verdade, legenda `CONFIRMADO`/`PROPOSTO`/`PENDENTE`, aviso de licença e ordem de leitura. |
| `docs/ui-ux/01-inventario-franuka.md` | Inventário auditável do pacote, com estrutura, contagens, dimensões, famílias, estados, escalas, spritesheets, 9-slice, paleta, incertezas e usos sugeridos. |
| `docs/ui-ux/02-design-system.md` | Contratos visuais e comportamentais dos 20 componentes mínimos e alternativas CSS quando o pacote não oferecer solução adequada. |
| `docs/ui-ux/03-mapa-de-telas.md` | Mapa das telas pedidas e das superfícies adicionais exigidas pelo GDD, com estados e prioridades de chat/mapa. |
| `docs/ui-ux/04-wireframes.md` | Wireframes versionáveis em Mermaid/ASCII para narrativa, tática, mapa-múndi e telas estruturantes. |
| `docs/ui-ux/05-fluxos-e-interacoes.md` | Fluxos solicitados com entradas, decisões, cancelamentos, erros, persistência e fronteira IA/motor. |
| `docs/ui-ux/06-guia-implementacao.md` | Organização futura React/TypeScript, sprites, 9-slice, escala, tipografia, responsividade desktop, estados, PixiJS e critérios de aceite. |
| `docs/ui-ux/catalogo-franuka.local.html` | Catálogo estático local, sem dados incorporados: referencia os arquivos comerciais existentes por caminhos relativos e declara que não é publicável isoladamente. |
| `scripts/ui-ux/inspect-franuka.ps1` | Ferramenta determinística de inspeção: lê cabeçalhos/metadados locais, agrupa escalas/estados e gera/verifica os dados do inventário e do catálogo sem modificar/copiar assets. |
| `docs/esteira/mapeamento-ui-ux/03-dev-notas.md` | Evidências da execução: comandos, contagens, decisões de agrupamento, limitações e resultados reais. |
| `docs/backlog.md` | Marcação da tarefa e inclusão ordenada de pendências e próximos passos descobertos. |

Os arquivos em `assets/tilesets/ui/franuka/**` são somente leitura e não devem aparecer como modificados. `docs/main/**`, `rules/**` e ADRs são fontes, não arquivos a editar.

## Abordagem

Construir um inventário em duas camadas: (1) manifesto exaustivo de todos os arquivos suportados, usado para provar cobertura; (2) tabela humana consolidada por família visual, escala e estado, usada para tomar decisões de UI. A inspeção deve extrair dimensões diretamente de PNG/GIF, registrar frames quando possível, identificar TTF e confirmar que não há atlas/metadados adicionais antes de interpretar spritesheets. Regiões de sheets só serão descritas quando grade/limites puderem ser demonstrados pela imagem, pelos arquivos individuais correspondentes ou por metadados; caso contrário, ficam como `PENDENTE`.

O catálogo será HTML estático gerado a partir do manifesto e carregará cada imagem pelo caminho local `../../assets/tilesets/ui/franuka/...`; não haverá Base64, cópia, thumbnail derivada ou publicação dos binários. Filtros por escala, categoria, estado e texto podem ser JavaScript nativo, sem dependências. O catálogo deve falhar de forma legível quando o pacote licenciado não estiver presente.

A especificação parte do GDD e ADRs, preservando os rótulos de decisão. Recomendações de layout, resolução, acessibilidade e composição que ainda não tenham aprovação serão marcadas `PROPOSTO`; lacunas mecânicas serão `PENDENTE`. A implementação futura deve usar DOM/React para texto longo e controles acessíveis, reservando PixiJS aos mapas/tokens. CSS é preferível para superfícies sem sprite apropriado e para estados semânticos/foco, sem deformar pixel art.

Alternativas descartadas:

- Implementar página React agora: exigiria scaffolding/stack ainda não fechada e violaria o escopo.
- Recortar ou gerar thumbnails dos spritesheets: duplicaria/transformaria material comercial e criaria risco de redistribuição.
- Documentar cada cópia 1x/2x/3x como componente distinto: esconderia as famílias e tornaria o documento inutilizável; a cobertura por arquivo permanece no manifesto verificável.
- Inferir 9-slice ou função apenas pelo nome: nomes são evidência auxiliar, não prova; cortes precisam ser validados visualmente e registrados como candidatos quando incertos.

## Tarefas

1. [ ] Registrar hash/contagem inicial do diretório Franuka e confirmar que Git não aponta novos ou alterados assets comerciais.
2. [ ] Ler licença, GDD, documentos principais e ADRs diretamente relacionados a stack, testes, mapas, UI, Mundos/Jornadas, diário, continuidades, salvamentos/backups e memória; montar matriz de rastreabilidade por tela/fluxo.
3. [ ] Criar `scripts/ui-ux/inspect-franuka.ps1` sem dependências novas, com saída estável e caminhos relativos normalizados.
4. [ ] Extrair recursivamente extensão, tamanho em bytes, dimensões, escala declarada, categoria, nome-base e estado; para GIF, registrar dimensões e quantidade/duração de frames quando a API disponível suportar, senão declarar limitação.
5. [ ] Detectar e listar folhas agregadas, imagens de referência/exemplo, fontes e ausência/presença de atlas (`.json`, `.xml`, `.plist`, `.atlas`) ou outros metadados.
6. [ ] Agrupar arquivos individuais por família, estados (`Normal`, `Pressed`, `Selected`, `Outline` etc.) e escalas 1x/2x/3x; validar razões de escala e apontar exceções.
7. [ ] Inspecionar visualmente uma amostra representativa de cada categoria e as folhas agregadas; cruzar regiões identificáveis com arquivos individuais e registrar toda função ambígua como incerteza.
8. [ ] Identificar candidatos a 9-slice por bordas/cantos repetíveis, propondo insets somente quando demonstráveis; classificar os demais como escala fixa, mosaico ou CSS.
9. [ ] Extrair uma paleta descritiva e padrões de pixel art a partir de amostras representativas, deixando claro método, amostra e limites — sem converter a paleta em decisão de gameplay.
10. [ ] Escrever `01-inventario-franuka.md` com estrutura, estatísticas, tabela de famílias, cobertura exaustiva por manifesto/padrões, sheets/regiões, estados, 9-slice, paleta, ausências e aviso de licença.
11. [ ] Gerar `catalogo-franuka.local.html` com filtros e referências relativas aos originais; testar carregamento local, ausência do pacote e inexistência de conteúdo embutido.
12. [ ] Escrever `02-design-system.md`, cobrindo individualmente Button, IconButton, Panel, Window, Dialog, Tabs, Tooltip, TextInput, TextArea, ScrollArea, ProgressBar, ResourceBar, InventorySlot, ItemCard, CharacterCard, CharacterSheet, ChatMessage, ChatInput, DicePrompt, Notification e ContextMenu (21 nomes listados no pedido), com os sete campos exigidos.
13. [ ] Escrever `03-mapa-de-telas.md` para as 15 telas pedidas e adicionar somente superfícies comprovadas pelo GDD (por exemplo, consulta/configuração editorial) quando não forem subestados das telas já listadas.
14. [ ] Escrever `04-wireframes.md` com layouts estruturais desktop para interface principal/narrativa, tática e mapa-múndi, mais wireframes compactos das telas que definem navegação; evitar proporções definitivas.
15. [ ] Escrever `05-fluxos-e-interacoes.md`, incluindo fluxos felizes, recusa/cancelamento, erro e persistência, com destaque para confirmação de testes fora da tática e validação exclusiva pelo motor.
16. [ ] Escrever `06-guia-implementacao.md` com contratos de pastas/componentes futuros, estratégia de spritesheet/arquivos individuais, 9-slice, pixel-perfect, fontes, redimensionamento, estados, React/PixiJS e critérios visuais/funcionais.
17. [ ] Escrever `README.md`, revisar links cruzados, uniformizar vocabulário do GDD e garantir que toda recomendação não aprovada esteja marcada `PROPOSTO` ou `PENDENTE`.
18. [ ] Atualizar `docs/backlog.md` e `03-dev-notas.md` com resultados, pendências reais, decisões da conversa e sequência recomendada de implementação começando pela interface principal da Jornada.
19. [ ] Executar verificações automáticas e auditoria manual do plano de testes; corrigir divergências antes de encaminhar ao Revisor.

## Riscos

- **Volume:** há 1.907 PNG, 6 GIF, 3 TTF e 1 TXT no pacote. Uma linha narrativa por cópia seria excessiva; o manifesto precisa provar cobertura enquanto a tabela consolida famílias sem perder rastreabilidade.
- **API de imagem no Windows:** GDI+ pode falhar ao consultar dimensão de frames em PNG ou alguns GIFs. O script deve usar leitura segura de cabeçalho para dimensões e tratar animação separadamente, sem depender de erro ruidoso por arquivo.
- **Ausência de atlas formal:** os três `UI assets (1x/2x/3x).png` podem ser spritesheets visuais sem metadados de regiões. Não gerar coordenadas por suposição; preferir arquivos individuais para implementação.
- **Licença/redistribuição:** o pacote é comercial. Mesmo referências relativas no catálogo devem carregar aviso local; nenhum asset, recorte, Base64 ou captura deve ser adicionado aos documentos/PR.
- **Direção visual versus legibilidade:** fontes pixel em tamanho nativo podem ser inadequadas para chat longo. O documento deve propor fallback legível e zoom inteiro, sem declarar como aprovado.
- **9-slice:** assets decorativos nem sempre toleram estiramento. Insets devem ser candidatos validados, não contratos definitivos.
- **Stack proposta:** React/Tauri/PixiJS ainda depende de validação formal da stack; o guia é recomendação coerente com a arquitetura candidata, não autorização para scaffolding.
- **Mecânicas pendentes:** detalhes de combate, confirmação em tática, escalas de mapas, resolução-base e layout da árvore não podem ser cristalizados por wireframes.
- **Escopo de telas:** o GDD contém recursos editoriais, importação/versionamento de Mundos e memória; devem ser incorporados como subfluxos ou telas apenas quando a fonte exigir, evitando inflar navegação.
- **Mermaid/renderização:** diagramas grandes podem não renderizar em todos os visualizadores Markdown. Manter nós simples e oferecer sequência textual equivalente.

## Plano de testes

| Verificação | Critérios do PRD |
|---|---|
| Rodar o inspetor duas vezes e comparar saída/hash; conferir `total detectado = PNG + GIF + TTF + TXT` e ausência de caminhos duplicados. | CA-1, CA-12 |
| Conferir amostra estratificada por categoria/escala/estado e todas as exceções de dimensão; validar visualmente sheets e GIFs. | CA-1, CA-2 |
| Comparar `git diff -- assets/tilesets/ui/franuka` e `git status --short`; buscar `data:image`, Base64 e cópias raster fora do diretório licenciado. | CA-3, CA-12 |
| Validar que cada família do manifesto aparece na tabela ou numa seção explícita de não mapeados/incertos. | CA-1, CA-2, CA-10 |
| Checklist automatizado dos 21 componentes e dos sete campos obrigatórios por componente. O pedido diz “20”, mas enumera 21; cobrir todos é a interpretação conservadora. | CA-4, CA-10 |
| Checklist das 15 telas e de objetivo, componentes, hierarquia, regiões, navegação, vazio/carregando/erro e prioridade chat/mapa. | CA-5 |
| Revisão semântica dos wireframes: narrativa com chat dominante, tática com mapa dominante e chat acessível, mapa-múndi separado, sem HUD excessiva. | CA-6 |
| Percorrer fluxos como máquinas de estado; verificar proposta → confirmação/recusa → motor → resultado no teste fora da tática e efeitos persistentes nos demais. | CA-7, CA-8 |
| Checklist do guia: React/TS, sprites, CSS/9-slice, pixel-perfect, tipografia, redimensionamento, estados, PixiJS, separação UI/motor e zero biblioteca nova. | CA-9 |
| Buscar rótulos normativos e frases sem fonte; toda lacuna deve estar em `PROPOSTO`/`PENDENTE` e toda afirmação `CONFIRMADO` deve apontar para GDD/ADR. | CA-10 |
| Verificador de links Markdown relativos e teste de abertura do catálogo a partir do repositório; testar filtros e mensagem quando os assets faltarem. | CA-11, CA-12 |
| Validar HTML (estrutura, caminhos escapados, sem recursos remotos/embutidos) e verificar que imagens carregadas apontam somente para `assets/tilesets/ui/franuka`. | CA-3, CA-11, CA-12 |
| Registrar comandos, versões, saídas e limitações reais em `03-dev-notas.md`; não declarar verificações não executadas. | CA-12 |

