# ADR-016 — Reaproveitamento seletivo de componentes do Caliope

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Questão:** P-17 do GDD
- **Decisão:** Reaproveitar seletivamente componentes independentes do Caliope **somente após auditoria de compatibilidade técnica, licença e permissões**. Reescrever os sistemas narrativos e mecânicos específicos do Henduran.

## Contexto

O projeto Caliope possui infraestrutura potencialmente útil para modelos locais e APIs externas, mas sua orquestração de narrativas, regras e estado do jogo não corresponde ao desenho aprovado para o Henduran. Importar todo o backend criaria dependências indevidas e riscos de manutenção e distribuição.

## Decisão aprovada

1. A implementação será própria do Henduran, admitindo código selecionado do Caliope quando puder ser separado, testado e redistribuído legitimamente.
2. Cada componente candidato passará por uma auditoria de dependências, compatibilidade com Tauri + React + TypeScript + PixiJS + Python no Windows, licença e eventuais permissões adicionais.
3. Orquestração narrativa, prompts profundamente acoplados, estado de jogo, combate, progressão e demais regras específicas do Caliope **não serão transplantados** para substituir os sistemas do Henduran.
4. A arquitetura de IA e de memória seguirá as ADRs próprias do Henduran, incluindo validação mecânica pelo motor Astra adaptado (ADR-004) e estado oficial separado da memória recuperável (ADR-008).

## Módulos candidatos à auditoria (não aprovados para cópia automaticamente)

- Conectores de APIs de LLM (`llm.py` ou equivalente).
- Download/gestão de modelos GGUF (`modelhub.py`).
- Gestão de processo e distribuição do llama.cpp (`runtime.py`).
- Memória, índices e embeddings (`memory.py`), considerando diferenças do modelo de fatos canônicos do Henduran.
- Gestão declarativa de skills (`skills.py`), sem assumir execução arbitrária de scripts.

## Critérios de aceite por módulo

- Inventário da função exata e dependências.
- Verificação documental de licença, titularidade e autorização para uso e redistribuição, caso necessárias.
- Adaptação isolada, com interface e testes automatizados.
- Ausência de dependência mecânica dos sistemas próprios do Caliope.
- Compatibilidade com instalação Windows e execução offline quando pertinente.
- Registro de atribuições e obrigações de licença aplicáveis.

## Não decidido nesta ADR

- Quais módulos serão efetivamente reutilizados ou apenas reimplementados.
- Forma jurídica/documental de autorização, caso a licença pública seja insuficiente.
- Runtime Python, empacotamento exato e política de atualização de modelos/binários.
- API interna do sidecar e estratégia de deploy.

## Consequências

A implementação do backend de IA só deverá começar com um inventário e uma auditoria de módulos. Esta ADR **não autoriza** copiar todo o Caliope ou depender de seu motor narrativo.
