# 04 — Arquitetura (stack base aprovada; detalhes em aberto)

**Status:** a stack base (Tauri, React + TypeScript, PixiJS, Python, somente Windows) está **APROVADA** pelo `decisoes/ADR-001-stack-desktop-windows.md`. Este documento detalha a arquitetura e o aceite técnico. Aprovados depois: llama.cpp (`llama-server`) + GGUF como execução local (ADR-070), interface `NarratorProvider` (ADR-071) e protocolo HTTP local com SSE entre interface e serviço Python (ADR-072). Permanecem **propostos/em aberto**: linguagem e fronteira de processo do motor de regras, empacotamento do serviço Python, suporte mínimo de hardware e sistema de atualização; a integração das bibliotecas do Caliope segue a auditoria em `auditoria-caliope.md`. Banco de dados: SQLite já aprovado no ADR-050; esquema e transações seguem em aberto.

## 1. Critérios de escolha

O jogo é desktop e centrado em chat, com interface pixel art, mapas auxiliares e desenvolvimento predominantemente por agentes de programação (Codex/Claude Code). A arquitetura deve favorecer: testes automatizados, isolamento de regras, streaming de mensagens, facilidade de distribuir modelos locais, observabilidade e manutenção por código.

## 2. Stack

**Aprovada (ADR-001):**

- **Shell desktop:** Tauri.
- **Interface:** React + TypeScript, com o pacote comercial de sprites de UI via CSS e componentes.
- **Mapas e tokens:** PixiJS para renderização 2D no mapa-múndi hexagonal e mapas táticos.
- **Serviço de IA:** Python. O reaproveitamento seletivo do Caliope vem do ADR-016 e depende de auditoria de licença e fronteiras.
- **Plataforma:** somente Windows na fase inicial.

**Aprovado depois (ADR-070 a 072):**

- **Execução local de LLMs:** llama.cpp (`llama-server`) com modelos GGUF, local gratuito primeiro; provedores remotos por API key depois, pela interface `NarratorProvider`.
- **Protocolo interface↔serviço Python:** HTTP local em loopback, com SSE para streaming. Rotas do Narrador em SSE: o chat, as da Jornada aberta (ADR-076) e `POST /narrator/fill` (Narrador que preenche dados na Nova Jornada, ADR-077, item 3; não grava nada). Contrato em `backend/README.md`.

**Dependências da interface aprovadas por tarefa** (versões exatas no `app/package.json`):

| Pacote | Versão | Licença | Uso | Aprovação |
| --- | --- | --- | --- | --- |
| `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-text-align`, `@tiptap/extension-placeholder` | 3.35.0 | MIT | Editor da História na Nova Jornada (ADR-077, item 1), num conjunto enxuto: links, código, bloco de código, linha horizontal e quebra manual desligados no StarterKit. Nenhuma extensão "Pro" (paga). O contador usa a mesma derivação de texto puro do serviço, por isso `@tiptap/extension-character-count` não entrou. | Responsável, 2026-11-24 (rodada 2 da Nova Jornada). Medido com `vite build`: o editor é carregado sob demanda (pacote próprio de 407,5 kB, 129,6 kB gzip); o pacote inicial continua em 417,6 kB (126,8 kB gzip), contra 418,8 kB (126,9 kB gzip) antes. Num pacote único, seriam 823,5 kB (255,4 kB gzip). |

**Proposto / em aberto:**

- **Motor de regras:** componente determinístico independente de UI e de provedor de IA. **Linguagem e fronteira de processo a definir** após protótipo e leitura detalhada das regras.

Godot 4 + C# e MonoGame + C# foram avaliados e não selecionados; a stack aprovada é a referência até nova decisão formal (ADR-001).

## 3. Separação de responsabilidades

| Módulo lógico | Responsável por | Não deve fazer |
| --- | --- | --- |
| Interface | Exibir chat, histórico, fichas, menus, mapas e confirmação de ações | Ser fonte oficial do estado do jogo |
| Orquestrador da Jornada | Alternar Fora de Cena/Cena, coordenar comandos e transições | Inventar resultados mecânicos |
| Motor de regras | Rolagens, validações, efeitos, estado oficial e transações | Produzir prosa ficcional livre |
| Narrador IA | Interpretação, descrição, proposta de operações, leitura contextual de regras | Alterar estado sem ferramenta validada |
| Persistência | Salvamentos, eventos, histórico, versões e integridade | Depender exclusivamente de texto de chat |
| Serviço de inferência | Modelos locais, APIs, streaming, parâmetros e downloads | Conhecer regras específicas do RPG |

## 4. Contratos essenciais

O motor fornece ao Narrador **ferramentas estruturadas** para consultar estado e propor alterações. Ex.: `consultar_personagem`, `consultar_regra`, `propor_teste`, `registrar_fato`, `propor_transacao`. Os nomes são ilustrativos: schemas, permissões, aprovações e efeitos permanecem em aberto.

Uma resposta escrita como “você perdeu 10 moedas” não debita moedas por si. A operação tem de ser validada pelo motor, confirmada quando necessário e persistida de forma consistente.

O chat e a memória são registros narrativos; o estado oficial deve sobreviver à troca de modelo e à reconstrução do contexto.

## 5. Integração Caliope

Componentes candidatos a estudo/extração:

- `backend/app/llm.py` — cliente para servidores compatíveis com API OpenAI;
- `backend/app/runtime.py` — inicialização/controle do llama.cpp;
- `backend/app/modelhub.py` — obtenção e gerenciamento de modelos GGUF;
- `backend/app/skills.py` — leitura/gestão de skills;
- `backend/app/memory.py` — memória textual e semântica.

A integração deverá ocorrer por uma fronteira estável entre serviço de IA e aplicação. **Não copiar o motor de regras nem a estrutura de jogo do Caliope como base do Henduran.** Validar autorização/licença, dependências, segurança e suporte de plataforma antes da incorporação.

## 6. Segurança e distribuição

- Tratar saída do LLM e de skills como dados não confiáveis; ferramentas devem impor permissões e limites.
- Proteger chaves de API com armazenamento seguro adequado ao sistema operacional; não colocá-las em logs nem salvamentos exportados.
- Modelos locais devem ter origem verificável, downloads retomáveis, verificação de integridade quando disponível e caminho de armazenamento controlado.
- O aplicativo desktop deve inicializar e encerrar corretamente processos locais, sem deixar serviços órfãos.
- Não publicar assets adquiridos no GitHub público sem permissão expressa da licença.

## 7. Aceite técnico da stack (prova de conceito)

A stack já está aprovada; a prova de conceito **valida** a aprovação e resolve motor, protocolo e empacotamento do serviço Python (hardware mínimo e atualização exigem decisões próprias), e não é pré-condição para aprová-la. Ela deve demonstrar: (a) chat pixel art com textos longos, seleção, cópia e rolagem; (b) resposta de LLM em streaming; (c) painel 2D com token e grid; (d) teste determinístico isolado; (e) empacotamento desktop e inicialização do serviço local, sem ambiente Python de desenvolvimento; (f) testes automatizados executáveis pelo Codex.

Registrar em ADR específico as decisões que a prova de conceito resolver (motor, protocolo, empacotamento). Se ela inviabilizar parte da stack, registrar um novo ADR que substitua o ADR-001, com alternativas e motivos. Iniciar a prova de conceito exige instrução explícita.
