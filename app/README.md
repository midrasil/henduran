# Henduran — aplicativo desktop (app)

Interface do Henduran: shell **Tauri 2** (Rust) com **React + TypeScript** (Vite). Neste estágio é um **esqueleto**: uma tela de chat que conversa, por HTTP local com SSE, com o serviço Python de `backend/`, que responde com um provedor de IA falso.

- Stack: ADR-001. Protocolo: ADR-072. Interface de provedor: ADR-071.
- Plataforma: somente Windows.

## Pré-requisitos

- Node.js 24 e npm.
- Rust estável com o alvo `x86_64-pc-windows-msvc` e as Ferramentas de Build do Visual Studio (MSVC + Windows SDK).
- WebView2 Runtime (já vem com o Windows 11).
- O serviço Python instalado em `backend/.venv` (veja `backend/README.md`).

## Instalar

```powershell
cd app
npm install
```

## Rodar em desenvolvimento

```powershell
cd app
npm run tauri dev
```

O comando sobe o Vite em `http://localhost:5173`, compila o shell e abre a janela. Ao iniciar, o shell:

1. gera um **token aleatório por execução** (32 bytes, hex);
2. inicia `python -m henduran --port 0` com o Python de `backend/.venv/Scripts/python.exe` (ou o indicado em `HENDURAN_PYTHON`), passando o token em `HENDURAN_TOKEN`;
3. lê a linha `{"event":"ready","port":N}` do stdout e expõe porta e token ao frontend pelo comando `get_backend_info`.

O indicador no topo mostra "Iniciando serviço…", "Conectado" ou "Erro: …" (consulta `/health`).

### Encerramento

Ao fechar a janela, o shell encerra o serviço. Além disso, o processo Python é criado suspenso e associado a um **Job Object do Windows com `KILL_ON_JOB_CLOSE`** antes de executar qualquer código; assim ele (e o interpretador real que o `python.exe` do venv cria como processo filho) morre mesmo se o app for morto à força, por exemplo com `taskkill /F`.

Para conferir que não sobrou processo:

```powershell
Get-CimInstance Win32_Process -Filter "Name='python.exe'" | Where-Object { $_.CommandLine -like '*-m henduran*' }
```

## Testes

```powershell
cd app
npm run test          # Vitest: parser SSE, cliente de streaming e tela de chat
npm run build         # checagem de tipos (tsc) + build do frontend
cd src-tauri
cargo test            # testes do shell (token, linha ready, espera)
cargo check
```

## Segurança

- O serviço escuta só em `127.0.0.1` e exige `Authorization: Bearer <token>` em todas as rotas.
- CSP do webview: `connect-src` limitado a `http://127.0.0.1:*` e ao IPC do Tauri (em dev, também ao Vite em `localhost:5173`).
- Capacidades do Tauri: apenas `core:default`; sem plugins de sistema de arquivos ou shell.

## Limitações atuais

- Só o provedor falso; sem IA real, regras do Astra, persistência, mundo ou personagem.
- Estilo mínimo e neutro em `src/styles/`; o visual pixel art (ADR-069) ainda não foi aplicado.
- **Somente modo de desenvolvimento.** O empacotamento do serviço Python (sidecar, PyInstaller etc.) está **fora do escopo e em aberto** no projeto; por isso o bundle do Tauri está desativado (`bundle.active: false`). O caminho padrão do Python é resolvido a partir da pasta do projeto no momento da compilação, então o executável só funciona nesta cópia do repositório.
- Ícone provisório e neutro, gerado para o build.
