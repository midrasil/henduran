# Henduran — serviço local (backend)

Serviço Python que a interface do Henduran usa para falar com o Narrador. Gerencia o **motor de IA local** (`llama-server` do llama.cpp, ADR-070), busca e baixa modelos `.gguf` do Hugging Face, guarda o modelo escolhido pelo jogador e responde ao chat em streaming.

- Protocolo: HTTP local com SSE para streaming (ADR-072).
- Interface de provedor: `NarratorProvider` (ADR-071), em `henduran/providers/`.
- Tecnologia: Python 3.12, FastAPI e uvicorn.
- Código adaptado do Caliope: veja `docs/main/importacoes-caliope.md`.

## Instalar

No PowerShell, dentro de `backend/`:

```powershell
py -3.12 -m venv .venv
.venv\Scripts\python -m pip install -e ".[dev]"
```

O ambiente virtual `.venv/` fica fora do Git.

## Rodar em desenvolvimento

O serviço exige um token de acesso na variável `HENDURAN_TOKEN` e recusa iniciar sem ela. Normalmente quem o inicia é o shell Tauri (veja `app/README.md`), que gera um token novo a cada execução. Para rodar sozinho:

```powershell
$env:HENDURAN_TOKEN = "qualquer-valor-local"
.venv\Scripts\python -m henduran            # porta livre escolhida automaticamente
.venv\Scripts\python -m henduran --port 8765
```

Quando está pronto, o serviço imprime uma linha JSON no stdout:

```json
{"event": "ready", "port": 8765}
```

Ele escuta **somente em `127.0.0.1`**.

### Variáveis de ambiente

| Variável | Padrão | Uso |
| --- | --- | --- |
| `HENDURAN_TOKEN` | (obrigatória) | Token Bearer exigido em todas as rotas. |
| `HENDURAN_PROVIDER` | `local` | `local` (motor llama-server) ou `fake` (texto fixo, para testes). Outro valor: o serviço não inicia (código 3). |
| `HENDURAN_FAKE_PROPOSE` | (vazia) | Com `fake`, `1` faz toda resposta terminar com a marcação `[[propor_cena]]`, para testar à mão a proposta de Cena do Aduran. |

Códigos de saída: `0` normal; `2` sem `HENDURAN_TOKEN`; `3` provedor inválido; `4` o banco de dados não pôde ser aberto ou migrado (a mensagem no stderr traz o código do erro, por exemplo `banco_mais_novo`, `checksum_divergente`, `migracao_falhou` ou `banco_inacessivel`).
| `HENDURAN_DATA_DIR` | `%LOCALAPPDATA%\Henduran` | Pasta de dados. Fica fora do repositório e do OneDrive. |

### Pasta de dados

```
%LOCALAPPDATA%\Henduran\
    engine\          motor baixado (llama-server e DLLs) + SOURCE.json (versão, variante, SHA-256)
    models\          modelos .gguf (subpastas valem); downloads vão para models\<autor>\<repo>\
    logs\engine.log  log do motor (o anterior fica em engine.log.1)
    logs\models.log  log dos downloads de modelos (URL, SHA-256 conferido ou ausente, remoções)
    henduran.db      banco SQLite do app (preferências e metadados), com -wal/-shm ao lado
    backups\         cópias do banco feitas antes de migrar (as 5 últimas)
    settings.json.migrado   preferências antigas, já importadas para o banco (não é mais lido)
    journeys\<id>\  uma Jornada (ADR-075): journey.db, journey.lock, assets\, backups\
    worlds\<id>\    um Mundo (ADR-075): world.db, backups\
```

## Banco de dados (`henduran/db/`, ADR-050)

Três tipos de banco (ADR-075): o **banco do app** (`henduran.db`, preferências e metadados), **um banco por Jornada** (`journeys\<id>\journey.db`) e **um banco por Mundo** (`worlds\<id>\world.db`). A Jornada tem `journey_meta` (resumo, uma linha, com `rules_version`) e as tabelas do personagem da fatia 1 (migração `journey/0002_character.sql`, ver **Personagem** abaixo); o Mundo tem `world_meta` (uma linha) e `world_versions` (versões com o conteúdo em JSON, no **esquema v1** descrito abaixo). Resumo do esquema em `docs/main/modelo-de-dados-jogo.md`.

