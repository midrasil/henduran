# 13 — Tela de Mundos (menu inicial)

**Estado: modelo inicial PROVISÓRIO**, implementado em 2026-11-24 **sem protótipo**, por decisão explícita do responsável (exceção à regra de `10-prototipagem.md`). O protótipo será feito em **2026-11-25, em outra máquina**; depois a tela será ajustada a ele. Item no `docs/backlog.md`.

## O que existe

- **Menu inicial**: botão **Mundos**, entre Jornadas e Sair (`11-menu-inicial.md`, nota de 2026-11-24).
- **Tela** (`app/src/screens/WorldsScreen.tsx`): um painel só, na linguagem do assistente de Nova Jornada, reaproveitando o passo Mundo (`WorldStep`, em modo `library`, sem lugar inicial).
  - **Lista** dos Mundos salvos: nome, era e tom, "semente N" ou **"Mundo personalizado"** (editado, criado do zero ou duplicado; sem semente) e "Usado em N Jornadas" ou "Ainda sem Jornadas".
  - **Detalhes** à direita, somente leitura, com as abas do Mundo (Geral, Calendário, Religiões, Lugares).
  - **Criar**: Semente com Usar, **Gerar mundo** (aleatório) e **Criar do zero**, com edição e validação ao vivo como no assistente; **Salvar Mundo** (`POST /worlds`) grava o Mundo sem Jornada. Erros aparecem nos campos e nada é gravado.
  - **Duplicar e editar**: a cópia vira um Mundo novo (personalizado), salvo por Salvar Mundo.
  - **Excluir**: diálogo de confirmação; Mundo usado por alguma Jornada não pode ser excluído (o diálogo explica e o botão fica desabilitado; o serviço também recusa com `mundo_em_uso`).
- **Excluir uma Jornada não apaga mais o Mundo dela** (o Mundo continua na lista, pronto para outra Jornada).

## O que o protótipo deve decidir

- Layout da lista (cartões, filtro, ordenação, Mundos ilegíveis) e do detalhe.
- O fluxo de criação: na própria tela, num diálogo ou num assistente; o que acontece com um Mundo novo não salvo ao sair.
- A exclusão: onde fica o botão, o texto do diálogo e o que mostrar de um Mundo em uso (quais Jornadas).
- Organização futura em **abas de geração** (por exemplo, gerar por partes: era, calendário, religiões, lugares) e a relação com a Nova Jornada (escolher um Mundo daqui ao começar).
- Posição e ícone do botão Mundos no menu.
