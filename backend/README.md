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
- **`WorldStore`:** `create_world(name, content)` (versão 1), `list_worlds()`, `open_world(id)` (migra o conjunto `world`), `world_in_use(id)` e `delete_world(id, confirm=True)`, que recusa sem confirmação, com Jornada vinculada (`mundo_em_uso`) ou com Jornada ilegível (`uso_indeterminado`).
- **`JourneyStore`:** `create_journey(name, world_id, world_version=1)` confere o Mundo e a versão; `list_journeys()` lê o `journey_meta` de cada Jornada **em modo somente leitura e sem migrar**, do último salvamento ao mais antigo, com `status` `ok`, `danificada`, `mais_nova` ou `sem_mundo` e o código do erro (uma Jornada que não abre nunca derruba a lista); `open_journey(id)` devolve uma `OpenJourney` (*context manager*) com `summary()`, `update_summary(...)`, `touch_saved()`, `world_content()`, `write_character(personagem)` (transação única; `personagem_existente` se já houver), `read_character()` e `character_sheet()` (ficha com as trilhas derivadas); `list_backups(id)`, `restore_backup(id, nome)`, `delete_journey(id, confirm=True)`, `last_journey_id` e `set_last_played(id)`. `create_journey(..., initialize=f)` roda `f(tx, id)` na mesma transação que grava o resumo.
- **Criação atômica** (`henduran/services/journey_creation.py`, `create_journey_with_character`): valida tudo antes (Mundo v1, lugar inicial, personagem e nome; erro = `JourneyCreationInvalid` com todos os erros por campo e nada gravado), cria o **Mundo** (versão 1) e depois a **Jornada** fixada nele, gravando na **mesma transação do `journey.db`** o personagem, a Ambição e o Desejo ativos e o resumo (`character_name`, `location` = nome do lugar inicial, `day_period = "amanhecer"`, `last_saved_at`, `rules_version`); por fim relê o resumo. Cada etapa grava num só banco. Se algo falhar, a **compensação** remove as pastas da Jornada e do Mundo criados e levanta `JourneyCreationFailed` (`criacao_falhou`, com `step`: `criar_mundo`, `criar_jornada` ou `conferir`). Nome padrão: "A Jornada de <nome do personagem>" (cortado em 200 caracteres). Criar não marca a última Jornada jogada; abrir, sim.
- **Jornada aberta no serviço** (`henduran/services/session.py`, `JourneySession`): uma por vez. Abrir **outra** com uma aberta é recusado (`jornada_ja_aberta`, 409); abrir a **mesma** de novo devolve a aberta. O serviço fecha a Jornada ao encerrar.
- **Uma Jornada aberta por vez** neste processo (`jornada_ja_aberta`) e **bloqueio do sistema operacional** em `journey.lock` (`msvcrt.locking` no Windows), liberado pelo sistema se o processo morrer (inclusive `taskkill /F`); outra instância recebe `jornada_bloqueada`. O serviço não abre nenhuma Jornada ao iniciar.
- **Mundo anexado em leitura:** ao abrir, a Jornada migra o próprio banco (backup só dele, antes) e anexa o `world.db` fixado com `ATTACH 'file:...?mode=ro' AS world` em todas as conexões (escritor e leitores, inclusive os criados depois). Escrever por `world.*` falha com "attempt to write a readonly database". Mundo ou versão ausentes: `mundo_ausente` / `versao_ausente`. Se o Mundo tiver migração pendente, ela é feita antes, numa operação separada; nunca se grava nos dois bancos na mesma operação.
- **Restauração** (sempre explícita): o `journey.db` atual (com `-wal`/`-shm`) é renomeado para `journey.db.danificado-<AAAAMMDD-HHMMSS>`, o backup escolhido é conferido (integridade e id da Jornada), copiado para o lugar e conferido de novo.

## Regras da fatia 1 (`henduran/rules/`)

Implementação da wiki `rules/` (versão `fatia-1`); o que lá está **[PENDENTE]** não é implementado, e Competências, Capacidades, equipamento, XP e Conhecimento Específico não existem.

