# ADR-070 — Runtime local de LLM: llama.cpp (`llama-server`) com modelos GGUF

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Complementa:** ADR-001 (fecha o item em aberto "llama.cpp/GGUF") e ADR-016 (reaproveitamento seletivo do Caliope)
- **Origem:** Decisão explícita do responsável pelo Henduran, após a auditoria `docs/main/auditoria-caliope.md`

## Contexto

O Henduran precisa de um Narrador que funcione **sem custo e sem internet**, com a opção de usar uma API paga por chave depois. O Caliope já resolve a execução local com o `llama-server` do llama.cpp e modelos GGUF, e o autor autorizou o reaproveitamento do código (auditoria, seção 1).

## Decisão

1. **O motor local de inferência é o `llama-server` do llama.cpp**, executado como **processo filho** do serviço Python, com **modelos no formato GGUF**.
2. **Local gratuito primeiro.** O MVP funciona com modelo local. Provedores pagos por chave entram depois, pela mesma interface (ADR-071).
3. **O serviço Python gerencia o ciclo de vida do `llama-server`**: iniciar, verificar saúde, parar e **nunca deixar processo órfão** quando o app fecha ou cai (requisito de `04-arquitetura.md`, seção 6).
4. **Modelos** são descobertos numa pasta controlada pelo app e podem ser baixados de repositórios públicos do Hugging Face, com download retomável e **verificação de integridade** (SHA-256 quando publicado).
5. **Detecção de hardware** (GPU, VRAM, RAM) orienta a configuração e a sugestão de modelo. A lista de modelos sugeridos é **própria do Henduran** e não herda a do Caliope.
6. **Reaproveitamento do Caliope**, na ordem da auditoria: `runtime.py` e `hardware.py` (nível A), depois `modelhub.py` (nível B). Cada arquivo importado registra o commit de origem, traz seus testes e passa por leitura completa antes de entrar.

## Consequências

- Vantagens: custo zero para o jogador, jogo offline, caminho já validado pelo Caliope.
- Custos: o Henduran passa a ser responsável por baixar e atualizar o motor de inferência, por falhas de memória de GPU e por modelos de tamanhos variados.
- O binário do `llama-server` e os modelos **não** são commitados no repositório.

## Em aberto

- Variante do `llama-server` por padrão (o Caliope usa Vulkan para AMD/NVIDIA/Intel; validar na prova de conceito) e comportamento sem GPU.
- Modelo padrão sugerido, quantização recomendada, idioma e licença de cada modelo.
- Suporte mínimo de hardware.
- Licença e política de redistribuição do `llama-server` dentro do instalador (confirmar antes de distribuir).
- Empacotamento do serviço Python (continua em aberto, `04-arquitetura.md`).
