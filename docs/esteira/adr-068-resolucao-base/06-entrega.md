# Entrega — `adr-068-resolucao-base`

- **Data:** 2026-11-22
- **Branch:** `docs/adr-068-resolucao-base` (criada a partir de `origin/main` em `0b699f3`)
- **Base do PR:** `main`
- **Rota:** ADR/decisão → orquestrador escreve → Revisor (2 rodadas) → Entrega. QA não aplicável (somente documentação).

## Resumo

Registra a política de resolução-base, redimensionamento e acessibilidade formal da UI, pendente desde as ADR-017 e ADR-020 e exigida pelas questões P-13 e P-18 do GDD (que ficaram resolvidas com ressalvas). A decisão é escolha explícita do responsável pelo Henduran, feita a partir do levantamento técnico em `02-plano-tecnico.md`.

## Decisões registradas (ADR-068)

**Resolução e redimensionamento (alternativa B):**
- Sem resolução lógica fixa nem letterbox; layout fluido em CSS, com múltiplos de 8 CSS px.
- Sprites com variantes inteiras 1x, 2x ou 3x, escolhidas pelo DPI efetivo e pelo tamanho-alvo; nunca zoom fracionário nem interpolação entre variantes.
- Texto DOM não escala junto com a arte; controle independente de escala de texto do usuário.
- DOM governa o shell; canvas PixiJS é redimensionado por observação do contêiner e preserva a câmera.
- Pixel perfeito garantido só em DPI 100% e 200%; em 125% e 150% o objetivo é nitidez sem deformar o raster.

**Acessibilidade (AC-2):**
- DOM em WCAG 2.2 AA: contraste 4,5:1 (texto) e 3:1 (componentes não textuais), foco visível, teclado completo, texto ampliável a 200% (SC 1.4.4), reflow em 320 CSS px com exceção 2D para mapas (SC 1.4.10), mensagens não dependentes só de cor.
- Alvo de interação ≥ 44 CSS px para controles primários (requisito interno, acima do AA); demais alvos ≥ 24 CSS px (SC 2.5.8).
- `prefers-reduced-motion` obrigatório.
- Informação essencial do canvas com equivalente DOM navegável por teclado; o canvas em si fica fora da conformidade formal.

**Não decidido (fica para prova de conceito, ver pendências):** janela mínima, breakpoints, proporção de painéis, texto base do chat, viewport tático mínimo, altura visual dos controles e definição de "controles primários".

## Arquivos alterados

- `docs/main/decisoes/ADR-068-resolucao-redimensionamento-acessibilidade-ui.md` (novo)
- `docs/esteira/adr-068-resolucao-base/02-plano-tecnico.md` (novo)
- `docs/esteira/adr-068-resolucao-base/04-revisao.md` (novo)
- `docs/esteira/adr-068-resolucao-base/06-entrega.md` (novo, este arquivo)
- `docs/backlog.md` (propagação do ADR-068 e pendências de design/infra; item `design` marcado como concluído)
- `docs/context/handoff.md` (estado atual)
- `docs/context/jornal.md` (entrada da tarefa)

## Commits

Os hashes são os da própria branch (`git log --oneline origin/main..HEAD`) e foram informados no relatório de entrega. Este arquivo não os contém para evitar reescrever o commit que o registra.

1. `docs(adr): define resolução-base, redimensionamento e acessibilidade da UI no ADR-068`: ADR-068.
2. `docs(esteira): registra plano, revisão e entrega do adr-068 no backlog e handoff`: artefatos da esteira, backlog, handoff e jornal.

## Validações

- `git diff --check` contra `origin/main`: sem erros de espaço em branco.
- Revisor (`04-revisao.md`): reprovado na 1ª rodada com 5 bloqueantes (branch desatualizada em relação ao PR #2, descrição de AC-1, critérios WCAG 1.4.4/1.4.10, extrapolação do alvo de 44 px, listas de propagação divergentes); todos resolvidos. Aprovado na 2ª rodada.
- QA: não aplicável (sem código, sem testes executáveis). Nenhum teste foi executado.
- Conferido: `graphify-out/` está ignorado pelo `.gitignore` (linha 16) e não entra nos commits.

## Como revisar

1. Ler o ADR-068, em especial a seção "Decisão aprovada" e "Pendências".
2. Conferir que a propagação em `backlog.md` (primeiro item) e o ADR têm a mesma lista de documentos.
3. Confirmar que o alvo de 44 px não está sendo lido como altura mínima do Button.

## Riscos

- **Leitura errada do alvo de 44 px:** o design system trata 32 px como altura visual. A propagação precisa separar altura visual de área de interação (alerta já no backlog).
- **Conflito de DPI fracionário:** 125% e 150% não têm pixel perfeito por construção; a aceitação é visual até a prova de conceito.
- **Valores ainda indefinidos:** janela mínima, breakpoints e viewport tático podem conflitar com a densidade do chat e da tática; só serão fixados com medição em shell Tauri.
- **Contexto da exceção:** o GDD encerrou a rodada sequencial de decisões; este ADR é exceção pontual por bloquear telas (registrado no Contexto).

## Pendências

Estão no `docs/backlog.md`:
- Propagação do ADR-068 (primeiro item, marcado ⭐).
- Conciliar janela mínima e breakpoints com o SC 1.4.10; definir "controles primários" e alturas visuais.
- Reconferir orbs (48–240 px vs 48–80 px) e a regra de antialiasing da fonte na licença Franuka.
- Prova de conceito da stack com medições de DPI, sob instrução explícita.

## Links para a esteira

- Decisão: `docs/main/decisoes/ADR-068-resolucao-redimensionamento-acessibilidade-ui.md`
- Plano técnico: `docs/esteira/adr-068-resolucao-base/02-plano-tecnico.md`
- Revisão: `docs/esteira/adr-068-resolucao-base/04-revisao.md`
- Backlog: `docs/backlog.md`
- Handoff: `docs/context/handoff.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
