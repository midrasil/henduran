# 04 — Arquitetura (proposta, não decisão final)

**Status:** proposta para avaliação técnica e protótipo. A stack abaixo **não está consolidada**.

## 1. Critérios de escolha

O jogo é desktop e centrado em chat, com interface pixel art, mapas auxiliares e desenvolvimento predominantemente por agentes de programação (Codex/Claude Code). A arquitetura deve favorecer: testes automatizados, isolamento de regras, streaming de mensagens, facilidade de distribuir modelos locais, observabilidade e manutenção por código.

## 2. Stack candidata

- **Shell desktop:** Tauri.
- **Interface:** React + TypeScript, com o pacote comercial de sprites de UI via CSS e componentes.
- **Mapas e tokens:** PixiJS para renderização 2D no mapa-múndi hexagonal e mapas táticos.
- **Serviço de IA:** Python, aproveitando seletivamente conceitos/código autorizado do Caliope.
- **Execução local de LLMs:** llama.cpp com modelos GGUF; provedores remotos por API key.
- **Motor de regras:** componente determinístico independente de UI e de provedor de IA. **Linguagem e fronteira de processo a definir** após protótipo e leitura detalhada das regras.

Godot 4 + C# continua alternativa válida; MonoGame + C# também é possível. Não bloquear desenvolvimento futuro pela stack antes da validação do chat e da UI pixel art.

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

## 7. Critérios para fechar a stack

Executar uma prova de conceito que demonstre: (a) chat pixel art com textos longos, seleção, cópia e rolagem; (b) resposta de LLM em streaming; (c) painel 2D com token e grid; (d) teste determinístico isolado; (e) empacotamento desktop e inicialização do serviço local; (f) testes automatizados executáveis pelo Codex.

Somente então registrar uma decisão arquitetural (ADR) final, com alternativas descartadas e motivos.
