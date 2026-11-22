# Auditoria técnica do Caliope (ADR-016)

- **Data:** 2026-11-22
- **Repositório:** `CODED-Xavier/Caliope`, commit `1cab9e0` (v2.30.0), clonado em pasta temporária, somente leitura.
- **Escopo:** quais módulos podem ser reaproveitados no Henduran, com que adaptação, e quais não devem entrar.
- **Método e limites:** li a estrutura, dependências, docstrings e interfaces públicas dos módulos de IA. **Não li todas as implementações e não executei os testes do Caliope.** Cada módulo escolhido precisa de leitura completa e de testes rodando antes da importação.

## 1. Licença e autorização

- O repositório **não tem arquivo de licença** (a API do GitHub retorna `license: null`).
- O autor, amigo do responsável pelo Henduran, **autorizou o uso do código** (confirmação verbal, relatada pelo responsável em 2026-11-22).
- Pendências: registrar a confirmação por escrito (mensagem salva ou nota assinada) e pedir ao autor que adicione uma `LICENSE` ao Caliope. Isso é necessário antes de qualquer distribuição pública do Henduran com código importado.
- A permissão do autor cobre o código dele, **não** as dependências nem os conteúdos de terceiros (ver seção 5).

## 2. Visão geral

| Item | Caliope |
|---|---|
| Backend | Python 3.12, FastAPI + uvicorn, SQLite (FTS5), ~50 mil linhas contando as skills; `backend/app` é o núcleo |
| Dependências | `fastapi, uvicorn, httpx, pyyaml, numpy, pillow, pypdf, pypdfium2, pytesseract`; **sem** `llama-cpp-python` |
| IA local | `llama-server` (llama.cpp, build Vulkan) baixado dos releases oficiais e iniciado pelo app |
| Frontend | Vite + React, janela WebView2; **não** é Tauri/PixiJS |
| Plataforma | Windows (usa `winreg` para detectar GPU) |
| Testes | ~50 arquivos em `backend/tests`, incluindo `test_runtime`, `test_models`, `test_core`, `test_tokens` |

## 3. Candidatos a reaproveitar

### Nível A — fronteira limpa, alto valor para o MVP local-first

| Módulo | Linhas | O que faz | Acoplamento | Observação |
|---|---|---|---|---|
| `llm.py` | 305 | Cliente de qualquer servidor OpenAI-compatível: streaming, `ThinkFilter` (remove `<think>`), saída com `json_schema` e fallback, embeddings, health | Só `httpx`; sem dependência do jogo | Serve ao modelo local e, trocando URL e chave, à API paga. É a base natural de um `NarratorProvider`. |
| `runtime.py` | 410 | Gerencia o `llama-server`: baixa o motor, descobre `.gguf`, escada de camadas de GPU com retentativa em falta de memória, encerra junto com o processo pai | `config` (`APP_HOME`, `DATA_DIR`) | Implementa o que o ADR-001 deixa em aberto (llama.cpp/GGUF e parte do empacotamento). Usá-lo exige **aprovar essa decisão em ADR**. |
| `hardware.py` | 148 | Detecta GPU, VRAM, RAM, CPU e sugere um modelo | Nenhum | Reaproveitar o código de detecção. A **lista de modelos sugeridos é curada para roleplay do Caliope** e deve ser refeita para o Henduran. |

### Nível B — úteis, com adaptação

| Módulo | Linhas | O que faz | Adaptação necessária |
|---|---|---|---|
| `modelhub.py` | 457 | Busca no Hugging Face, download resumível com SHA-256, ativar/desativar/remover modelos | Acoplado a `Database` e a `runtime`; desacoplar da persistência. |
| `memory.py` | 253 | Memória de longo prazo: FTS5 + embeddings, fusão por rank recíproco, ponderada por importância | Indexada por `conv_id`. O Henduran exige memória versionada e isolada por continuidade (ADR-056 a 062). **Usar como referência de desenho** e reimplementar. |
| `skills.py` | 362 | Gerencia pastas com `SKILL.md`; scripts **nunca** são executados; até 3 skills por cartão | Alinhado ao `05-narrador-ia.md`. Importar o gerenciador, **não** o acervo (seção 5). |
| `lorebook.py` | 58 | Entradas ativadas por palavra-chave (inclui `/regex/`) com orçamento de tokens | Trivial. Relaciona-se aos Mundos do ADR-021. |
| `wikiresearch.py` | 262 | Pesquisa em wikis MediaWiki/Fandom e monta fichas, sem modelo | Texto vem sob CC BY-SA: exige atribuição. Relaciona-se ao ADR-021. |

