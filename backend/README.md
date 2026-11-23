# Henduran — serviço local (backend)

Serviço Python que a interface do Henduran usa para falar com o Narrador. Neste estágio é um **esqueleto**: responde com um **provedor de IA falso** (texto fixo, palavra por palavra), sem modelo real.

- Protocolo: HTTP local com SSE para streaming (ADR-072).
- Interface de provedor: `NarratorProvider` (ADR-071), em `henduran/providers/`.
- Tecnologia: Python 3.12, FastAPI e uvicorn.

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

## API

Todas as rotas exigem `Authorization: Bearer <token>`; sem ele a resposta é 401. CORS aceita apenas `tauri://localhost`, `http://tauri.localhost` e `http://localhost:5173` (Vite em dev).

| Rota | Descrição |
| --- | --- |
| `GET /health` | `{"status": "ok", "provider": {...}}` |
| `POST /chat/stream` | Corpo `{"messages": [{"role": "user", "content": "..."}]}`. Resposta `text/event-stream`. |
| `POST /chat/{id}/cancel` | Cancela a geração em curso. 404 se o id for desconhecido. |

Eventos SSE de `/chat/stream` (formato provisório, ainda em aberto no ADR-072):

- `event: start` — `{"id": "<uuid>"}`
- `event: token` — `{"text": "..."}`
- `event: done` — `{"reason": "completed"}` ou `{"reason": "cancelled"}`
- `event: error` — `{"message": "..."}`

Fechar a conexão também cancela a geração.

## Testes

```powershell
.venv\Scripts\python -m pytest
```

## Limitações atuais

- Só o provedor falso existe; não há IA real nem `llama-server` (ADR-070 fica para o passo 3).
- Sem regras do Astra, persistência, mundo ou personagem.
- O formato dos eventos SSE, o versionamento da API e a reconexão seguem em aberto (ADR-072).
- **Empacotamento do serviço (sidecar, PyInstaller etc.) está fora do escopo e em aberto**: por enquanto só roda em modo de desenvolvimento, com o Python do `.venv`.
