# 06 — Plano Inicial de Desenvolvimento

**Status:** plano proposto, sujeito a ajustes após inspeção de assets e validação técnica.

## Etapa 0 — Fundação

**Objetivo:** garantir que Codex/Claude possam trabalhar sem inventar escopo.

- Revisar `README.md`, documentação fundadora e `AGENTS.md`.
- Confirmar licenças de assets e eventual reutilização de código do Caliope.
- Inventariar sprites do pacote UI sem mover, publicar ou transformar os originais.
- Definir regras para commits, testes e mudanças arquiteturais.

**Aceite:** documentos coerentes, assets privados protegidos e decisões abertas identificadas.

## Etapa 1 — Prova de conceito do chat desktop

- Criar shell desktop usando a stack aprovada (ADR-001), **somente após instrução explícita para iniciar a prova de conceito**.
- Construir chat com visual pixel art, lista de mensagens e entrada de texto, com seleção/cópia/rolagem.
- Conectar a um adaptador simulado de Narrador, com streaming fake e erros simulados.
- Validar empacotamento, testes e layout em resoluções usuais.

**Aceite:** aplicativo abre sem navegador, chat é utilizável, testes de UI passam; não é necessário LLM real.

## Etapa 2 — Inferência desacoplada

- Experimentar extração/autorização de partes úteis do Caliope.
- Conectar um modelo GGUF local e um provedor online de teste, com mecanismos comuns de mensagem.
- Implementar gerenciamento seguro de configuração e erros de inferência.

**Aceite:** chats em streaming com fontes de IA distintas, sem alteração do código de interface de jogo.

## Etapa 3 — Estado e regras mínimas

- Criar estado persistente da Jornada e do personagem.
- Definir a primeira parte aprovada da wiki Henduran.
- Implementar reservas d10 e uma interação validada, como compra de item ou teste simples.
- Testar que saída textual do modelo não modifica o estado sozinha.

**Aceite:** efeitos reproduzíveis e auditáveis, persistidos entre reinícios.

## Etapa 4 — Primeiro ciclo narrativo

- Fora de Cena → abertura de Cena por escolha do jogador → diálogo com NPC → operação mecânica → encerramento → Fora de Cena.
- Preservar chat da Cena, fatos persistentes e histórico.
- Validar com caso de uso da ferraria (comprar ou desistir de comprar espada).

**Aceite:** fluxo completo sem mapa procedural nem combate.

## Etapa 5 — Mapas e tática

- Introduzir mapa-múndi hexagonal e deslocamento.
- Introduzir mapa localizado e tokens em moeda.
- Adicionar resolução tática em grid, conforme regras Henduran aprovadas.

**Aceite:** mapas complementam a experiência de chat, sem assumir protagonismo do jogo.

## Não fazer por antecipação

- Implementar Competências ou Capacidades.
- Traduzir diretamente sessões de mesa para Cenas.
- Copiar o Caliope inteiro.
- Escrever grandes sistemas antes de testes verticais.
- Escolher persistentemente arquitetura ou schema sem documento de decisão.
