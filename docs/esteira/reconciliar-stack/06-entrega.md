# 06 — Entrega — `reconciliar-stack`

**Branch:** `docs/reconciliar-stack` → PR contra `main`
**Rota:** ADR-001 aprovado → reconciliação documental → Revisor (APROVADO na 2ª rodada) → Entrega. QA não aplicável (só documentação).
**Hashes:** listados nos commits do PR (ver aba *Commits*); o registro não pode conter o próprio hash antes do commit.

## Contexto

A stack desktop foi aprovada no `docs/main/decisoes/ADR-001-stack-desktop-windows.md` (Tauri, React + TypeScript, PixiJS, Python; somente Windows na fase inicial). Vários documentos ainda a tratavam como "candidata" ou "não fechada", o que contradizia a decisão aprovada. Esta entrega alinha os documentos ao ADR-001 e ao ADR-050 (SQLite), sem criar decisão nova.

## O que mudou

- `AGENTS.md`: referência à stack e lista de itens em aberto.
- `docs/main/04-arquitetura.md`: status separando **Aprovada (ADR-001)** de **Proposto / em aberto**. Lista explícita dos itens em aberto: llama.cpp/GGUF, motor de regras, protocolo frontend↔Python, empacotamento do Python, bibliotecas de gerenciamento de modelos, suporte mínimo de hardware e atualização. Banco: SQLite já aprovado no ADR-050; esquema e transações seguem em aberto.
- `docs/main/06-plano-inicial.md`, `docs/main/design/HENDURAN-GDD.md` (linha ~449 ajustada para remeter à stack do ADR-001 e manter a ressalva do tileset; links para `docs/main/decisoes/` corrigidos).
- `docs/ui-ux/README.md`, `docs/ui-ux/02-design-system.md`, `docs/ui-ux/06-guia-implementacao.md`: alinhados à stack aprovada. O 02 separa o que é CONFIRMADO (ADR-001) do que é PROPOSTO (DOM, tokens, grade).
- `docs/backlog.md`: reordenado (primeiro item ⭐ é a decisão de resolução-base, breakpoints e acessibilidade via ADR); item de PoC condicionado a instrução explícita; pendência dos GIFs recuperada; item de superação do ADR-049 incluído; item de links quebrados ampliado (ver abaixo).
- `docs/context/handoff.md` e `docs/context/jornal.md`: estado atual e entrada cronológica da tarefa.
- `docs/esteira/reconciliar-stack/04-revisao.md`: revisão (duas rodadas).

## Decisões

1. **Stack base aprovada:** Tauri, React + TypeScript, PixiJS, Python, somente Windows (ADR-001). Documentos não tratam mais a stack como candidata.
2. **Scaffolding e prova de conceito exigem instrução explícita.** Nenhum código, projeto ou estrutura de app foi criado. A PoC valida a aprovação e resolve motor, protocolo e empacotamento; não é pré-condição para a aprovação do ADR-001.
3. **Itens em aberto** (lista única no `04-arquitetura.md` §status; AGENTS e handoff remetem a ela): llama.cpp/GGUF, motor de regras, protocolo frontend↔Python, empacotamento do Python, bibliotecas de gerenciamento de modelos, suporte mínimo de hardware e atualização. Esquema e transações do SQLite também em aberto.
4. **ADRs não foram reescritos.** O ADR-049 ainda diz que SQLite é "candidato"; a superação pelo ADR-050 está registrada no backlog, não editada no ADR.
5. **Reaproveitamento do Caliope** continua condicionado à auditoria do ADR-016 (não é decisão de stack).

## Validações

- Revisor, rodada 1: MUDANÇAS NECESSÁRIAS (2 bloqueantes: lista de itens em aberto no 04 e contradição no GDD:449). Rodada 2: APROVADO, ambos resolvidos, sem novos bloqueantes.
- `git diff --check`: sem problemas de espaço em branco.
- Conferência de caminhos: `docs/main/decisoes/ADR-001-stack-desktop-windows.md`, `ADR-049`, `ADR-050`, `docs/main/04-arquitetura.md`, `docs/main/06-plano-inicial.md`, `docs/ui-ux/README.md` existem.
- Busca por "stack candidata", "não está fechada", "não está consolidada" fora de `docs/esteira/`: sem ocorrências remanescentes (apenas históricas ou de outros assuntos, conforme 04-revisao).
- QA: não aplicável (documentação, sem código nem testes automatizados no repo).

## Como revisar

1. Abrir `docs/main/04-arquitetura.md` (status no topo) e conferir contra `docs/main/decisoes/ADR-001-stack-desktop-windows.md`.
2. Conferir que `AGENTS.md`, `docs/context/handoff.md` e `docs/main/04-arquitetura.md` têm a mesma lista de itens em aberto.
3. Conferir o GDD linha ~449 e os links de `docs/main/decisoes/`.

## Riscos

- Baixo: somente documentação. Não há alteração de comportamento nem de código.
- Links quebrados remanescentes (pré-existentes) em `README.md`, `AGENTS.md` (lista de leitura), `rules/README.md` e `docs/main/planejamento/BRIEFING-PARA-AGENTES.md`. Não corrigidos aqui; registrados no backlog.
- A PoC, quando autorizada, pode mostrar que alguma escolha do ADR-001 é inviável; nesse caso, novo ADR.

## Pendências (referenciam `docs/backlog.md`)

- ⭐ Decidir e registrar resolução-base, breakpoints e acessibilidade formal (ADR) — próximo passo recomendado.
- Prova de conceito da stack, somente com instrução explícita, e ADRs de motor, protocolo e empacotamento.
- Links quebrados (README, AGENTS.md, rules/README.md, BRIEFING).
- Extrair frames e duração dos seis GIFs Franuka.
- Nota de superação no ADR-049 (SQLite, ADR-050).
- Sugestões não bloqueantes da revisão, não aplicadas: `docs/ui-ux/06-guia-implementacao.md:5` diz que a PoC "fecha os pontos em aberto" (o recorte correto é motor, protocolo e empacotamento); jornal sem a linha do resultado da revisão; `docs/main/04-arquitetura.md` cita Caliope na lista "Aprovada" sem referenciar o ADR-016. Estas três podem entrar num item de backlog de revisão documental, a critério do usuário.

## Artefatos da esteira

- `docs/esteira/reconciliar-stack/04-revisao.md`
- `docs/main/decisoes/ADR-001-stack-desktop-windows.md` (decisão de base)
- `docs/main/decisoes/ADR-050-sqlite-banco-local-principal.md`
- `docs/backlog.md`, `docs/context/handoff.md`, `docs/context/jornal.md`