- **Conexão** (`connection.py`, `Database`): `journal_mode=WAL`, `synchronous=NORMAL` (íntegro em queda de energia; no pior caso perde as últimas transações antes do *checkpoint*), `foreign_keys=ON`, `busy_timeout=5000`. Um escritor serializado por lock (`transaction()` com `BEGIN IMMEDIATE`, confirma no fim e desfaz em exceção; aninhar usa `SAVEPOINT`), leituras em conexões próprias só de leitura, e fachada assíncrona (`aexecute`, `aquery_all`, `aquery_one`, `arun_transaction`, `run`) via `asyncio.to_thread`. `close()` faz *checkpoint* do WAL e fecha tudo, liberando o arquivo no Windows. SQL sempre parametrizado.
- **Migrações** (`migrations.py` e `migrations/<conjunto>/NNNN_nome.sql`): três **conjuntos** com numeração própria, `app`, `journey` e `world`; só para frente, numeradas sem lacunas. O SHA-256 é calculado com finais de linha normalizados para LF (o `.gitattributes` força `*.sql` em LF); um registro antigo feito sobre o arquivo em CRLF (clone com `core.autocrlf=true`) continua aceito. Cada uma roda numa transação junto com o registro em `schema_migrations(version, name, checksum, applied_at)`; uma falha no meio desfaz a migração inteira. O SHA-256 das já aplicadas é conferido (arquivo alterado = `checksum_divergente`) e um banco de versão mais nova que a do app é recusado (`banco_mais_novo`). Migrações não podem conter `BEGIN`/`COMMIT`/`ROLLBACK`/`SAVEPOINT`/`RELEASE`/`VACUUM`.
- **Backup antes de migrar:** se há migrações pendentes e o banco já tem conteúdo, ele é copiado com a API de backup do SQLite para `backups\<prefixo>-v<versão atual>-<AAAAMMDD-HHMMSS>.db` ao lado do banco (`henduran-` no app, `journey-` em `journeys\<id>\backups\`, `world-` em `worlds\<id>\backups\`); ficam só os **5 mais recentes** de cada prefixo (pela data no nome). Banco novo não gera backup.
- **Banco corrompido:** o arquivo existente é conferido por uma conexão só de leitura com `PRAGMA quick_check`. Se não for SQLite ou a checagem não der `ok`, **nada é apagado**: o arquivo é renomeado para `henduran.db.corrompido-<AAAAMMDD-HHMMSS>` (com `-wal`/`-shm` junto), um banco novo é criado, o fato vai para o log e `/health` responde `database.recovered = true` com uma mensagem. Bloqueio ou falta de permissão **não** contam como corrupção (o serviço não inicia, código 4, e o arquivo fica intacto). **Este recuo automático só é aceitável porque o banco hoje guarda apenas preferências; a política deve ser revista quando ele guardar dados de jogo.**
- **Preferências** (`henduran/settings.py`): `active_model`, `context_size` (512–131072, padrão 4096), `engine_variant` (`vulkan`/`cpu`), `model_folders` (até 20) e `last_journey_id` (UUID da última Jornada jogada, ou nulo), uma linha por chave com o valor em JSON. Valor inválido no banco é ignorado com aviso.
- **Importação única do `settings.json` antigo:** na primeira execução com o banco, se `settings.json` existir e a tabela estiver vazia, os valores válidos são importados numa transação (os inválidos são descartados com aviso no log) e o arquivo é renomeado para `settings.json.migrado` (nunca apagado). JSON ausente ou corrompido não impede o serviço de subir. A importação fica registrada em `app_meta` e não se repete.

## Jornadas e Mundos (`henduran/storage/`, ADR-075)

- **Ids** em UUID estrito (`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`), normalizados para minúsculas; qualquer outro texto (`..`, barras, nomes reservados, tamanho errado) é recusado (`id_invalido`) e todo caminho é conferido como estando dentro da pasta de dados. Nomes de exibição ficam dentro dos bancos.
- **Bancos de jogo:** WAL e `synchronous=FULL` (no app continua `NORMAL`). Banco de Jornada ou de Mundo corrompido **nunca é recriado nem apagado**: vira `JourneyDamaged`/`WorldDamaged` (código e caminho) e o arquivo, com `-wal`, fica como está. O recuo automático do ADR-074 vale só para o banco do app.
- **`WorldStore`:** `create_world(name, content, seed=None)` (versão 1; `world_meta.seed`, migração `world/0002`), `list_worlds()`, `catalog()` (a lista da Nova Jornada: resumo, `seed`, `era` e `tone` da última versão e `journey_count`, tudo em leitura e sem migrar), `read_content(id, versão=None)` (somente leitura), `open_world(id)` (migra o conjunto `world`), `world_in_use(id)` e `delete_world(id, confirm=True)`, que recusa sem confirmação, com Jornada vinculada (`mundo_em_uso`) ou com Jornada ilegível (`uso_indeterminado`).
- **`JourneyStore`:** `create_journey(name, world_id, world_version=1)` confere o Mundo e a versão; `list_journeys()` lê o `journey_meta` de cada Jornada **em modo somente leitura e sem migrar**, do último salvamento ao mais antigo, com `status` `ok`, `danificada`, `mais_nova` ou `sem_mundo` e o código do erro (uma Jornada que não abre nunca derruba a lista); `open_journey(id)` devolve uma `OpenJourney` (*context manager*) com `summary()`, `update_summary(...)`, `touch_saved()`, `world_content()`, `write_character(personagem)` (transação única; `personagem_existente` se já houver), `read_character()` e `character_sheet()` (ficha com as trilhas derivadas); `list_backups(id)`, `restore_backup(id, nome)`, `delete_journey(id, confirm=True)`, `last_journey_id` e `set_last_played(id)`. `create_journey(..., initialize=f)` roda `f(tx, id)` na mesma transação que grava o resumo.
- **Criação atômica** (`henduran/services/journey_creation.py`, `create_journey_with_character`): o Mundo é **novo** (`world_content`, com `world_seed` opcional) ou **salvo** (`world_id`: a última versão é lida em modo somente leitura e validada no esquema v1; nada é gravado no `world.db`, e a compensação nunca o remove). A semente do Mundo novo é a pedida só se ela gera exatamente o conteúdo enviado; senão (editado, criado do zero ou duplicado), o serviço atribui uma nova (ADR-077, item 5). Valida tudo antes (Mundo v1, lugar inicial, personagem, nome e descrição da Jornada, opcional, até 2.000 caracteres; erro = `JourneyCreationInvalid` com todos os erros por campo e nada gravado), cria o **Mundo** (versão 1) e depois a **Jornada** fixada nele, gravando na **mesma transação do `journey.db`** o personagem, a Ambição e o Desejo ativos, a descrição (`journey_meta.description`, migração `journey/0005`) e o resumo (`character_name`, `location` = nome do lugar inicial, `start_place_id` = id do lugar inicial, `day_period` sorteado pelo motor entre os 6 períodos com peso igual (ADR-076, item 9; `rng` injetável), `last_saved_at`, `rules_version`); por fim relê o resumo. Cada etapa grava num só banco. Se algo falhar, a **compensação** remove as pastas da Jornada e do Mundo criados e levanta `JourneyCreationFailed` (`criacao_falhou`, com `step`: `criar_mundo`, `criar_jornada` ou `conferir`). Nome padrão: "A Jornada de <nome do personagem>" (cortado em 200 caracteres). Criar não marca a última Jornada jogada; abrir, sim.
- **Jornada aberta no serviço** (`henduran/services/session.py`, `JourneySession`): uma por vez. Abrir **outra** com uma aberta é recusado (`jornada_ja_aberta`, 409); abrir a **mesma** de novo devolve a aberta. O serviço fecha a Jornada ao encerrar.
- **Uma Jornada aberta por vez** neste processo (`jornada_ja_aberta`) e **bloqueio do sistema operacional** em `journey.lock` (`msvcrt.locking` no Windows), liberado pelo sistema se o processo morrer (inclusive `taskkill /F`); outra instância recebe `jornada_bloqueada`. O serviço não abre nenhuma Jornada ao iniciar.
- **Mundo anexado em leitura:** ao abrir, a Jornada migra o próprio banco (backup só dele, antes) e anexa o `world.db` fixado com `ATTACH 'file:...?mode=ro' AS world` em todas as conexões (escritor e leitores, inclusive os criados depois). Escrever por `world.*` falha com "attempt to write a readonly database". Mundo ou versão ausentes: `mundo_ausente` / `versao_ausente`. Se o Mundo tiver migração pendente, ela é feita antes, numa operação separada; nunca se grava nos dois bancos na mesma operação.
- **Restauração** (sempre explícita): o `journey.db` atual (com `-wal`/`-shm`) é renomeado para `journey.db.danificado-<AAAAMMDD-HHMMSS>`, o backup escolhido é conferido (integridade e id da Jornada), copiado para o lugar e conferido de novo.

## Regras da fatia 1 (`henduran/rules/`)

Implementação da wiki `rules/` (versão `fatia-1`); o que lá está **[PENDENTE]** não é implementado, e Competências, Capacidades, equipamento, XP e Conhecimento Específico não existem.

- `fatia1.py`: os 6 Atributos (ids `forca`, `agilidade`, `vigor`, `carisma`, `determinacao`, `astucia`, com categoria `fisico`/`espiritual` e descrição), as 22 Perícias (id sem acento, Atributo ligado e descrição), a distribuição dos Atributos (4, 3, 3, 2, 2, 1), os perfis de Perícias (Generalista 1×3, 6×2, 6×1; Equilibrado 2×3, 4×2, 6×1; Especialista 1×4, 2×3, 2×2, 2×1), o teto 4 na criação, as derivadas (Vida = 3 + Vigor; Vontade = 3 + Determinação), `RULES_VERSION = "fatia-1"` e os limites dos textos (nome até 200; Conceito, Ambição, Desejo, Convicção e Pilar até 300; aparência e história até 4000; o limite da história conta o **texto puro**).
- `creation.py`: `validate_character(rascunho)` devolve **todos** os erros (`field`, `code`, `message`) ou o personagem normalizado; `derive(personagem)` devolve `{"vida", "vontade"}` (tamanho das trilhas); `creation_catalog()` é o que `GET /rules/creation` entrega.
- Rascunho: `{"name", "concept", "appearance", "history", "ambition", "desire", "convictions": [{"text", "pillar"}] (exatamente 3), "attributes": {id: valor} (os 6), "skill_profile", "skills": {id: valor}, "age"?, "height"?, "origin"?, "personality"?, "history_html"?}` (Perícias ausentes valem 0). `history_html` é a História formatada (ADR-077): o serviço a sanea por lista permitida (`henduran/richtext.py`: `p`, `h2`, `h3`, `strong`/`b`, `em`/`i`, `u`, `s`, `ul`, `ol`, `li`, `blockquote` e o alinhamento `text-align` dos blocos; nada mais), deriva o texto puro e o usa como `history` (o `history` enviado junto é ignorado; os erros saem no campo `history`, inclusive `formatacao_demais` quando o HTML saneado passa de 40.000 caracteres). Sem `history_html`, `history` continua aceito como texto simples. `age` (até 100), `height` (até 100), `origin` (até 200) e `personality` (até 1000, várias linhas) são **opcionais**, texto livre e sem efeito de regra: ausentes, nulos ou vazios valem "não informado"; os limites estão em `text_limits` e os nomes em `fields` de `GET /rules/creation`. Os demais textos são obrigatórios; são normalizados (NFC, pontas sem espaço, `\r\n` vira `\n`) e não aceitam caracteres de controle (o nome é de uma linha). Campos desconhecidos são recusados.
- Códigos de erro: `rascunho_invalido`, `campo_desconhecido`, `obrigatorio`, `tipo_invalido`, `muito_longo`, `caracteres_invalidos`, `conviccoes_quantidade`, `atributo_desconhecido`, `atributo_ausente`, `abaixo_do_minimo`, `acima_do_teto`, `distribuicao_invalida`, `perfil_desconhecido`, `pericia_desconhecida`.

## Gerador de mundo (`henduran/worldgen/`)

`generate_world(seed)` gera um Mundo **por código, sem IA e sem rede**, determinístico por semente (`random.Random(seed)`; semente de 0 a 2^53 − 1, para caber num número do JavaScript; sem semente, uma é sorteada e devolvida). Fantasia medieval, alta e baixa, em português do Brasil, com nomes de sílabas inventadas (`worldgen/data.py`, com uma lista de nomes existentes a evitar). Eras e tons são **texto de ambientação**, sem mecânica. `validate_world_content(content)` é a defesa do servidor, porque o jogador pode editar o conteúdo antes de confirmar.

Conteúdo de Mundo, **esquema v1** (`worldgen/schema.py`; JSON inteiro até 256 KB em UTF-8; campos desconhecidos recusados; textos normalizados, sem caracteres de controle, descrições aceitam quebra de linha):

| Campo | Conteúdo e limites |
| --- | --- |
| `schema` | `1` |
| `name` | nome do Mundo, 1 a 100 |
| `era`, `tone` | `{"name"` (1 a 100), `"description"` (1 a 1000)`}` |
| `calendar` | `{"name"` (1 a 100), `"year"` (inteiro de 1 a 100000), `"era_label"` (por exemplo "Ano 476 da Fundação", 1 a 100), `"months": [{"name"` (1 a 40), `"days"` (20 a 40)`}]` (8 a 14, nomes únicos), `"weekdays": [texto]` (5 a 8, 1 a 40, únicos)`}` |
| `religions` | 1 a 3 `{"name"` (1 a 100), `"domain"` (1 a 60), `"description"` (1 a 1000)`}` |
| `places` | 3 a 5 `{"id"` (`^[a-z0-9][a-z0-9-]{0,39}$`, único), `"name"` (1 a 100, único), `"type"` (texto livre, 1 a 40; o gerador usa vila, cidade, porto, fortaleza, mosteiro, floresta, ruína, vale, pântano, montanha, estalagem, mina, aldeia), `"description"` (1 a 1000)`}` |

Códigos de erro do Mundo: os de texto acima, mais `conteudo_invalido`, `muito_grande`, `esquema_desconhecido`, `quantidade_invalida`, `fora_do_intervalo`, `duplicado` e `id_invalido`. `GET /worlds/schema` devolve esses limites.

## Personagem no `journey.db` (migração `journey/0002_character.sql`)

| Tabela | Colunas |
| --- | --- |
| `journey_meta` | + `rules_version TEXT NOT NULL DEFAULT 'fatia-1'` |
| `character` | uma linha (`id = 1`): `name`, `concept`, `appearance`, `history`, `creation_profile` (`generalista`, `equilibrado`, `especialista`), `vida_superficial`, `vida_agravada`, `vontade_superficial`, `vontade_agravada` (≥ 0, começam em 0), `created_at` |
| `character_attributes` | `attribute` (chave), `value` 1 a 5, `character_id` → `character` (6 linhas) |
| `character_skills` | `skill` (chave), `value` 0 a 5, `character_id` → `character` (as 22, inclusive as em 0) |
| `convictions` | `position` 1 a 3 (chave), `text`, `pillar`, `fractures` 0 a 2 (padrão 0), `character_id` → `character` |
| `objectives` | `id` autoincremento, `kind` (`ambicao`, `desejo`), `text`, `status` (`ativo`, `concluido`, `abandonado`, `impossivel`, `sem_sentido`), `reason`, `created_at`, `closed_at` (nulo só quando ativo), `character_id` → `character`; índice único parcial: no máximo **um ativo por tipo** |

As chaves estrangeiras apagam em cascata. O tamanho das trilhas não é gravado: vem dos Atributos. Os ids de Atributos e Perícias não são restritos por `CHECK` (o motor os valida), para que uma versão futura das regras não exija reconstruir tabelas.

## Tela da Jornada no `journey.db` (migração `journey/0004_journey_screen.sql`, ADR-076, itens 13 a 18)

| Tabela | Colunas novas |
| --- | --- |
| `scenes` | + `title` (1 a 80; nulo nas Cenas antigas, mostradas como "Cena N"), `objective_id` → `objectives` (a Ambição ativa ao abrir; nula nas antigas = a ativa atual) |
| `journey_meta` | + `current_place_id` (Mundo ou Jornada; a migração copia `start_place_id`), `calendar_year`, `calendar_month`, `calendar_day` (Jornadas antigas recebem, ao abrir, o dia 1 do mês 1 do ano do calendário) |
| `places` | `id` (`j-<n>`), `name` (1 a 100, único com o Mundo sem diferenciar maiúsculas), `type` (1 a 40), `description` (0 a 1000), `scene_id`, `created_at` |
| `scene_proposals` | `status` (`pendente`, `aceita`, `recusada`, `substituida`; no máximo uma pendente), `title`, `place_id` **ou** `new_place_name`/`new_place_type`/`new_place_description`, `motive`, `participants`, `scene_id`, `created_at`, `decided_at` |
| `events` | `kind` (`cena_aberta`, `cena_encerrada`, `lugar`, `cena_renomeada`), `scene_id`, `data` (objeto JSON), `day_period`, `calendar_year`/`month`/`day`, `created_at`; a migração cria os eventos retroativos das Cenas existentes |
| `character` | + `age`, `height`, `origin`, `personality` (opcionais), `portrait_file`, `portrait_crop` (`{x, y, zoom}`) |

- **Data** (`henduran/narrative/calendar.py`): na criação, ano = `calendar.year`, mês e dia sorteados pelo motor (mês com peso igual, depois o dia), depois do período e com o mesmo `rng`. O dia da semana é calculado: `dia_absoluto = (ano − calendar.year) × dias_do_ano + dias dos meses anteriores + (dia − 1)`, `weekdays[dia_absoluto mod len(weekdays)]`. A data não muda nesta fase.
- **Marcação de proposta** (`[[propor_cena]]`): o Aduran a escreve sozinha na última linha quando a ação declarada pede uma Cena. O serviço só a reconhece **no fim** da resposta (espaços e quebras de linha tolerados); retém no *streaming* o fim do texto que ainda pode ser a marcação, para nunca enviá-la à interface, e a remove do texto gravado. Fora de Cena, sem Cena aberta, pede a proposta estruturada (`{title, place: {kind: "conhecido", id} | {kind: "novo", name, type, description}, motive, participants}`, até 3 tentativas) e a grava como pendente. Em Cena (ou com Cena aberta) a marcação é só removida. No meio do texto, é texto comum.
- **Aduran durante a Cena**: `channel: "fora_de_cena"` com Cena aberta. O contexto do Aduran traz o resumo da Cena e as 10 últimas mensagens dela, marcados como referência; as mensagens ficam no canal `fora_de_cena` e nunca entram no contexto do Narrador da Cena (nem na regeneração, na continuação ou no resumo).
- **Retrato** (`henduran/services/portrait.py`): `journeys\<id>\assets\portrait.<png|jpg|webp>`, formato conferido pelos bytes iniciais, até 20 MB, gravado com arquivo temporário + `fsync` + `os.replace`, substituindo o anterior. **Os backups da Jornada (os pré-migração) copiam só o `journey.db`: `assets\` não entra neles** (política de backup inalterada; ADR-047/075 em aberto).

## Nova Jornada no `journey.db` e no `world.db` (migrações `journey/0005_description_history.sql` e `world/0002_seed.sql`, ADR-077)

| Tabela | Colunas novas |
| --- | --- |
| `journey_meta` | + `description` (1 a 2.000; nula = sem descrição). Entra no contexto geral do Narrador (`narrative/context.py`, logo depois da ficha). |
| `character` | + `history_html` (HTML saneado, 1 a 40.000; nulo nas Histórias antigas, que a ficha entrega como parágrafos). `history` continua com o texto puro. |
| `world_meta` | + `seed` (0 a 2^53 − 1; nula nos Mundos antigos). |

## Motor de IA (`llama-server`)

- **Download só quando o jogador pede** (`POST /engine/install`), dos releases oficiais de `ggml-org/llama.cpp` no GitHub: asset `llama-<tag>-bin-win-<variante>-x64.zip`. Variantes: `vulkan` (padrão, placas AMD/NVIDIA/Intel) e `cpu`. `GET /engine/release` informa nome, versão e tamanho antes.
- **Integridade:** o SHA-256 publicado pela API do GitHub é conferido; arquivo divergente é descartado. Se o GitHub não informar o digest, o download só ocorre com `allow_unverified: true` (o log do motor registra isso).
- **Extração segura:** caminhos absolutos, `..`, links simbólicos ou destinos fora da pasta são recusados antes de gravar qualquer arquivo.
- **Rede:** o motor escuta só em `127.0.0.1`, numa porta livre a cada início, com uma **chave de API aleatória por execução** passada pela variável `LLAMA_API_KEY` (não aparece na linha de comando nem no log). Sem a chave, `/v1/*`, `/props` e `/slots` respondem 401. **Limitação:** `/health` do llama-server continua público (só informa se está pronto).
- **Memória de vídeo:** começa com 2 *slots* e `-ngl auto`; se faltar memória, tenta 1 slot e depois menos camadas na placa (26, 18). Na variante CPU usa `-ngl 0`.
- **Ciclo de vida:** um motor por vez. O `llama-server` herda o Job Object do shell Tauri (`KILL_ON_JOB_CLOSE`, sem `CREATE_BREAKAWAY_FROM_JOB`) e morre junto com o app, inclusive após `taskkill /F`. Fora do Tauri, o serviço coloca o motor num job próprio e o encerra ao sair (também por `Ctrl+C`).

## Modelos do Hugging Face (`henduran/ai/modelhub.py`)

- **Busca** só em repositórios públicos com GGUF, por downloads, com autor, downloads, curtidas e **licença** (tag `license:*`). Repositórios restritos (*gated*) aparecem marcados e **não podem ser baixados**: exigem login no Hugging Face, ainda não suportado (o app não pede nem guarda token).
- **Arquivos** de um repositório, fixados no commit atual (`sha`): cada `.gguf` com tamanho, quantização inferida do nome e SHA-256 (`lfs.oid`). Modelos divididos (`-00001-of-0000N.gguf`) aparecem como **um item** com tamanho total; `mmproj` é ignorado.
- **Download** (um por vez) para `models\<autor>\<repo>\<arquivo>`, em `<arquivo>.part`, com progresso e velocidade. **Retoma** com `Range` de onde parou (cancelar, queda de rede ou fechar o app); se o servidor ignorar o `Range`, recomeça do zero. Só depois de conferir o **SHA-256** o arquivo recebe o nome final; divergência descarta o `.part` (`hash_divergente`). Sem hash publicado, conclui com aviso e registro em `logs\models.log`, sem se declarar verificado.
- **Segurança:** repositório `autor/nome` e nome de arquivo validados (sem `..`, separadores extras, nomes reservados do Windows; extensão `.gguf`). Só `https://huggingface.co` e CDNs `*.hf.co`/`*.huggingface.co`; cada redirecionamento é conferido (nada de `http` nem outros hosts). Escrita e remoção só dentro da pasta de modelos, recusando links simbólicos e junções no caminho. Espaço livre conferido antes de baixar (folga provisória de 256 MB).
- **Pastas extras** (`model_folders`): pastas onde o jogador já tem modelos (por exemplo, a do LM Studio), varridas junto com a pasta do app. O Henduran **só lê** essas pastas: não copia, não move e **recusa apagar** modelos delas (`pasta_externa`). Ids desses modelos começam com `ext:<8 hex>/`.
- Downloads ficam em memória; um `.part` deixado pelo fechamento do app reaparece como `interrupted` e pode ser retomado.

## API

Todas as rotas exigem `Authorization: Bearer <token>`; sem ele a resposta é 401. CORS aceita apenas `tauri://localhost`, `http://tauri.localhost` e `http://localhost:5173` (Vite em dev).

| Rota | Descrição |
| --- | --- |
| `GET /health` | `{"status": "ok", "provider": {"name", "ready", ...}, "database": {"schema_version", "recovered"}}`. Com o provedor local, inclui `state`, `code` e `message` quando não está pronto. `database.message` aparece quando o banco corrompido foi recriado. |
| `GET /journeys` | `{"journeys": [{"id", "name", "character_name", "location", "day_period", "world_id", "world_version", "world_name", "created_at", "last_saved_at", "schema_version", "status", "error_code", "error_message", "rules_version", "calendar", "current_scene_title", "portrait"}], "last_journey_id"}`. `status`: `ok`, `danificada`, `mais_nova` ou `sem_mundo`. Para o cartão "Última Jornada" do menu (só com `status` `ok`, senão `null`): `calendar` (`{"year", "month", "month_name", "day", "weekday", "weekday_name", "era_label"}`, como em `GET /journeys/current`, ou `null` sem data), `current_scene_title` (título da Cena aberta, "Cena N" sem título, ou `null` Fora de Cena) e `portrait` (`{"crop": {x, y, zoom}, "url_path": "/journeys/<id>/portrait"}` ou `null`). Somente leitura; 503 `storage_unavailable` sem o armazenamento. |
| `GET /worlds` | `{"worlds": [{"id", "name", "created_at", "versions", "latest_version", "schema_version", "status", "error_code", "error_message", "seed", "era", "tone", "journey_count"}]}`. `status`: `ok`, `danificado` ou `mais_novo`. `seed` (nula em Mundos antigos), `era` e `tone` (nomes da última versão) e `journey_count` (Jornadas legíveis que usam o Mundo) são a lista de Mundos salvos da Nova Jornada. Somente leitura, sem migrar. |
| `GET /worlds/{id}` | `{"world": item como em `GET /worlds`, "content": conteúdo da última versão ou null}` (somente leitura, sem migrar; os Mundos salvos são lidos sem alteração, ADR-077, item 5). 404 `mundo_nao_encontrado`; 422 `id_invalido`. |
| `GET /rules/creation` | Dados de criação da fatia 1 para a interface (fonte única): `rules_version`, `categories`, `attributes` (`id`, `name`, `category`, `description`, `skills`), `skills` (`id`, `name`, `attribute`, `description`), `attribute_distribution`, `skill_profiles` (`id`, `name`, `distribution: [{"value", "count"}]`, `total_skills`), `creation_max`, `ranges`, `derived` (`id`, `name`, `base`, `attribute`, `formula`), `convictions.count`, `text_limits` e `fields`. |
| `GET /worlds/schema` | Limites do esquema v1 do Mundo (contagens, tamanhos, `seed_max`, padrão do id de lugar). |
| `POST /worlds/generate` | `{"seed"?: int}` (corpo opcional) → `{"seed", "content"}`. Não grava nada. 422 `semente_invalida`. |
| `POST /worlds/validate` | `{"content"}` → `{"valid", "errors": [{"field", "code", "message"}], "content"}` (normalizado, ou nulo se inválido). |
| `POST /characters/validate` | `{"draft"}` → `{"valid", "errors", "derived": {"vida", "vontade"}}` (cada derivada é nula se o Atributo ainda não for válido). Para a validação ao vivo do assistente. Com `history_html`, valida o texto puro derivado do HTML saneado. |
| `POST /journeys` | `{"name"?, "description"?, "world": {"content", "seed"?} ou {"id"}, "start_place_id", "character": rascunho}` → 201 `{"journey": resumo}` (como um item de `GET /journeys`, com `description`). `world.content` cria um Mundo novo (com a semente do gerador se `seed` gerar exatamente o conteúdo; senão, uma nova); `world.id` usa um Mundo salvo, sem alterá-lo (o lugar inicial é escolhido entre os lugares dele). `description`: opcional, até 2.000 caracteres (vazia = sem descrição); vai para `journey_meta` e para o contexto do Narrador. 422 `criacao_invalida` com `errors` (campos `name`, `description`, `world` (`mundo_ambiguo` com `content` e `id` juntos), `world.id` (`mundo_desconhecido`, `mundo_danificado`, `mundo_mais_novo`, `mundo_invalido`), `world.content.*`, `start_place_id`, `character.*`); 500 `criacao_falhou` com `step` (nada fica criado). |
| `GET /journeys/current` | Jornada aberta: `{"journey": resumo com rules_version, start_place_id, current_place_id, calendar_year/month/day e description, "character": ficha com tracks, derived, age, height, origin, personality, history (texto puro), history_html (HTML saneado; parágrafos nas Histórias antigas) e portrait ({"crop": {x, y, zoom}, "url_path": "/journeys/current/portrait"} ou null), "world": {"id", "version", "content"}, "mode": "fora_de_cena"\|"em_cena", "scene": Cena aberta ou null, "proposal": proposta pendente ou null, "current_place": {"id", "name", "type", "description", "source": "mundo"\|"jornada"} ou null, "calendar": {"year", "month", "month_name", "day", "weekday", "weekday_name", "era_label"} ou null}`. 404 `nenhuma_jornada_aberta`. |
| `GET /journeys/current/messages` | `{"mode", "scene", "proposal", "messages": [{"id", "channel", "scene_id", "role", "content", "status", "created_at"}]}`: todas as mensagens, inclusive as canceladas (`status` `concluida` ou `cancelada`). Cena: `{"id", "status", "title", "opening_tone", "place_id", "place_name", "day_period", "motive", "participants", "objective_id", "summary", "opened_at", "closed_at"}`. Proposta: `{"id", "status", "title", "place": {"kind": "conhecido"\|"novo", "id" (nulo se novo), "name", "type", "description"}, "motive", "participants", "created_at"}`. |
| `POST /journeys/current/opening` | SSE da Cena inicial (ADR-076): `start`, `scene` (`{"scene"}` proposta e validada, com `title`, `status: "proposta"`), `token`s e `done` (`{"reason": "completed", "mode", "scene", "message"}` ou `{"reason": "cancelled"}`). Grava também o evento `cena_aberta`. Só grava no fim, numa transação; cancelada ou com erro, nada fica. 409 `abertura_existente` (já há mensagem ou Cena), `personagem_ausente`, `lugar_inicial_ausente`, `periodo_invalido`. Evento `error` com `proposta_invalida` depois de 3 propostas recusadas. |
| `POST /journeys/current/messages` | `{"content": 1..4000, "channel"?: "fora_de_cena"\|"cena"}` (padrão: o canal atual), SSE. Grava a mensagem do jogador no canal e gera a resposta do Aduran ou do Narrador da Cena; com Cena aberta e `channel: "fora_de_cena"`, responde o Aduran (a Cena só como referência). `done` traz `message` (`concluida`, ou `cancelada` com o texto parcial; `null` sem nenhum fragmento) e `proposal` (a pendente ou null). Se o Aduran terminar com a marcação (Fora de Cena, sem Cena aberta), antes do `done` vem `event: proposal` (`{"proposal"}`, gravada como pendente; a anterior vira `substituida`) ou `event: proposal_error` (`{"code", "message"}`: `proposta_invalida`, `no_model`, `engine_not_ready`, `proposta_cancelada`, `generation_failed`...); a resposta do Aduran fica gravada assim mesmo. Erro do provedor: a mensagem do jogador fica. 409 `abertura_pendente`, `sem_cena_aberta` (`channel: "cena"` sem Cena); 422 `mensagem_invalida`, `canal_invalido`. |
| `POST /journeys/current/messages/regenerate` | `{"channel"?}`, SSE. Só se a última mensagem do canal (na Cena aberta, no canal `cena`) for do Narrador: gera outra com o mesmo contexto (a abertura de uma Cena é refeita com o contexto de abertura, mantendo a Cena). A nova **substitui a anterior no mesmo `id`** só quando tem ao menos um fragmento (`concluida`, ou `cancelada` com o parcial); cancelada sem fragmento ou com erro, a anterior fica. `done`: `{"reason", "message", "replaced", "proposal"?}`. A marcação do Aduran vale como em `messages`. 409 `sem_resposta_do_narrador`, `abertura_pendente`, `sem_cena_aberta`. |
| `POST /journeys/current/messages/continue` | `{"channel"?}`, SSE. Só se a última mensagem do canal for do Narrador: pede ao modelo que continue de onde parou e anexa o texto à mesma mensagem (um espaço entre os dois quando nenhum lado o tem), até 20000 caracteres. `concluida` ao terminar, `cancelada` se cancelar; sem fragmento, a mensagem fica como estava. `done`: `{"reason", "message", "proposal"?}`. 409 `sem_resposta_do_narrador`, `mensagem_no_limite`. |
| `POST /journeys/current/proposal/accept` | SSE. Exige proposta pendente e nenhuma Cena aberta: `start`, `scene` (`{"scene": Cena proposta, "proposal"}`; `place_id` nulo se o lugar é novo), `token`s e `done` (`{"reason": "completed", "mode": "em_cena", "scene", "message", "current_place", "proposal": null}`). No fim, **uma transação** grava o lugar novo (`places`, id `j-<n>`), a Cena (título, lugar, período, motivo, participantes, `objective_id`), a mensagem, a proposta `aceita`, `current_place_id` e `location`, e os eventos `lugar` (se o lugar mudou) e `cena_aberta`. Cancelada ou com erro: nada é gravado e a proposta continua pendente. 409 `sem_proposta_pendente`, `cena_ja_aberta`, `lugar_duplicado`, `lugar_desconhecido`. |
| `POST /journeys/current/proposal/reroll` | JSON (sem *streaming*): pede outra proposta com o mesmo contexto (e a anterior como "não esta") → `{"proposal"}`; a anterior vira `substituida`. Falha do provedor ou propostas recusadas (502 `proposta_invalida`): a anterior continua pendente. 409 `sem_proposta_pendente`, `cena_ja_aberta`. |
| `POST /journeys/current/proposal/decline` | → `{"proposal": null, "declined": proposta}` (fica `recusada`). 409 `sem_proposta_pendente`. |
| `POST /journeys/current/scene/close` | Pede o resumo ao Narrador (JSON validado, até 3 tentativas) e encerra a Cena com ele (e o evento `cena_encerrada`) → `{"mode": "fora_de_cena", "scene": Cena encerrada}`. 409 `sem_cena_aberta`; erro do provedor (409 `no_model`/`engine_not_ready`..., 502 `proposta_invalida`/`generation_failed`): a Cena continua aberta. |
| `PATCH /journeys/current/scenes/{id}` | `{"title": 1..80, uma linha}` → `{"scene"}`; renomeia uma Cena aberta ou encerrada e grava `cena_renomeada` (`data`: `title`, `previous_title`; o mesmo título não grava nada). 422 `titulo_invalido`; 404 `cena_nao_encontrada`. |
| `GET /journeys/current/scenes/{id}` | `{"scene", "messages"}`: a Cena (com título, lugar, período, motivo, participantes e resumo) e as mensagens dela. 404 `cena_nao_encontrada`. |
| `GET /journeys/current/arcs` | `{"arcs": [{"objective_id", "text", "status", "scenes": [{"id", "title", "day_period", "place_name", "status"}]}]}`: arcos em ordem cronológica (pela primeira Cena), Cenas da primeira à última. A Ambição ativa sem Cenas aparece com a lista vazia. |
| `GET /journeys/current/events?scene_id=` | `{"events": [{"id", "kind", "scene_id", "data", "day_period", "calendar", "created_at"}]}`: o Log inteiro ou só o de uma Cena. `data`: `cena_aberta` `{title, place_id, place_name}`; `cena_encerrada` `{title, summary}`; `lugar` `{place_id, place_name, new_place, previous_place_id, previous_place_name}`; `cena_renomeada` `{title, previous_title}`. 404 `cena_nao_encontrada`. |
| `GET /journeys/current/places` | `{"current_place_id", "places": [{"id", "name", "type", "description", "source": "mundo"\|"jornada", "scene_id", "created_at", "current"}], "path": [{"place_id", "name", "scene_id", "event_id", "at"}]}`; `path` começa no lugar inicial e segue os eventos `lugar`. |
| `PUT /journeys/current/portrait?x=&y=&zoom=` | Corpo: os bytes da imagem (o `Content-Type` não importa). PNG, JPEG ou WebP conferidos pelos bytes iniciais, até 20 MB (o limite de 1 MB das rotas JSON não vale aqui). Enquadramento na *query* (padrão `x=0.5`, `y=0.5`, `zoom=1`; x e y de 0 a 1, zoom de 1 a 8) → `{"portrait": {"crop", "url_path"}}`. Substitui o anterior. 422 `formato_invalido`, `enquadramento_invalido`; 413 `imagem_grande_demais`. |
| `PATCH /journeys/current/portrait` | `{"x", "y", "zoom"}` (números) → `{"portrait"}`. 422 `enquadramento_invalido`; 404 `retrato_ausente`. |
| `GET /journeys/current/portrait` | A imagem original, com o `Content-Type` dela (`Cache-Control: no-store`). 404 `retrato_ausente`. |
| `DELETE /journeys/current/portrait` | Remove o arquivo e o retrato da ficha → `{"portrait": null}` (sem retrato, também 200). |
| `GET /journeys/{id}/portrait` | O retrato de uma Jornada **sem abri-la** (menu inicial), lido em modo somente leitura, com o `Content-Type` dela (`Cache-Control: no-store`). 404 `jornada_nao_encontrada` ou `retrato_ausente` (também quando o banco não pode ser lido); 422 `id_invalido`. |
| `POST /journeys/{id}/open` | Abre (migra, com backup antes) e devolve o mesmo que `current`; grava `last_journey_id`. 409 `jornada_ja_aberta` (outra aberta), `jornada_bloqueada`, `banco_danificado`, `banco_mais_novo`, `mundo_ausente`...; 404 `jornada_nao_encontrada`; 422 `id_invalido`. |
| `POST /journeys/close` | `{"closed": id ou null}`. |
| `DELETE /journeys/{id}?confirm=true` | Exclui a pasta da Jornada e, **se nenhuma outra Jornada usar o Mundo dela**, também o Mundo → `{"deleted", "world_id", "world_deleted", "world_kept_reason"}`. O Mundo fica quando outra Jornada o usa (`mundo_em_uso`), quando há Jornada ilegível que talvez dependa dele (`uso_indeterminado`) ou quando a remoção falha (`exclusao_falhou`, registrado no log); nesses casos a exclusão da Jornada vale assim mesmo. Jornada ilegível: `world_id` nulo e o Mundo fica. Sem `confirm=true`: 400 `confirmacao_necessaria`; aberta: 409 `jornada_aberta`. |
| `GET /journeys/{id}/backups` | `{"backups": [{"name", "schema_version", "created", "size_bytes"}]}`, do mais novo ao mais antigo. |
| `POST /journeys/{id}/restore` | `{"backup": nome}` → `{"restored_from", "preserved_as"}`. 409 `jornada_aberta`; 404 `backup_nao_encontrado`; 422 `backup_invalido`. |
| `POST /chat/stream` | Corpo `{"messages": [{"role": "user", "content": "..."}]}`. Resposta `text/event-stream`. |
| `POST /chat/{id}/cancel` | Cancela a geração em curso. 404 se o id for desconhecido. |
| `GET /hardware` | `{"gpus": [{"name", "memory_bytes"}], "ram_bytes", "cpu", "os"}` (`?refresh=true` lê de novo). |
| `GET /models` | `{"models": [{"id", "name", "size_bytes", "quant", "parts", "complete", "fit", "active", "source", "folder", "removable"}], "models_dir", "active"}`. `fit`: `gpu`, `cpu_lento` ou `pesado_demais`; `source`: `app` ou `extra`. |
| `DELETE /models/{id}` | Apaga do disco um modelo da pasta do app (todas as partes); se for o ativo, para o motor. 404 `model_not_found`; 409 `pasta_externa` (pasta extra) ou `ocupado`; 403 `fora_das_pastas`. |
| `GET /models/folders` | `{"folders": [{"path", "kind": "app"\|"extra", "exists"}]}`. |
| `POST /models/folders` | `{"path": "D:\\Modelos"}` (caminho completo). 404 `pasta_inexistente`; 422 `pasta_invalida` (relativo, unidade inteira, pasta do usuário, arquivo); 409 `pasta_sobreposta`. |
| `DELETE /models/folders?path=...` | Tira a pasta da lista (nenhum arquivo é apagado). 404 `pasta_desconhecida`. |
| `GET /hub/search?q=...&limit=20` | `{"results": [{"id", "author", "name", "downloads", "likes", "license", "gated", "restricted", "updated"}]}`. `limit` de 1 a 50. |
| `GET /hub/repos/{autor}/{repo}/files` | `id`, `revision`, `license`, `license_name`, `gated`, `private`, `restricted`, `free_bytes` e `files: [{"file", "name", "quant", "size_bytes", "parts": [{"path", "size", "sha256"}], "complete", "verifiable", "fit", "installed"}]`. |
| `POST /hub/downloads` | `{"repo", "file"}`; 202 com o item. 403 `restrito`; 409 `ocupado` ou `conflito`; 422 `repo_invalido`/`arquivo_invalido`; 404 `arquivo_nao_encontrado`; 507 `sem_espaco`. |
| `GET /hub/downloads` | `{"downloads": [{"id", "repo", "file", "name", "state", "done_bytes", "total_bytes", "progress", "speed_bps", "error": {"code", "message"}, "warning", "verified", "model_id", "parts"}]}`. `state`: `queued`, `downloading`, `verifying`, `done`, `error`, `cancelled`, `interrupted`. |
| `POST /hub/downloads/{id}/cancel` | Cancela (o `.part` fica para retomar). |
| `POST /hub/downloads/{id}/retry` | Retoma de onde parou; 202. |
| `DELETE /hub/downloads/{id}` | Tira da lista um item terminado, com erro ou cancelado e apaga o `.part` dele; 409 `ocupado` se ainda estiver ativo. |
| `POST /models/select` | `{"id": "..."}`. 404 `model_not_found`; 409 `model_incomplete`. |
| `GET /engine/status` | `state` (`stopped`, `downloading`, `starting`, `ready`, `error`), `message`, `progress`, `installed`, `version`, `variant`, `verified`, `active_model`, `active_model_name`, `log` (cauda) e `provider`. |
| `GET /engine/release?variant=vulkan` | Release que seria baixado: `tag`, `name`, `size`, `digest`, `verifiable`. 502 `release_lookup_failed`/`release_not_found`. |
| `POST /engine/install` | `{"variant": "vulkan"\|"cpu", "allow_unverified": false}`. 202 e baixa em segundo plano; 409 `digest_unavailable` ou `busy`. |
| `POST /engine/start` | 202 e carrega o modelo ativo em segundo plano; 409 `engine_not_installed`, `no_model`, `model_incomplete` ou `busy`. |
| `POST /engine/stop` | Para o motor. |

Erros das rotas de modelos, motor, Hugging Face, Jornadas e Mundos: `{"detail": {"code": "...", "message": "..."}}`; nas validações (422) vem também `errors: [{"field", "code", "message"}]`. As rotas de Nova Jornada aceitam corpo de até 1 MB (413 `corpo_grande_demais`), recusam JSON inválido (400 `json_invalido`) e campos desconhecidos (422 `corpo_invalido`). Sem o armazenamento, respondem 503 `storage_unavailable` (`/rules/creation` e as rotas de Mundo sem gravação funcionam assim mesmo). Sem o gerente do motor (uso em testes), respondem 503 `engine_unavailable`; sem o gerenciador de modelos, 503 `hub_unavailable`. Erros do Hugging Face: 502 `rede`, `resposta_invalida` ou `destino_inesperado`; 429 `limite_requisicoes`; 403 `restrito`; 404 `nao_encontrado`. Erros durante o download aparecem no item (`error.code`), incluindo `hash_divergente` e `disco`.

Eventos SSE de `/chat/stream` (formato provisório, ainda em aberto no ADR-072):

- `event: start` — `{"id": "<uuid>"}`
- `event: token` — `{"text": "..."}`
- `event: done` — `{"reason": "completed"}` ou `{"reason": "cancelled"}`
- `event: error` — `{"message": "...", "code": "..."}`, com `code` `no_model`, `engine_not_installed`, `engine_not_ready` ou `generation_failed`.

Fechar a conexão também cancela a geração. As rotas do Narrador na Jornada usam os mesmos eventos e o mesmo `/chat/{id}/cancel`, com uma geração por vez por Jornada (409 `geracao_em_andamento`; vale também para `scene/close`, `proposal/reroll` e `proposal/decline`). Eventos a mais nessas rotas: `scene` (abertura e aceitar), `proposal` e `proposal_error` (resposta do Aduran com a marcação).

### Extensões da interface `NarratorProvider`

Compatíveis com o provedor falso e com quem já usava a interface: `ProviderUnavailable` (exceção com `code`, levantada antes do primeiro fragmento) e `complete(messages, json_schema=None)` (não abstrato; padrão `NotImplementedError`). O provedor local implementa os dois.

## Testes

```powershell
.venv\Scripts\python -m pytest
```

Os testes usam `HENDURAN_DATA_DIR` temporário, o provedor falso, `tests/fake_llama_server.py` (um servidor que imita o llama-server) e `tests/fake_hub.py` (um Hugging Face falso sobre `httpx.MockTransport`). Nenhum teste baixa nada da internet.

## Limitações atuais

- Sem token do Hugging Face: repositórios restritos ou privados não podem ser baixados.
- Um download de modelo por vez (sem fila); o estado dos downloads não sobrevive ao fechamento do app, só o `.part`.
- Sem lista curada nem modelo recomendado: o jogador escolhe.
- Das regras do Astra, só a criação de personagem da fatia 1 (validação e ficha). Ainda não há testes de dados, uso de Vontade, Fraturas, troca de objetivos, passagem de tempo (período e data não mudam), memória, salvamentos nem ramificações. O Log tem só os eventos do ciclo de Cena e de lugar. A interface usa estas rotas no menu inicial, na tela Jornadas, no assistente de Nova Jornada e na Jornada aberta (somente leitura).
- A exclusão de Mundos não tem rota própria: o Mundo sai junto com a última Jornada que o usa (`henduran/services/journey_deletion.py`).
- Em aberto no ADR-075: retenção dos backups por Jornada (hoje, os 5 pré-migração, **só do `journey.db`; o retrato em `assets\` não entra**), cache do catálogo de Jornadas, outros anexos grandes e `ATTACH` do Mundo com FTS5 e vetores.
- A proposta pendente não expira: continua até ser aceita, trocada, recusada ou substituída por uma nova marcação do Aduran (outras mensagens não a descartam). Regenerar a resposta que trouxe a proposta não a desfaz.
- O anexo do Mundo em leitura cria `world.db-wal`/`-shm` ao lado (vazios) que uma conexão só de leitura não consegue apagar; são inofensivos.
- A lista de Jornadas não roda `quick_check` (custaria proporcional ao tamanho): detecta arquivo inválido, cabeçalho e resumo ilegíveis; dano em outras páginas aparece ao abrir.
- `quick_check` roda a cada início: barato hoje, mas o custo cresce com o banco.
- `estimate_fit` usa limiares **provisórios** (arquivo + ~20% na memória da maior placa; senão na RAM): proposta a validar.
- O formato dos eventos SSE, o versionamento da API e a reconexão seguem em aberto (ADR-072).
- **Empacotamento do serviço (sidecar, PyInstaller etc.) está fora do escopo e em aberto**: por enquanto só roda em modo de desenvolvimento, com o Python do `.venv`.
