# Ajuste dos registros de contexto da esteira

Você está trabalhando no repositório Henduran, na branch `docs/mapeamento-ui-ux`.

## Objetivo

Tornar `docs/context/handoff.md` e `docs/context/jornal.md` registros obrigatórios do fechamento de toda tarefa da esteira e preencher ambos com a entrega já concluída do mapeamento UI/UX.

## Tarefas exatas

1. Edite `AGENTS.md`, acrescentando ao método de trabalho uma seção curta sobre memória operacional da esteira:
   - `docs/context/jornal.md` é um registro cronológico, cumulativo e conciso; deve receber uma entrada durante ou no fechamento de cada tarefa com data, slug, rota, resultado, validações e ocorrências relevantes.
   - `docs/context/handoff.md` representa somente o estado atual para retomada; deve ser substituído/atualizado ao fechar cada tarefa com estado, branch/PR, artefatos, validações, pendências e próximo passo recomendado.
   - `docs/backlog.md` continua sendo a lista autoritativa e ordenada de pendências. Handoff e jornal podem referenciar itens, mas não devem criar backlog paralelo.
2. Preencha `docs/context/handoff.md` com o estado atual da entrega `mapeamento-ui-ux`, usando `docs/esteira/mapeamento-ui-ux/06-entrega.md`: branch `docs/mapeamento-ui-ux`, commits `1bfa7e3` e `08c2c6d`, PR #1 `https://github.com/midrasil/henduran/pull/1`, revisão aprovada na segunda rodada, QA passou 12/12, principais artefatos, riscos/pendências e próximo passo recomendado.
3. Acrescente em `docs/context/jornal.md` uma primeira entrada cronológica datada de 2026-11-22 para o slug `mapeamento-ui-ux`, resumindo rota, inventário (1.917 arquivos), entregáveis, revisão/QA, commits e PR. Explique no cabeçalho que o arquivo é cumulativo e não substitui o backlog.
4. Atualize `docs/esteira/mapeamento-ui-ux/06-entrega.md` para registrar a decisão de que handoff e jornal passam a integrar obrigatoriamente o fechamento da esteira e inclua ambos na lista de artefatos.
5. Não altere `docs/backlog.md` a menos que seja estritamente necessário; os próximos passos já estão corretos e ele deve continuar autoritativo.

## Restrições

- Não mexa em outros arquivos além de `AGENTS.md`, `docs/context/handoff.md`, `docs/context/jornal.md` e `docs/esteira/mapeamento-ui-ux/06-entrega.md`.
- Não faça commit, push ou merge.
- Não instale dependências.
- Preserve UTF-8 e o estilo Markdown existente.
- Não invente estados, decisões ou resultados além dos dados fornecidos e do conteúdo de `06-entrega.md`.

## Verificação final

Execute:

```powershell
git diff --check
git status --short
rg -n "handoff|jornal|backlog|mapeamento-ui-ux|pull/1" AGENTS.md docs/context docs/esteira/mapeamento-ui-ux/06-entrega.md
```

Relate os arquivos alterados e o resultado das verificações.
