# 05 — Narrador IA

**Status:** requisitos funcionais e limites de autoridade. Não define prompts definitivos nem APIs.

## 1. Papel

O Narrador IA é o principal mediador da experiência do Henduran. Conduz a ficção, interpreta NPCs, descreve lugares e acontecimentos, improvisa situações coerentes e reage às decisões do jogador. Deve servir à Jornada, à Ambição e ao Desejo do personagem sem impor um roteiro fixo.

## 2. Dois contextos de conversa

### Fora de Cena

Diálogo direto entre jogador e Narrador: explicações, dúvidas, planos, consulta de informações e orientação durante exploração. Mensagens dessa conversa não são automaticamente falas/ações do personagem nem justificam, sozinhas, mudanças de estado.

### Em Cena

Chat contextualizado em uma situação específica. O Narrador representa o ambiente e os NPCs; o jogador declara ações e falas do personagem. Uma Cena pode iniciar por vontade do jogador, por NPCs, por consequências anteriores ou por eventos procedurais. Uma Cena não precisa envolver combate.

## 3. Regras e autoridade

O motor é a autoridade sobre ficha, testes, inventário, efeitos, rolagens, recursos, posição tática e fatos persistentes oficiais. O Narrador pode propor operações por ferramentas validadas; não pode assegurar um resultado mecânico sem retorno do motor. A liberdade de narrativa deve permanecer ampla dentro dessa fronteira.

O Narrador não escolhe ações voluntárias do personagem do jogador e não deve alterar estados por insinuação textual.

## 4. Contexto e memória

O contexto de uma geração deve priorizar:

1. regras relevantes **da wiki própria Henduran**, não regras originais conflitantes do Astra;
2. estado oficial pertinente e informação que o Narrador pode conhecer;
3. resumo da Jornada e sua Ambição/Desejo;
4. contexto ativo da Cena (participantes, lugar, situação e mensagens recentes);
5. memória recuperada de fatos antigos relevantes, com procedência e confiabilidade.

Memória narrativa e estado oficial são diferentes. Rumores, suposições, mentiras de NPCs e fatos confirmados não podem ser misturados indistintamente. A troca de LLM não pode apagar a continuidade do mundo.

## 5. Skills

Skills podem fornecer instruções especializadas de interpretação, estilo, geração de acontecimentos ou consulta, mas **não substituem o motor de regras**. Estudar o sistema `SKILL.md` do Caliope como referência; decidir posteriormente seleção, ativação, limites de contexto e política de scripts. Conteúdo de skill importado não deve ter permissão implícita para executar código ou alterar arquivos.

## 6. Modelos

- **Local:** baixar/importar modelos compatíveis, gerenciar GGUF, carregar/descarregar e apresentar indicadores de compatibilidade de hardware.
- **Online:** permitir provedores por API key e configurações próprias, deixando explícito quando dados da narrativa são enviados ao provedor.
- **Independência:** mesmo protocolo lógico de mensagens, streaming, erros e ferramentas para modelos diferentes, com tratamento para capacidades distintas.

O produto deve funcionar como uma aplicação desktop, sem exigir navegador nem serviço de IA online quando um modelo local adequado estiver disponível.

## 7. Comportamentos a validar

- Narrador mantém identidade e personalidade de NPCs ao longo de Cenas diferentes.
- Narrador não transforma perguntas Fora de Cena em ações fictícias.
- Solicitações de teste não resultam em rolagem inventada.
- Compra de item só altera recursos após operação válida.
- Memória não cria retroativamente fatos que contradizem o estado oficial.
- Mudanças de modelo e de janela de contexto preservam a Jornada.
- Resposta interrompida, erro de inferência ou retry não duplicam transações.

## 8. Pendências

- Política exata de confirmação e contestação.
- Contratos e schemas de ferramentas.
- Roteamento de contexto, memória, resumos e possíveis embeddings.
- Suspender e reabrir Cenas. A abertura (inclusive a Cena inicial da Jornada) e o encerramento no MVP estão no ADR-076.
- Estratégia para minimizar alucinações em modelos locais menores.
- Extensão do suporte a serviços de API que não implementam ferramentas de forma uniforme.
