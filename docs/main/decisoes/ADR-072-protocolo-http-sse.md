# ADR-072 — Protocolo frontend↔Python: HTTP local com SSE para streaming

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Complementa:** ADR-001 (fecha o item em aberto "protocolo frontend↔Python")
- **Origem:** Decisão explícita do responsável pelo Henduran, após a auditoria do Caliope

## Contexto

A interface (Tauri, React e TypeScript) precisa conversar com o serviço Python que orquestra o Narrador e o motor. O chat exige resposta em *streaming* e cancelamento. O Caliope já usa FastAPI com uvicorn e fluxo de eventos, o que valida o desenho para chat local.

## Decisão

1. **A interface fala com o serviço Python por HTTP local.** Comandos e consultas usam requisições comuns (JSON).
2. **Respostas do Narrador em streaming usam Server-Sent Events (SSE).**
3. **O serviço escuta somente em loopback (`127.0.0.1`)**, nunca em interfaces externas.
4. **Cancelamento** de uma geração em curso é uma operação explícita da API, além do fechamento da conexão.
5. **O serviço Python é iniciado e encerrado pelo shell Tauri**, sem deixar processo órfão.
6. **Tecnologia do serviço:** FastAPI e uvicorn, como no Caliope, salvo problema encontrado na prova de conceito.

## Consequências

- Vantagens: protocolo simples, depurável com ferramentas comuns, fácil de testar e mockar, streaming nativo no navegador do Tauri.
- Custos: porta local exposta a outros processos da máquina; requer proteção (ver abaixo) e atenção à política de segurança do Tauri.

## Em aberto

- Proteção do acesso local, por exemplo token por execução enviado pelo Tauri ao serviço (proposta, a validar), e política de CSP/CORS.
- Escolha da porta (fixa ou dinâmica) e descoberta pela interface.
- Formato dos eventos SSE, versionamento da API e tratamento de reconexão.
- Empacotamento do serviço Python (continua em aberto).
