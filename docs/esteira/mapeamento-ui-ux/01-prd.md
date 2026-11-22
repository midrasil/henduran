# PRD — Mapeamento completo de UI/UX

## Problema

O Henduran possui decisões aprovadas para uma experiência desktop centrada em chat, modos táticos com mapa predominante e identidade pixel art baseada no pacote comercial Franuka, mas ainda não dispõe de uma especificação visual auditável. Sem um inventário real dos assets e um mapa coerente de componentes, telas e fluxos, agentes futuros tenderiam a reinventar padrões, presumir sprites inexistentes ou contrariar ADRs.

## Objetivo

Produzir uma especificação versionada e rastreável que permita implementar a UI do Henduran a partir dos assets locais reais, sem decidir gameplay, redistribuir material comercial ou construir telas definitivas.

## Escopo

### Entra

- Inspeção recursiva de `assets/tilesets/ui/franuka`, preservando os originais, com estrutura, formatos, dimensões, estados, composições, 9-slice, paleta e incertezas.
- `docs/ui-ux/README.md` e os seis documentos solicitados: inventário, design system, mapa de telas, wireframes, fluxos/interações e guia de implementação.
- Relação explícita entre evidência dos assets, GDD/ADRs e usos sugeridos, distinguindo **CONFIRMADO** de **PROPOSTO**.
- Catálogo visual exclusivamente local, se viável, que referencie arquivos existentes sem duplicá-los.
- Cobertura das telas, componentes e fluxos enumerados pelo usuário, acrescida somente do que o GDD exigir.
- Artefatos da esteira, atualização de `docs/backlog.md`, revisão, QA documental e entrega em branch/PR próprios.
- Restrições confirmadas: chat predominante em cenas narrativas; mapa localizado predominante e chat secundário em situações táticas; mapa-múndi hexagonal separado; teste fora do tático somente após confirmação; IA propõe e motor valida; árvore de continuidades sem mistura de estados.

### Não entra

- Implementação das telas definitivas, scaffolding relevante da aplicação ou mudanças no motor/regras.
- Alteração de GDD, ADRs ou decisões de gameplay; Competências e Capacidades permanecem fora da primeira fase.
- Criação, edição, cópia ou redistribuição dos assets Franuka; publicação do catálogo com arquivos incorporados.
- Escolha definitiva de proporções, resolução-base, política de confirmação tática, mecânicas de combate ou parâmetros ainda pendentes.
- Inclusão automática de biblioteca nova, assets suplementares ou integrações externas.

## Histórias de usuário

- Como agente de implementação, quero localizar cada componente e sua evidência visual para construir telas sem reinventar o design.
- Como designer de interface, quero distinguir o que o pacote suporta do que exige CSS ou novos assets para manter coerência e honestidade visual.
- Como jogador, quero que chat, mapas e painéis mudem de prioridade conforme o contexto sem perder histórico, estado ou legibilidade.
- Como responsável pelo projeto, quero uma especificação rastreável às ADRs e à licença para evitar decisões não aprovadas e redistribuição indevida.
- Como QA, quero critérios visuais e funcionais verificáveis para validar futuras implementações.

## Critérios de aceite

1. **Dado** o diretório Franuka, **quando** o inventário for auditado, **então** todos os arquivos suportados serão contabilizados recursivamente por caminho relativo, formato e dimensão, com famílias/estados consolidados e incertezas declaradas.
2. **Dado** um elemento visual descrito, **quando** sua linha do inventário for consultada, **então** haverá identificador, caminho, dimensões, categoria, estados, uso sugerido e limitações, sem atribuir função não comprovada como fato.
3. **Dado** o pacote comercial, **quando** documentação e catálogo forem gerados, **então** os originais permanecerão inalterados e serão apenas referenciados localmente; nenhuma cópia será adicionada aos entregáveis públicos.
4. **Dado** o design system, **quando** os 20 componentes mínimos forem revisados, **então** cada um documentará função, composição/sprite, dimensões, estados, comportamento, reutilização e acessibilidade, indicando CSS/asset adicional quando necessário.
5. **Dadas** as telas solicitadas e o GDD, **quando** o mapa de telas for revisado, **então** cada tela terá objetivo, componentes, hierarquia, regiões, navegação, estados vazio/carregando/erro e relação entre chat, mapa e auxiliares.
6. **Dadas** as interfaces narrativa, tática e mapa-múndi, **quando** os wireframes forem lidos, **então** chat predominará no narrativo, mapa localizado predominará no tático sem eliminar o chat e o mapa-múndi permanecerá um modo separado, sem composição típica de MMORPG excessivo.
7. **Dado** o fluxo de teste fora do tático, **quando** ele for documentado, **então** a proposta aparecerá antes de qualquer rolagem, confirmação e recusa estarão explícitas e somente o motor validará/aplicará resultado ou efeito.
8. **Dados** os demais fluxos solicitados, **quando** percorridos, **então** entradas, decisões, estados de sucesso/erro/cancelamento e efeitos persistentes serão identificáveis, sem preencher lacunas de gameplay com invenções.
9. **Dado** o guia técnico, **quando** outro agente planejar a implementação, **então** encontrará organização React/TypeScript, spritesheets, CSS/9-slice, escala pixel-perfect, tipografia, redimensionamento, estados, integração PixiJS e separação UI/motor, sem dependências novas injustificadas.
10. **Dada** qualquer lacuna documental ou visual, **quando** registrada, **então** estará marcada como **PROPOSTO** ou **PENDENTE**, separada de requisitos **CONFIRMADOS** e acompanhada do impacto.
11. **Dado** o conjunto final, **quando** QA verificar os links e referências, **então** `docs/ui-ux/README.md` navegará para todos os seis documentos, sem links locais quebrados.
12. **Dada** a entrega, **quando** as verificações disponíveis forem executadas, **então** seus comandos e resultados reais serão registrados, incluindo contagem/integridade do inventário, validação de Markdown/catálogo e `git status` sem assets comerciais novos.

## Dúvidas em aberto

- **Não bloqueia esta especificação:** resolução-base, proporções exatas dos painéis e requisitos formais de acessibilidade continuam pendentes; o trabalho deve registrar recomendações como **PROPOSTO**.
- **Não bloqueia esta especificação:** a licença local permite uso comercial/não comercial e edição, mas proíbe redistribuição “as is”; a forma de distribuir assets dentro do executável e um eventual repositório público requer validação jurídica/operacional posterior.
- **Não bloqueia esta especificação:** política de confirmação dentro do modo tático, detalhes de combate, escalas do mapa e metadados/layout final da árvore de continuidades não estão aprovados; wireframes não devem convertê-los em regra.
