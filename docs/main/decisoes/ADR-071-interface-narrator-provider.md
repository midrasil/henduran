# ADR-071 — Interface própria de provedor de IA (`NarratorProvider`)

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Complementa:** ADR-016, ADR-070
- **Origem:** Decisão explícita do responsável pelo Henduran

## Contexto

O Narrador deve funcionar com modelo local (ADR-070) e, depois, com APIs pagas. O restante do jogo não pode depender de qual provedor responde. O `llm.py` do Caliope já isola o app do servidor de modelo: ele fala com qualquer servidor compatível com a API OpenAI.

## Decisão

1. **O Henduran define uma interface própria, `NarratorProvider`**, entre o orquestrador da Jornada e qualquer modelo. O restante do código só conhece essa interface.
2. **Capacidades da interface:** resposta em *streaming* com cancelamento; resposta completa; saída estruturada com esquema (para propostas ao motor); verificação de saúde; lista de modelos disponíveis; embeddings quando o provedor oferecer.
3. **Implementações previstas:**
   - **Local** (ADR-070), a primeira a ser entregue.
   - **Remota compatível com a API OpenAI**, com chave de API, em momento posterior.
4. **Base de código:** `llm.py` do Caliope, adaptado ao Henduran (nomes, tipos, tratamento de erros e testes), conforme a auditoria.
5. **O provedor não conhece regras do RPG, não altera estado e não valida nada.** Sua saída é **dado não confiável**: a IA propõe, o motor valida e aplica (`04-arquitetura.md`, seções 3 a 6).
6. **Trocar de provedor ou de modelo não pode mudar resultados mecânicos**, que pertencem ao motor.
7. **Chaves de API** ficam em armazenamento seguro do sistema operacional e nunca em logs, saves ou exportações.

## Consequências

- Vantagens: troca de modelo sem tocar a lógica do jogo, testes com provedor falso, caminho claro para a API paga.
- Custos: uma camada a mais para manter; diferenças entre provedores (esquema estruturado, limites de contexto, formato de erro) precisam ser tratadas dentro da interface.

## Em aberto

- Assinatura exata, tipos de eventos do *stream* e política de reintentos.
- Formato do contrato de propostas ao motor (ferramentas estruturadas), tratado em decisão própria.
- Provedores pagos suportados, limites de custo e como a chave é pedida ao jogador.
