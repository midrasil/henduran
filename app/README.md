# Henduran — aplicativo desktop (app)

Interface do Henduran: shell **Tauri 2** (Rust) com **React + TypeScript** (Vite). O app abre no **menu inicial** (Continuar Jornada, Nova Jornada, Jornadas, Modelos e Sair), com o cartão da última Jornada e o céu do período dela. A **Nova Jornada** é um assistente de 3 passos (Mundo, Protagonista e Revisão) sobre as rotas de regras, Mundo e Jornadas do serviço Python de `backend/` (HTTP local com SSE); a **Jornada aberta** tem as abas Chat, Ficha, Mundo e Objetivos (somente leitura, exceto o chat). **Modelos** mostra o hardware do PC, baixa o motor de IA (`llama-server`), busca e baixa modelos `.gguf` do Hugging Face e deixa o jogador escolher, remover e encontrar modelos em outras pastas.

- Stack: ADR-001. Protocolo: ADR-072. Interface de provedor: ADR-071.
- Plataforma: somente Windows.

### Telas de jogo

- **Menu inicial:** "Continuar Jornada" abre a última Jornada jogada (`last_journey_id`; sem ela, a salva mais recentemente) e fica desativado se ela não estiver utilizável; o cartão mostra nome, personagem, local, "Salvo em", período e o aviso quando a Jornada está danificada, é de versão mais nova ou perdeu o Mundo. "Sair" chama o comando `exit_app` do shell (só no Tauri; no navegador o botão não aparece).
- **Jornadas:** biblioteca com busca e painel de detalhes para continuar, excluir (com confirmação; o Mundo continua salvo) ou restaurar uma Jornada danificada a partir de um backup. A tela também abre o assistente de Nova Jornada. Pontos de retorno ainda não estão disponíveis.
- **Nova Jornada:** gera o Mundo por semente (sorteada no cliente ou digitada), permite editar tudo (nome, era, tom, calendário com meses e dias da semana, religiões e lugares, dentro dos limites de `GET /worlds/schema`) e escolher o lugar inicial; o Protagonista tem identidade, Ambição, Desejo, Convicções com Pilar, Atributos, perfil e valores de Perícias e as trilhas de Vida e Vontade, com validação ao vivo no servidor (`/worlds/validate`, `/characters/validate`), erros por campo e "Distribuir ao acaso" a partir do catálogo. Nenhuma regra é duplicada na interface: tudo vem de `GET /rules/creation`.
- **Jornada aberta:** "Menu" fecha a Jornada no serviço e volta ao menu. O Narrador ainda não recebe o contexto da Jornada.

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

O indicador na barra de status (embaixo) mostra "Iniciando serviço…", "Conectado" ou "Erro: …" (consulta `/health`).

Variáveis úteis (o shell repassa o ambiente ao serviço): `HENDURAN_PROVIDER=fake` usa o Narrador falso; `HENDURAN_DATA_DIR` troca a pasta de dados (padrão `%LOCALAPPDATA%\Henduran`).

### Tela Modelos

- **Hardware:** placa(s) de vídeo com memória, RAM e processador.
- **Motor de IA:** estado e versão. Sem motor, "Baixar o motor de IA" (variante Vulkan, padrão, ou CPU) mostra arquivo, versão e tamanho e pede confirmação; se o GitHub não publicar o SHA-256, exibe um aviso e exige marcar "Entendo o risco…". O progresso aparece durante o download.
- **Modelos locais:** lista os `.gguf` da pasta de modelos com tamanho, quantização e compatibilidade ("Cabe na sua placa", "Vai rodar no processador, mais lento", "Pesado demais para este PC"). "Usar este modelo" seleciona e carrega; o estado passa por "Carregando o modelo…" até "Pronto", ou mostra o erro com o final do log do motor.
- Sem nenhum `.gguf`: mostra o caminho da pasta com o botão **Copiar caminho** e indica a busca abaixo.
- **Remover** (só modelos da pasta do app) pede confirmação num diálogo modal dizendo que apaga o arquivo do disco; se for o modelo ativo, o motor para. Modelos de pastas extras não têm Remover.
- **Buscar modelos no Hugging Face:** campo de busca (Enter ou **Buscar**); resultados com `autor/nome`, downloads, curtidas e licença ("não informada" se faltar). Repositórios restritos aparecem com o aviso "Exige login no Hugging Face; ainda não suportado".
- **Detalhe do repositório:** licença em destaque e um item por arquivo (modelos divididos contam como um), com quantização, tamanho e o mesmo rótulo de compatibilidade dos modelos locais. **Baixar** mostra o tamanho e o espaço livre e pede confirmação; avisa se não houver SHA-256 publicado e bloqueia se faltar espaço. Arquivos já baixados aparecem como "Já baixado".
- **Downloads:** nome, barra de progresso, bytes, velocidade e estado, com **Cancelar**, **Tentar de novo** (continua de onde parou, também depois de fechar o app) e **Limpar** (apaga o que foi baixado de um download não concluído). Ao concluir e conferir o SHA-256, o modelo aparece sozinho em Modelos locais. Mudanças de estado são anunciadas por uma região `aria-live` discreta, sem anunciar cada porcento.
- **Pastas de modelos:** lista a pasta do app e as extras; adiciona por caminho digitado (sem diálogo nativo nem novas permissões do Tauri) e tira da lista sem apagar arquivos.
- O estado do motor é consultado a cada ~1,5 s somente enquanto ele baixa ou carrega; os downloads de modelos, a cada ~1 s somente enquanto houver um ativo.

