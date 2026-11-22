# ADR-060 — Conhecimento e segredos por entidade

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Questão:** P-59
- **Origem:** Aprovação explícita do responsável pelo Henduran

## Contexto

As ADR-008 e ADR-051 aprovam memória do Narrador baseada em fatos estruturados e recuperação híbrida. A ADR-058 separa o conhecimento compartilhado do Mundo das memórias particulares da Jornada e da ramificação, enquanto a ADR-059 mantém o passado anterior à divergência compartilhado por referência. Entretanto, nem todo fato verdadeiro ou disponível ao Narrador deve ser conhecido pelo protagonista ou por um NPC.

## Decisão aprovada

O Henduran implementará **conhecimento e segredos associados às entidades**, com acesso controlado ao Narrador e respeito ao conhecimento efetivo de cada protagonista ou NPC.

- Distinguir **fatos canônicos** de **fatos conhecidos por uma entidade** e de **contexto acessível ao Narrador** para conduzir a cena.
- Manter vínculo de conhecimento entre fatos e personagens, observando Mundo, Jornada, ramificação, versões e momento histórico.
- Permitir ao Narrador consultar segredos necessários à interpretação de NPCs e preparação da cena, de forma controlada.
- Impedir que mera disponibilidade de um segredo ao Narrador se converta em conhecimento do protagonista, falas indevidas de NPCs ou revelações automáticas.
- Aplicar filtros de escopo e conhecimento antes de entregar contexto recuperado por SQLite, FTS5 ou embeddings ao modelo. Instruções de prompt não constituem a única barreira de acesso.
- Qualquer mudança persistente sobre quem conhece um fato deve passar por registro e validação canônica no motor, respeitando continuidades independentes.

## Consequências

Um mesmo fato pode existir como verdade do Mundo, ser conhecido por certos NPCs e permanecer desconhecido para o protagonista. O Narrador poderá conduzir situações de investigação, mentira, rumor e segredo sem confundir seu conhecimento operacional com o das entidades. O sistema precisará validar revelações e atribuições de conhecimento conforme regras ainda a detalhar.

## Pendências explícitas

- Esquema das permissões e das associações fato-entidade, incluindo conhecimento parcial, crença, rumor e informação falsa.
- Níveis e classificação de segredos e escopos de conhecimento, caso sejam adotados.
- Fluxos de aquisição, perda, revelação, compartilhamento e correção de conhecimento.
- Filtros concretos de contexto e regras de fornecimento de segredos ao Narrador.
- Tratamento de diálogos, atos de NPCs, revelações acidentais e validação de consistência.
- Implementação de índices, referências de memória e verificações de acesso.
