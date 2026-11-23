# Henduran — aplicativo desktop (app)

Interface do Henduran: shell **Tauri 2** (Rust) com **React + TypeScript** (Vite). Duas abas: **Chat**, que conversa em streaming com o Narrador pelo serviço Python de `backend/` (HTTP local com SSE), e **Modelos**, que mostra o hardware do PC, baixa o motor de IA (`llama-server`) e deixa o jogador escolher o modelo `.gguf` local.

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

Variáveis úteis (o shell repassa o ambiente ao serviço): `HENDURAN_PROVIDER=fake` usa o Narrador falso; `HENDURAN_DATA_DIR` troca a pasta de dados (padrão `%LOCALAPPDATA%\Henduran`).

### Aba Modelos

- **Hardware:** placa(s) de vídeo com memória, RAM e processador.
- **Motor de IA:** estado e versão. Sem motor, "Baixar o motor de IA" (variante Vulkan, padrão, ou CPU) mostra arquivo, versão e tamanho e pede confirmação; se o GitHub não publicar o SHA-256, exibe um aviso e exige marcar "Entendo o risco…". O progresso aparece durante o download.
- **Modelos locais:** lista os `.gguf` da pasta de modelos com tamanho, quantização e compatibilidade ("Cabe na sua placa", "Vai rodar no processador, mais lento", "Pesado demais para este PC"). "Usar este modelo" seleciona e carrega; o estado passa por "Carregando o modelo…" até "Pronto", ou mostra o erro com o final do log do motor.
- Sem nenhum `.gguf`: mostra o caminho da pasta com o botão **Copiar caminho**. O download de modelos dentro do app virá depois.
- O estado do motor é consultado a cada ~1,5 s somente enquanto ele baixa ou carrega.

No Chat, se o motor local não estiver pronto, um aviso leva à aba Modelos, e os erros `no_model`, `engine_not_installed` e `engine_not_ready` aparecem com mensagens claras.

### Encerramento

Ao fechar a janela, o shell encerra o serviço. Além disso, o processo Python é criado suspenso e associado a um **Job Object do Windows com `KILL_ON_JOB_CLOSE`** antes de executar qualquer código; assim ele (e o interpretador real que o `python.exe` do venv cria como processo filho) morre mesmo se o app for morto à força, por exemplo com `taskkill /F`. O `llama-server` iniciado pelo serviço herda o mesmo job e também morre.

Para conferir que não sobrou processo:

```powershell
Get-CimInstance Win32_Process -Filter "Name='python.exe'" | Where-Object { $_.CommandLine -like '*-m henduran*' }
Get-Process llama-server -ErrorAction SilentlyContinue
```

## Testes

```powershell
cd app
npm run test          # Vitest: parser SSE, cliente de streaming, chat, abas e tela Modelos
npm run build         # checagem de tipos (tsc) + build do frontend
cd src-tauri
cargo test            # testes do shell (token, linha ready, espera)
cargo check
```

## Segurança

- O serviço escuta só em `127.0.0.1` e exige `Authorization: Bearer <token>` em todas as rotas.
- CSP do webview: `connect-src` limitado a `http://127.0.0.1:*` e ao IPC do Tauri (em dev, também ao Vite em `localhost:5173`).
- Capacidades do Tauri: apenas `core:default`; sem plugins de sistema de arquivos ou shell. "Copiar caminho" usa a API de área de transferência do navegador.

## Limitações atuais

- Sem download de modelos dentro do app; sem regras do Astra, persistência, mundo ou personagem.
- Estilo mínimo e neutro em `src/styles/`; o visual pixel art (ADR-069) ainda não foi aplicado.
- **Somente modo de desenvolvimento.** O empacotamento do serviço Python (sidecar, PyInstaller etc.) está **fora do escopo e em aberto** no projeto; por isso o bundle do Tauri está desativado (`bundle.active: false`). O caminho padrão do Python é resolvido a partir da pasta do projeto no momento da compilação, então o executável só funciona nesta cópia do repositório.
- Ícone provisório e neutro, gerado para o build.
