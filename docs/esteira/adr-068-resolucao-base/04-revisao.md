# Revisão — `adr-068-resolucao-base`

## Rodada 1 — 2026-11-22

Escopo revisado: `docs/main/decisoes/ADR-068-resolucao-redimensionamento-acessibilidade-ui.md` (novo), `docs/backlog.md`, `docs/context/handoff.md`, `docs/context/jornal.md` (diff contra `b50c6bc`), comparados com `02-plano-tecnico.md`, ADR-001, ADR-017, ADR-020, GDD, `docs/ui-ux/02-design-system.md`, `docs/ui-ux/06-guia-implementacao.md`, `docs/ui-ux/04-wireframes.md`, `AGENTS.md` e o estado de `origin/main` (PR #2 já mergeado em `0b699f3`).

Não há 01-prd nem 03-dev-notas nesta rota (ADR escrito pelo orquestrador); a referência é o plano técnico e a escolha declarada do responsável (B + AC-2).

### Veredito: MUDANÇAS NECESSÁRIAS

O núcleo da decisão está fiel ao plano e não inventa valores numéricos. Os bloqueantes são de precisão do registro e de consistência dos arquivos de contexto com a `main` atual.

### Bloqueantes

1. **Branch desatualizada em relação a `origin/main`; handoff afirma algo falso.** `docs/context/handoff.md:9` diz que o PR #2 (`docs/reconciliar-stack`) ainda será mergeado ("ao mergear o segundo..."), mas ele já está em `origin/main` (`0b699f3`). A branch parte de `b50c6bc`, e o backlog desta branch foi derivado da versão anterior ao PR #2. Na `main` o backlog já tem `⭐ design: decidir ... (ADR)`, `infra: ... prova de conceito da stack aprovada ...`, o slice `feat` condicionado "depois do ADR de resolução" e dois itens novos (GIFs e nota no ADR-049) que este diff não contém. **Correção:** rebase/merge de `origin/main` antes da entrega. Reconciliar `backlog.md`, `handoff.md` e `jornal.md` mantendo as entradas do PR #2. Marcar como concluído o item `design` da `main`. Fundir a PoC do ADR-068 com o item de PoC da stack (ou ligar uma à outra explicitamente), e remover do handoff a frase sobre o merge pendente.

2. **A alternativa AC-1 está descrita de forma inexata.** `ADR-068...md:33` diz que AC-1 é "incluindo alternativa para todo o canvas: mais abrangente e mais cara". No plano (`02-plano-tecnico.md:180-187`), AC-1 e AC-2 exigem igualmente alternativa para a informação essencial do canvas; AC-2 é "igual a AC-1" mais o alvo de 44 px e o reduced motion obrigatório. O que de fato distingue AC-1 é o alvo de 24 px (SC 2.5.8), sem reduced motion obrigatório, e a menção a teste manual com leitor de tela. **Correção:** reescrever AC-1 conforme o plano, por exemplo: "WCAG 2.2 AA no DOM com alvo mínimo de 24 px (SC 2.5.8), reduced motion não obrigatório e teste manual com leitor de tela; mesma alternativa DOM para o canvas".

3. **"Reflow e zoom de texto em 200%" confunde dois critérios WCAG e esconde uma tensão com a janela mínima.** `ADR-068...md:24`: no WCAG 2.2, o redimensionamento de texto em 200% é o SC 1.4.4. Reflow é o SC 1.4.10, que exige conteúdo sem rolagem bidimensional em 320 CSS px de largura, com exceção para conteúdo que precisa de layout 2D, como mapas. Ao declarar AA, o ADR herda o 1.4.10, e isso interage com o "tamanho mínimo da janela", que está pendente. **Correção:** citar os dois critérios corretamente (1.4.4 texto em 200%; 1.4.10 reflow, com a exceção 2D para o viewport do mapa) e acrescentar em Pendências: "conciliar a janela mínima e os breakpoints com o SC 1.4.10". Não é preciso fixar valor.

4. **"Resolve o conflito Button 32 vs 44 px" vai além da decisão aprovada.** `ADR-068...md:42`. Avaliação pedida: a extrapolação é **parcialmente aceitável**. Que o alvo de controles primários seja 44 CSS px decorre diretamente do AC-2, que o responsável escolheu (`02-plano-tecnico.md:231`). Mas "resolve" vai além disso, por quatro motivos:
   - em `02-design-system.md:13`, ≥32 px é a **altura visual** e 44 px é o **alvo de interação**. Um botão de 32 px pode ter área de toque de 44 px, e o ADR não decide qual das duas leituras vale;
   - "controle primário" não está definido;
   - IconButton (32–48), Tabs (≥32) e InventorySlot (32/48) ficam sem regra. Pelo AA, eles têm no mínimo 24 px (SC 2.5.8), o que o ADR não diz;
   - o 44 px corresponde ao SC 2.5.5, que é AAA. Vale registrar que é um requisito interno acima do AA.

   Como o próximo item do backlog (propagação via `dev-economico`) vai editar `02-design-system.md` com base nesta linha, a redação ambígua tende a virar "altura mínima de Button = 44 px", o que ninguém aprovou. **Correção:** trocar por "define alvo de interação ≥ 44 CSS px para controles primários (requisito interno, acima do SC 2.5.8 do AA); demais alvos ≥ 24 CSS px pelo AA. A altura visual mínima do Button, a definição de 'controle primário' e os tamanhos de IconButton/Tabs/InventorySlot ficam pendentes da prova de conceito" e incluir isso em Pendências.

5. **A lista de propagação diverge entre o ADR e o backlog e está incompleta.** `ADR-068...md:51` inclui `docs/main/04-arquitetura.md`, mas o item ⭐ do backlog (`backlog.md:3`) não inclui. Nenhum dos dois inclui o histórico de versões do GDD (plano, seção 6, item 3) nem a contagem "67 ADRs (ADR-001 a ADR-067)" em `HENDURAN-GDD.md:644`, que fica desatualizada com o ADR-068. Também ficam de fora `docs/ui-ux/01-inventario-franuka.md` (orbs, condicional) e `docs/ui-ux/README.md` (plano, itens 9 e 10). **Correção:** igualar as duas listas e acrescentar GDD linha 644 e histórico, `04-arquitetura.md` e, como condicional, `01-inventario` e o README de ui-ux.

### Sugestões (não bloqueantes)

- O GDD (`HENDURAN-GDD.md:642-644`) encerrou a rodada de decisões individuais, com exceção para decisões "bloqueadoras" ou que "exijam validação do autor". Vale uma linha no Contexto do ADR-068 dizendo por que ele é uma exceção (bloqueia o slice da UI; escolha validada pelo autor), para não parecer contradição de processo.
- O campo **Questão** não tem número P (P-13 e P-18 já estão RESOLVIDAS). Considerar dizer explicitamente "sem nova questão P; complementa P-13/P-18", ou abrir P-68, conforme a convenção do GDD.
- Acrescentar uma seção **Relações** (ADR-001, ADR-005, ADR-017, ADR-020, ADR-042), no padrão do ADR-020.
- `ADR-068...md:27`: a árvore de continuidades aparece como "canvas", mas a forma de renderização não está decidida. Sugere-se "(quando renderizada em canvas)". A exigência de lista alternativa já está em `04-wireframes.md:103`, o que é coerente.
- Jornal (`jornal.md`, nova entrada): diz "ADR-068 aprovado" e registra uma rota que inclui Revisor/Entrega, mas não tem a linha de validações exigida pelo `AGENTS.md`. Completar na entrega com o resultado desta revisão.
- Handoff: "Artefatos ... (plano técnico, revisão, entrega)" cita arquivos que ainda não existiam. Tudo bem se for atualizado na entrega.
- O ADR-068 usa "Estado: Aprovada" e "Origem: Escolha explícita do responsável", sem citar a fala do autor. O ADR-001 registra a citação. Se houver uma frase do responsável, registrá-la reforça a rastreabilidade.

### Pontos positivos

- A decisão segue fielmente a Alternativa B com os dois ajustes do plano (variantes inteiras por DPI e tamanho, sem zoom fracionário nem interpolação; escala de texto independente) e o AC-2 com seus quatro elementos.
- Nenhum valor numérico novo foi inventado. Janela mínima, breakpoints, proporções, texto base e viewport tático estão explicitamente pendentes de prova de conceito.
- A aritmética de DPI está marcada como "proposta, não medida". A paleta Franuka é declarada não normativa e o contraste é medido no DOM.
- Coerente com o ADR-001 (Tauri/React/PixiJS, Windows), com o ADR-017 (critério 4 passa a ter referência) e com o ADR-020 (o ADR não fixa proporções).
- AGENTS.md: nenhuma mecânica, Competência ou Capacidade. A prova de conceito fica condicionada a instrução explícita. Não há decisão de produto silenciosa, porque as alternativas rejeitadas estão registradas e a escolha é atribuída ao responsável.

## Rodada 2 — 2026-11-22

Escopo: `git diff origin/main` (HEAD = `origin/main` = `0b699f3`; só `backlog.md`, `handoff.md` e `jornal.md` modificados, mais os não rastreados `ADR-068...md` e `docs/esteira/adr-068-resolucao-base/`). Nada fora do esperado; `git diff --check` limpo.

### Veredito: APROVADO

### Bloqueantes da Rodada 1

1. **Resolvido.** A branch está em `origin/main`. O backlog mantém os itens do PR #2 (links quebrados com o rótulo de arquitetura, GIFs, nota no ADR-049, slice `feat`). O item `design` foi marcado `[x]` e a PoC do ADR-068 foi incorporada ao item `infra` da PoC da stack (`backlog.md:7`). O handoff não fala mais em merge pendente. O jornal preserva a entrada do PR #2. As pendências que saíram do handoff (assets, GIFs, ADR-049) continuam no backlog (linhas 12, 16 e 17), o que é coerente com o papel do handoff, que registra só o estado atual.
2. **Resolvido.** A AC-1 (`ADR-068...md:35`) tem agora alvo de 24 px, reduced motion não obrigatório, teste com leitor de tela e a mesma alternativa DOM, como no plano (linhas 178-182).
3. **Resolvido.** `ADR-068...md:26` cita o SC 1.4.4 e o SC 1.4.10 com a exceção para conteúdo 2D. A pendência de conciliar a janela mínima com o 1.4.10 está na linha 48 e em `backlog.md:4`.
4. **Resolvido.** `ADR-068...md:27` e `:44`: o alvo de 44 px é declarado requisito interno, os demais alvos ficam em 24 px pelo SC 2.5.8, e o texto separa altura visual de área de interação, o que bate com `02-design-system.md:13`. A definição de "controles primários" e das alturas visuais está em Pendências (linha 49) e no backlog (linha 4).
5. **Resolvido.** As listas de propagação de `ADR-068...md:55` e de `backlog.md:3` são idênticas e incluem 04-arquitetura, a contagem do GDD:644, o histórico de versões, o 01-inventario (condicional) e o README. O item do backlog traz o alerta "sem transformar alvo 44 px em altura mínima de Button".

Não encontrei contradições novas entre o ADR, o backlog, o handoff e o jornal.

### Sugestões (não bloqueantes)

- `backlog.md:6`: "valores numéricos seguem pendentes abaixo", mas os itens estão acima (linhas 4-5) e abaixo (linha 7). Trocar por "nos itens design/infra".
- `backlog.md:8`: a condição "depois do ADR de resolução" já foi cumprida. Pode virar "depois da PoC/valores do ADR-068", se for essa a intenção. Não mude sem confirmar com o responsável.
- No plano há uma inconsistência herdada: a AC-1 já inclui teste com leitor de tela e a AC-2 é "igual a AC-1", mas a AC-4 é "AC-2 + leitor de tela". O ADR resolve de forma razoável, deixando o leitor de tela fora do requisito inicial (linha 51). Vale uma frase no ADR ou na entrega registrando que a AC-2 adotada não herda o teste manual da AC-1.
- Na Relações, ADR-005 e ADR-042 (sugeridos na Rodada 1) seguem fora. Inclua só se forem de fato relacionados.
- Na entrega, o jornal deve atualizar "2ª rodada em andamento" para o resultado final, e o handoff deve listar a entrega entre os artefatos.

### Pontos positivos

- As correções ficaram cirúrgicas e não ampliaram o escopo da decisão. Nenhum valor numérico novo.
- Agora a propagação tem uma lista única e verificável, com proteção explícita contra a leitura errada do alvo de 44 px.
