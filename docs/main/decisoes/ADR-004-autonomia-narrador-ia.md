# ADR-004 — Narrador IA autônomo com regras e permissões

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Questão:** P-08

## Contexto

Henduran é um RPG solo centrado no chat. O Narrador precisa ser capaz de improvisar e conduzir uma Jornada persistente sem comprometer a consistência das regras e a agência do jogador.

## Decisão aprovada

Adotar o **modelo B: Narrador autônomo com regras e permissões**.

- A IA pode narrar, interpretar NPCs, improvisar acontecimentos e propor modificações no mundo.
- Alterações de estado são solicitadas por **ferramentas tipadas e validadas**; o texto da IA, por si, não modifica o estado canônico.
- O motor de regras do Henduran, baseado na adaptação do Astra, permanece a autoridade sobre operações e efeitos mecânicos.
- Escolhas e ações pertencentes ao personagem do jogador não são executadas como decisões autônomas da IA.
- Ferramentas devem limitar escopo, validar pré-condições e devolver um resultado estruturado de sucesso ou recusa.

## Consequências técnicas

1. Separar o serviço de geração narrativa do motor de regras e da persistência.
2. Oferecer ao Narrador operações específicas, com verificação de autorização e validação de estado.
3. Registrar origem e resultado de alterações persistentes para fins de auditoria e eventual correção.
4. Não confiar em texto livre para inferir que uma transação mecânica já ocorreu.
5. Não considerar a rejeição de uma operação como sucesso ficcional consumado.

## Matriz inicial sugerida — ainda não aprovada em detalhe

| Tipo de atividade | Tratamento sugerido |
|---|---|
| Descrever, interpretar NPCs e propor situações | Autonomia narrativa, respeitando fatos persistidos |
| Ler regras e estado necessário | Consulta controlada |
| Criar NPC, cena ou fato duradouro | Ferramenta com validação e registro |
| Pedir teste, causar dano ou aplicar condição | Motor valida pré-condições e resolve; confirmar quando a política específica exigir |
| Comprar, vender, gastar XP, escolher fala/ação do protagonista | Ação do jogador e validação do motor |
| Desfazer fatos, retcon, substituir escolhas anteriores | Política separada, ainda pendente |

A aprovação deste ADR **não** define a política completa de confirmação de testes (P-07), a política de rollback (P-09), nem o conjunto definitivo de ferramentas da IA.

## Critérios iniciais de conformidade

- Uma resposta textual do Narrador não altera automaticamente Vida, Vontade, inventário, XP, localização ou fatos confirmados.
- Uma operação mecânica sem pré-condições atendidas é recusada sem mudança parcial de estado.
- O Narrador não faz escolhas pelo protagonista sem comando correspondente do jogador.
- Uma mudança aceita persiste e pode ser atribuída à operação que a causou.
