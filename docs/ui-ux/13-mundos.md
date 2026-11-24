# 13 — Tela de Mundos (menu inicial)

**Estado: aprovado como está (2026-11-24).** O modelo inicial foi implementado em 2026-11-24 **sem protótipo** (exceção à regra de `10-prototipagem.md`, decisão do responsável); depois de vê-lo funcionando, o responsável o aprovou **sem pedir mudanças**, e o protótipo [`prototipos/mundos.html`](prototipos/mundos.html) foi feito **só como registro** da tela implementada. A nota "Tela provisória" do cabeçalho foi removida do app e do protótipo.

## O que existe

- **Menu inicial**: botão **Mundos**, entre Jornadas e Sair (`11-menu-inicial.md`, nota de 2026-11-24).
- **Tela** (`app/src/screens/WorldsScreen.tsx`): um painel só, na linguagem do assistente de Nova Jornada, reaproveitando o passo Mundo (`WorldStep`, em modo `library`, sem lugar inicial).
  - **Lista** dos Mundos salvos: nome, era e tom, "semente N" ou **"Mundo personalizado"** (editado, criado do zero ou duplicado; sem semente) e "Usado em N Jornadas" ou "Ainda sem Jornadas".
  - **Detalhes** à direita, somente leitura, com as abas do Mundo (Geral, Calendário, Religiões, Lugares).
  - **Criar**: Semente com Usar, **Gerar mundo** (aleatório) e **Criar do zero**, com edição e validação ao vivo como no assistente; **Salvar Mundo** (`POST /worlds`) grava o Mundo sem Jornada. Erros aparecem nos campos e nada é gravado.
  - **Duplicar e editar**: a cópia vira um Mundo novo (personalizado), salvo por Salvar Mundo.
  - **Excluir**: diálogo de confirmação; Mundo usado por alguma Jornada não pode ser excluído (o diálogo explica e o botão fica desabilitado; o serviço também recusa com `mundo_em_uso`).
- **Excluir uma Jornada não apaga mais o Mundo dela** (o Mundo continua na lista, pronto para outra Jornada).

## Pontos que ficam para uma revisão futura (não bloqueiam)

- Layout da lista (cartões, filtro, ordenação, Mundos ilegíveis) e do detalhe.
- O fluxo de criação: na própria tela, num diálogo ou num assistente; o que acontece com um Mundo novo não salvo ao sair.
- A exclusão: onde fica o botão, o texto do diálogo e o que mostrar de um Mundo em uso (quais Jornadas).
- Organização futura em **abas de geração** (por exemplo, gerar por partes: era, calendário, religiões, lugares) e a relação com a Nova Jornada (escolher um Mundo daqui ao começar).
- Posição e ícone do botão Mundos no menu.
