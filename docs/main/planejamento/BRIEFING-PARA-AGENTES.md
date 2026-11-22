# Henduran — Briefing para Codex / Claude Code

Este arquivo é um briefing operacional e não autoriza automaticamente mudanças no projeto.

## Missão

Preparar e implementar progressivamente o Henduran, RPG solo desktop Windows com IA narradora. O usuário **não deseja continuar uma sessão interminável de decisões individuais**: usar as ADRs já aprovadas, separar implementação reversível de mudança de produto e encaminhar somente bloqueios reais.

## Leitura obrigatória

1. `docs/design/HENDURAN-GDD.md`
2. `docs/planejamento/CONSOLIDACAO-DE-ESCOPO.md`
3. `docs/planejamento/PLANO-DE-DESENVOLVIMENTO.md`
4. ADRs aplicáveis em `docs/decisoes/`.
5. Fonte do Astra em `midrasil/astra-rules` para regras exatas.

## Restrições essenciais

- Fonte da verdade: motor determinístico e SQLite; IA apenas narra e propõe chamadas validadas.
- P-67 **não foi aprovada**; não assumir opção recomendada.
- Competências e Capacidades fora do escopo inicial.
- Confirmação do jogador antes de toda rolagem fora do tático.
- Estados/ramificações e memórias não podem se misturar.
- Chat histórico e checkpoints de save são mecanismos distintos.
- Não presumir que títulos e planos `[PROPOSTO]` estejam aprovados.
- Não distribuir sprites comerciais Franuka nem componentes Caliope sem auditoria de licença.
- Não inventar valores de regras não presentes na wiki ou decisões.

## Entrega inicial solicitada

**Primeiro entregar** um relatório curto de auditoria com: estado real dos repositórios, arquivos/fontes relevantes, lacunas da matriz Astra, riscos de licença, arquitetura mínima proposta para M0-M3, e sequência de PRs pequenas com testes de aceite. Depois iniciar M0.

**Priorizar um slice** com: personagem salvo, Cena social com NPC, uma compra transacional, um teste com confirmação fora do tático e recuperação consistente ao reiniciar.

## Protocolo de decisões

Ao encontrar um detalhe técnico reversível, escolher solução documentada e testada, mantendo o contrato aprovado. Ao encontrar um bloqueio de gameplay, licença ou produto, formular **uma consulta agrupada e objetiva**, com motivo, impacto e alternativas.

Não criar automaticamente novas ADRs como se fossem aprovadas pelo autor.
