# ADR-066 — Verdade canônica somente por regras e operações validadas

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Questão:** P-65
- **Origem:** Decisão explícita do responsável pelo Henduran

## Contexto

As ADR-060 a ADR-065 distinguem acesso a segredos, conhecimentos individuais, alegações, rumores, contradições, grau subjetivo de confiança e avaliação de evidências. Faltava estabelecer qual mecanismo pode confirmar a realidade do Mundo, em contraste com a convicção de um personagem.

## Decisão aprovada

**Fatos canônicos serão estabelecidos somente por regras, acontecimentos efetivamente registrados e operações autorizadas e validadas pelo motor.**

- Evidências, alegações, rumores, suspeitas, inferências e confiança subjetiva **não criam automaticamente fatos canônicos**.
- O Narrador poderá propor acontecimentos ou interpretações, mas não tem autoridade para persistir, modificar ou confirmar sozinho a verdade canônica.
- O motor verificará as permissões, as regras do Mundo, o estado da continuidade e as condições aplicáveis antes de registrar fatos.
- Alterações persistentes autorizadas respeitarão a atomicidade, o histórico e a integridade temporal das ramificações.
- **Ser verdadeiro não significa ser conhecido:** o acesso e a revelação de cada fato continuam sujeitos ao controle de conhecimento por entidade, conforme ADR-060.
- A regra não bloqueia a geração procedural de novos fatos; exige apenas que sejam estabelecidos por operações autorizadas validadas, e não por conclusões não verificadas do modelo.

## Consequências

É necessário distinguir operações de *estabelecimento canônico* de eventos de *aquisição de conhecimento*. O motor não deve aceitar uma alteração de estado canônico apenas porque o Narrador considerou evidências convincentes. O mecanismo de correções explícitas do jogador permanece conforme decisões anteriores, sem alterações automáticas retroativas.

## Pendências explícitas

- Critérios operacionais de autorização e confirmação de fatos.
- Tipos e critérios de evidências, sem confusão entre observação e interpretação.
- Regras de criação procedural de fatos novos e tratamento de conflitos canônicos.
- Mecanismos de revelação, transmissão e sigilo entre entidades.
- Estruturas de validação, auditoria e persistência, sem fixar esquema de banco de dados.