### Referência de UX (não de código)

O frontend do Caliope mostra como um chat de roleplay local se comporta (streaming, regeneração, histórico). Serve de inspiração para o chat do Henduran, mas a stack é outra.

## 4. Não importar

- `engine.py` (1164 linhas): laço de jogo acoplado a combate, loja, status, reputação, mapas e aventura.
- `combat.py`, `dnd5e/*`, `dice.py`, `checks.py`, `rulebooks.py`, `adventure.py`, `shop.py`, `statusbook.py`: regras próprias do Caliope/D&D. O Henduran usa regras adaptadas do Astra e o motor valida (AGENTS.md).
- `prompts.py`: acoplado ao estilo e à estrutura do Aedo.
- Mecanismos em que **a IA extrai mudanças de estado** (por exemplo, a análise em `engine.py` com `json_schema`). No Henduran a IA *propõe* e o motor *valida*. O `llm.py` aceita saída estruturada, então o canal serve, mas a semântica é outra.

## 5. Riscos

1. **Acervo de skills (520 pastas).** **Decisão do responsável: todas entram**, inclusive as de conteúdo adulto ou explícito (cerca de 260 as mencionam). Pontos que seguem valendo: apenas 81 declaram licença (57 MIT, 24 ISC) e as demais têm origem não declarada; a permissão do autor cobre o código dele, não necessariamente skills escritas por terceiros. Por isso: perguntar ao autor a origem do acervo, preservar os cabeçalhos de licença e atribuição de cada skill e importar as pastas sem alterá-las. Ainda há muitas skills irrelevantes para o Henduran (finanças, engenharia de jogos); a seleção por cartão ou mundo continua sendo o filtro, e uma marcação de conteúdo (adulto/geral) nos metadados facilita esse filtro. Os scripts das skills **nunca** são executados, como no Caliope.
2. **Dados SRD 5.1** (D&D, CC BY 4.0) estão no `seed/`. Não se aplicam ao Henduran.
3. **Repositório em evolução rápida** (README cita v2.23, o commit é v2.30.0). Ao importar, registrar o commit de origem de cada arquivo e tratar a cópia como *vendoring* com versão fixa.
4. **Divergência de arquitetura.** Caliope é app FastAPI + navegador; o Henduran é Tauri + Python. O protocolo frontend↔Python segue em aberto (FastAPI com HTTP/SSE é a opção que o Caliope já valida, mas é decisão para ADR).
5. **Conteúdo de modelos sugeridos.** Os modelos recomendados pelo Caliope são de roleplay geral; a escolha de modelos do Henduran precisa de critério próprio (idioma, licença do modelo, tamanho).

## 6. Ordem de importação sugerida (local-first, depois API paga)

1. `llm.py` → vira o `NarratorProvider` (local primeiro; API paga com a mesma interface depois).
2. `runtime.py` + `hardware.py` → motor `llama-server` local e detecção de hardware.
3. `modelhub.py` → baixar e gerenciar modelos GGUF gratuitos.
4. Depois do primeiro MVP: `memory.py` (referência), `lorebook.py`, `skills.py`, `wikiresearch.py`.

Para cada módulo: leitura completa, trazer os testes correspondentes (`test_runtime`, `test_models`, `test_tokens` etc.), registrar o commit de origem e adaptar nomes e termos ao Henduran.

## 7. Decisões do responsável (2026-11-22)

- **Aprovado:** `llama-server` (llama.cpp) + GGUF como runtime local, **local gratuito primeiro, API paga por chave depois**. Falta formalizar em ADR e refletir em `04-arquitetura.md` (item em aberto do ADR-001).
- **Aprovado:** interface própria de provedor de IA (`NarratorProvider`), com `llm.py` como base. Falta formalizar em ADR.
- **Aprovado:** protocolo frontend↔Python por HTTP com SSE para streaming. Falta formalizar em ADR.
- **Skills:** todas entram, inclusive conteúdo adulto (ver seção 5, item 1).
- **Escopo do primeiro MVP:** construído sobre o loop de gameplay (`docs/main/02-loop-de-gameplay.md`), com menu inicial, mundo genérico e criação de personagem; **somente chatbot**, sem combate e sem navegação em mapa global. O caso do ferreiro deixa de ser o caso de uso de referência; os documentos que o citam serão ajustados quando o escopo do MVP for detalhado.
- **Estratégia:** modelo semelhante ao do Caliope, mais direcionado e com ajustes para o Henduran.