- `fatia1.py`: os 6 Atributos (ids `forca`, `agilidade`, `vigor`, `carisma`, `determinacao`, `astucia`, com categoria `fisico`/`espiritual` e descrição), as 22 Perícias (id sem acento, Atributo ligado e descrição), a distribuição dos Atributos (4, 3, 3, 2, 2, 1), os perfis de Perícias (Generalista 1×3, 6×2, 6×1; Equilibrado 2×3, 4×2, 6×1; Especialista 1×4, 2×3, 2×2, 2×1), o teto 4 na criação, as derivadas (Vida = 3 + Vigor; Vontade = 3 + Determinação), `RULES_VERSION = "fatia-1"` e os limites dos textos (nome até 200; Conceito, Ambição, Desejo, Convicção e Pilar até 300; aparência e história até 4000).
- `creation.py`: `validate_character(rascunho)` devolve **todos** os erros (`field`, `code`, `message`) ou o personagem normalizado; `derive(personagem)` devolve `{"vida", "vontade"}` (tamanho das trilhas); `creation_catalog()` é o que `GET /rules/creation` entrega.
- Rascunho: `{"name", "concept", "appearance", "history", "ambition", "desire", "convictions": [{"text", "pillar"}] (exatamente 3), "attributes": {id: valor} (os 6), "skill_profile", "skills": {id: valor}}` (Perícias ausentes valem 0). Todos os textos são obrigatórios; são normalizados (NFC, pontas sem espaço, `\r\n` vira `\n`) e não aceitam caracteres de controle (o nome é de uma linha). Campos desconhecidos são recusados.
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
| `GET /journeys` | `{"journeys": [{"id", "name", "character_name", "location", "day_period", "world_id", "world_version", "world_name", "created_at", "last_saved_at", "schema_version", "status", "error_code", "error_message"}], "last_journey_id"}`. `status`: `ok`, `danificada`, `mais_nova` ou `sem_mundo`. Somente leitura; 503 `storage_unavailable` sem o armazenamento. |
| `GET /worlds` | `{"worlds": [{"id", "name", "created_at", "versions", "latest_version", "schema_version", "status", "error_code", "error_message"}]}`. `status`: `ok`, `danificado` ou `mais_novo`. |
| `GET /rules/creation` | Dados de criação da fatia 1 para a interface (fonte única): `rules_version`, `categories`, `attributes` (`id`, `name`, `category`, `description`, `skills`), `skills` (`id`, `name`, `attribute`, `description`), `attribute_distribution`, `skill_profiles` (`id`, `name`, `distribution: [{"value", "count"}]`, `total_skills`), `creation_max`, `ranges`, `derived` (`id`, `name`, `base`, `attribute`, `formula`), `convictions.count`, `text_limits` e `fields`. |
| `GET /worlds/schema` | Limites do esquema v1 do Mundo (contagens, tamanhos, `seed_max`, padrão do id de lugar). |
| `POST /worlds/generate` | `{"seed"?: int}` (corpo opcional) → `{"seed", "content"}`. Não grava nada. 422 `semente_invalida`. |
| `POST /worlds/validate` | `{"content"}` → `{"valid", "errors": [{"field", "code", "message"}], "content"}` (normalizado, ou nulo se inválido). |
| `POST /characters/validate` | `{"draft"}` → `{"valid", "errors", "derived": {"vida", "vontade"}}` (cada derivada é nula se o Atributo ainda não for válido). Para a validação ao vivo do assistente. |
| `POST /journeys` | `{"name"?, "world": {"content"}, "start_place_id", "character": rascunho}` → 201 `{"journey": resumo}` (como um item de `GET /journeys`). 422 `criacao_invalida` com `errors` (campos `name`, `world.content.*`, `start_place_id`, `character.*`); 500 `criacao_falhou` com `step` (nada fica criado). |
| `GET /journeys/current` | Jornada aberta: `{"journey": resumo com rules_version, "character": ficha com tracks e derived, "world": {"id", "version", "content"}}`. 404 `nenhuma_jornada_aberta`. |
| `POST /journeys/{id}/open` | Abre (migra, com backup antes) e devolve o mesmo que `current`; grava `last_journey_id`. 409 `jornada_ja_aberta` (outra aberta), `jornada_bloqueada`, `banco_danificado`, `banco_mais_novo`, `mundo_ausente`...; 404 `jornada_nao_encontrada`; 422 `id_invalido`. |
| `POST /journeys/close` | `{"closed": id ou null}`. |
| `DELETE /journeys/{id}?confirm=true` | Exclui a pasta da Jornada (o Mundo fica). Sem `confirm=true`: 400 `confirmacao_necessaria`; aberta: 409 `jornada_aberta`. |
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

Fechar a conexão também cancela a geração.

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
- Das regras do Astra, só a criação de personagem da fatia 1 (validação e ficha). Ainda não há testes de dados, uso de Vontade, Fraturas, troca de objetivos, Dia do Mundo, eventos, memória, salvamentos nem ramificações; `day_period` é só texto no resumo. A interface do passo Nova Jornada ainda não existe (a API está pronta para ela).
- A exclusão de Mundos não tem rota: excluir uma Jornada deixa o Mundo dela na pasta `worlds\`.
- Em aberto no ADR-075: retenção dos backups por Jornada (hoje, os 5 pré-migração), cache do catálogo de Jornadas, anexos grandes (`assets\` é só criada) e `ATTACH` do Mundo com FTS5 e vetores.
- O anexo do Mundo em leitura cria `world.db-wal`/`-shm` ao lado (vazios) que uma conexão só de leitura não consegue apagar; são inofensivos.
- A lista de Jornadas não roda `quick_check` (custaria proporcional ao tamanho): detecta arquivo inválido, cabeçalho e resumo ilegíveis; dano em outras páginas aparece ao abrir.
- `quick_check` roda a cada início: barato hoje, mas o custo cresce com o banco.
- `estimate_fit` usa limiares **provisórios** (arquivo + ~20% na memória da maior placa; senão na RAM): proposta a validar.
- O formato dos eventos SSE, o versionamento da API e a reconexão seguem em aberto (ADR-072).
- **Empacotamento do serviço (sidecar, PyInstaller etc.) está fora do escopo e em aberto**: por enquanto só roda em modo de desenvolvimento, com o Python do `.venv`.
