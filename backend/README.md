# Henduran — serviço local (backend)

Serviço Python que a interface do Henduran usa para falar com o Narrador. Gerencia o **motor de IA local** (`llama-server` do llama.cpp, ADR-070) e o modelo `.gguf` escolhido pelo jogador, e responde ao chat em streaming.

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
| `HENDURAN_DATA_DIR` | `%LOCALAPPDATA%\Henduran` | Pasta de dados. Fica fora do repositório e do OneDrive. |

### Pasta de dados

```
%LOCALAPPDATA%\Henduran\
    engine\          motor baixado (llama-server e DLLs) + SOURCE.json (versão, variante, SHA-256)
    models\          coloque aqui os arquivos .gguf (subpastas valem)
    logs\engine.log  log do motor (o anterior fica em engine.log.1)
    settings.json    modelo ativo, tamanho de contexto (4096) e variante do motor
```

`settings.json` é **provisório**: existe só até a persistência SQLite do projeto (ADR-050). A gravação é atômica e um arquivo ausente ou corrompido volta aos padrões.

## Motor de IA (`llama-server`)

- **Download só quando o jogador pede** (`POST /engine/install`), dos releases oficiais de `ggml-org/llama.cpp` no GitHub: asset `llama-<tag>-bin-win-<variante>-x64.zip`. Variantes: `vulkan` (padrão, placas AMD/NVIDIA/Intel) e `cpu`. `GET /engine/release` informa nome, versão e tamanho antes.
- **Integridade:** o SHA-256 publicado pela API do GitHub é conferido; arquivo divergente é descartado. Se o GitHub não informar o digest, o download só ocorre com `allow_unverified: true` (o log do motor registra isso).
- **Extração segura:** caminhos absolutos, `..`, links simbólicos ou destinos fora da pasta são recusados antes de gravar qualquer arquivo.
- **Rede:** o motor escuta só em `127.0.0.1`, numa porta livre a cada início, com uma **chave de API aleatória por execução** passada pela variável `LLAMA_API_KEY` (não aparece na linha de comando nem no log). Sem a chave, `/v1/*`, `/props` e `/slots` respondem 401. **Limitação:** `/health` do llama-server continua público (só informa se está pronto).
- **Memória de vídeo:** começa com 2 *slots* e `-ngl auto`; se faltar memória, tenta 1 slot e depois menos camadas na placa (26, 18). Na variante CPU usa `-ngl 0`.
- **Ciclo de vida:** um motor por vez. O `llama-server` herda o Job Object do shell Tauri (`KILL_ON_JOB_CLOSE`, sem `CREATE_BREAKAWAY_FROM_JOB`) e morre junto com o app, inclusive após `taskkill /F`. Fora do Tauri, o serviço coloca o motor num job próprio e o encerra ao sair (também por `Ctrl+C`).

## API

Todas as rotas exigem `Authorization: Bearer <token>`; sem ele a resposta é 401. CORS aceita apenas `tauri://localhost`, `http://tauri.localhost` e `http://localhost:5173` (Vite em dev).

| Rota | Descrição |
| --- | --- |
| `GET /health` | `{"status": "ok", "provider": {"name", "ready", ...}}`. Com o provedor local, inclui `state`, `code` e `message` quando não está pronto. |
| `POST /chat/stream` | Corpo `{"messages": [{"role": "user", "content": "..."}]}`. Resposta `text/event-stream`. |
| `POST /chat/{id}/cancel` | Cancela a geração em curso. 404 se o id for desconhecido. |
| `GET /hardware` | `{"gpus": [{"name", "memory_bytes"}], "ram_bytes", "cpu", "os"}` (`?refresh=true` lê de novo). |
| `GET /models` | `{"models": [{"id", "name", "size_bytes", "quant", "parts", "complete", "fit", "active"}], "models_dir", "active"}`. `fit`: `gpu`, `cpu_lento` ou `pesado_demais`. |
| `POST /models/select` | `{"id": "..."}`. 404 `model_not_found`; 409 `model_incomplete`. |
| `GET /engine/status` | `state` (`stopped`, `downloading`, `starting`, `ready`, `error`), `message`, `progress`, `installed`, `version`, `variant`, `verified`, `active_model`, `active_model_name`, `log` (cauda) e `provider`. |
| `GET /engine/release?variant=vulkan` | Release que seria baixado: `tag`, `name`, `size`, `digest`, `verifiable`. 502 `release_lookup_failed`/`release_not_found`. |
| `POST /engine/install` | `{"variant": "vulkan"\|"cpu", "allow_unverified": false}`. 202 e baixa em segundo plano; 409 `digest_unavailable` ou `busy`. |
| `POST /engine/start` | 202 e carrega o modelo ativo em segundo plano; 409 `engine_not_installed`, `no_model`, `model_incomplete` ou `busy`. |
| `POST /engine/stop` | Para o motor. |

Erros das rotas de modelos e motor: `{"detail": {"code": "...", "message": "..."}}`. Sem o gerente do motor (uso em testes), respondem 503 `engine_unavailable`.

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

Os testes usam `HENDURAN_DATA_DIR` temporário, o provedor falso ou `tests/fake_llama_server.py` (um servidor que imita o llama-server). Nenhum teste baixa nada da internet.

## Limitações atuais

- Sem download de modelos dentro do app (vem depois); o jogador coloca o `.gguf` na pasta de modelos.
- Sem regras do Astra, persistência SQLite, memória, mundo ou personagem.
- `estimate_fit` usa limiares **provisórios** (arquivo + ~20% na memória da maior placa; senão na RAM): proposta a validar.
- O formato dos eventos SSE, o versionamento da API e a reconexão seguem em aberto (ADR-072).
- **Empacotamento do serviço (sidecar, PyInstaller etc.) está fora do escopo e em aberto**: por enquanto só roda em modo de desenvolvimento, com o Python do `.venv`.