No Chat, se o motor local não estiver pronto, um aviso leva à tela Modelos, e os erros `no_model`, `engine_not_installed` e `engine_not_ready` aparecem com mensagens claras.

### Encerramento

Ao fechar a janela, o shell encerra o serviço. Além disso, o processo Python é criado suspenso e associado a um **Job Object do Windows com `KILL_ON_JOB_CLOSE`** antes de executar qualquer código; assim ele (e o interpretador real que o `python.exe` do venv cria como processo filho) morre mesmo se o app for morto à força, por exemplo com `taskkill /F`. O `llama-server` iniciado pelo serviço herda o mesmo job e também morre.

Para conferir que não sobrou processo:

```powershell
Get-CimInstance Win32_Process -Filter "Name='python.exe'" | Where-Object { $_.CommandLine -like '*-m henduran*' }
Get-Process llama-server -ErrorAction SilentlyContinue
```

## Interface (pixel art em CSS, ADR-069)

```
src/
  styles/      tokens.css (paleta, bordas, espaçamento, --text-scale), fonts.css, base.css
               (superfícies, foco, moldura .px-frame), shell.css, screens.css, index.css
  ui/          biblioteca de componentes: Button, Panel, Tabs, ProgressBar, ListCard,
               TextField/TextArea, Select, RadioGroup, FieldGroup, Stepper, TrailBoxes,
               Badge, Dialog, StatusIndicator, ChatBubble, SkyBackdrop,
               PixelIcon (exportados por ui/index.ts, cada um com CSS e testes)
  assets/fonts Pixelify Sans e Crimson Pro (woff2 locais, SIL OFL 1.1, licença em OFL.txt)
  gallery/     galeria de componentes (só desenvolvimento)
```

Sem tileset nem imagens de terceiros: molduras por `box-shadow` sem desfoque, ícones e céu desenhados por código. A CSP (`style-src 'self'`) proíbe atributo `style` no HTML; valores dinâmicos vão por classe ou `element.style.setProperty`. Tokens, fontes e regras de uso: `docs/ui-ux/08-guia-de-componentes.md`.

**Galeria:** com `npm run dev` rodando, abra `http://localhost:5173/gallery.html` num navegador. Mostra cores com a razão de contraste, tipografia, todos os componentes e estados, o céu nos 6 períodos, movimento reduzido e escala de texto. `?secao=<id>` mostra uma seção só. A galeria não entra no build (`vite build` usa apenas `index.html`).

O período do dia no céu e na barra de status é estado do mundo; sem Jornada, o app usa `entardecer`.

## Testes

```powershell
cd app
npm run test          # Vitest: SSE, streaming, chat, abas, Modelos, busca, downloads, pastas, componentes de ui/ e contraste dos tokens
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

- Sem token do Hugging Face (restritos não baixam), sem lista curada de modelos e um download por vez; sem regras do Astra, persistência, mundo ou personagem.
- Visual pixel art em CSS (ADR-069) sem ornamentos de canto nem ilustrações; leitor de tela e DPI fracionário ainda não foram testados.
- **Somente modo de desenvolvimento.** O empacotamento do serviço Python (sidecar, PyInstaller etc.) está **fora do escopo e em aberto** no projeto; por isso o bundle do Tauri está desativado (`bundle.active: false`). O caminho padrão do Python é resolvido a partir da pasta do projeto no momento da compilação, então o executável só funciona nesta cópia do repositório.
- Ícone provisório e neutro, gerado para o build.
