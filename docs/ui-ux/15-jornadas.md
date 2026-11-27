# Tela Jornadas (lista) e Pontos de retorno

**Estado:** protótipo aprovado em 2026-11-24: `prototipos/jornadas.html` (lista) e, no menu de opções da Jornada, `prototipos/tela-da-jornada.html` (pontos de retorno). A biblioteca redesenhada está implementada em `JourneysScreen.tsx` com os dados da API existente. O painel de uma Jornada pronta informa que os Pontos de retorno ainda não estão disponíveis; a restauração de backups para Jornadas danificadas continua disponível.

## 1. Objetivo

Listar as Jornadas salvas, continuar de onde parou, restaurar uma danificada, excluir, abrir uma **Nova Jornada** e **voltar a um ponto de retorno**.

## 2. Lista de Jornadas

- **Ações da tela**: **Nova Jornada** e, à direita, **Voltar ao menu**, sem cabeçalho visível. Na biblioteca vazia, ambos ficam no convite central.
- **Lista (esquerda)**: campo de busca por nome da Jornada, personagem ou Mundo, sem exigir acentos, seguido dos cartões compactos. Cada cartão mostra nome, retrato, etiquetas (**Última**, **Em Cena**, **Fora de Cena** ou situação de problema) e "salvo há…". Com a busca vazia, aparecem todas as Jornadas.
- **Detalhe (direita)**: **só a lista de Pontos de retorno da Jornada escolhida, sem resumo**. Topo com **Continuar Jornada**, **Excluir** e uma identificação curta (retrato, nome, personagem, Mundo, situação).
- **Lista vazia**: o aviso "Nenhuma Jornada ainda", com o botão Nova Jornada, **ocupa todo o espaço útil**.

| Situação | Detalhe |
|---|---|
| Pronta | Continuar habilitado; lista de pontos |
| Danificada | alerta com o motivo; **Restaurar…** (escolha de backup; o arquivo danificado é guardado ao lado) |
| Versão mais nova | alerta pedindo para atualizar o app; Continuar desabilitado |
| Sem Mundo | alerta; Continuar desabilitado; pode excluir |

**Excluir a Jornada** pede confirmação e apaga também os pontos de retorno e os backups; o Mundo continua salvo.

## 3. Pontos de retorno

Salvamentos da Jornada, como nos jogos, com o nome **Pontos de retorno** (sugestão; pode mudar).

- **Dentro da Jornada**: menu de opções (engrenagem do topo direito) → **Pontos de retorno**. Abre uma mini-tela com **Salvar agora** (nome opcional) e a lista de pontos.
- **Tipos**: **manual** (o jogador cria) e **automático** (o sistema cria no início e no fim de cada Cena e ao iniciar a Jornada). Automáticos não são editáveis nem excluíveis; ficam os **5** mais recentes. Manuais: até **20**.
- **Ações**: **Carregar** (todos); **Salvar por cima**, **Renomear** e **Excluir** (só manuais). Salvar por cima, Excluir e Carregar pedem confirmação.
- **Carregar**: volta o chat, a Ficha, o Estado da Cena e o Diário como estavam; antes disso o estado de agora é guardado num ponto automático **"Antes de carregar"**, então dá para desfazer.
- **Na lista de Jornadas**: o detalhe oferece Carregar, Renomear e Excluir (sem Salvar por cima, que só faz sentido dentro do jogo); Carregar abre a Jornada naquele ponto.
- Cada ponto mostra nome, tipo, quando, lugar e número de mensagens.

## 4. Decisões assumidas no protótipo (a confirmar na implementação)

1. **Carregar sobrescreve a Jornada atual**, com a rede de segurança "Antes de carregar" (a alternativa, bifurcar em uma cópia, ficou descartada por ora).
2. **Limites** de 20 manuais e 5 automáticos: valores de partida.
3. **O Mundo não volta com o ponto** (é salvo à parte e persistente). Falta definir o que acontece quando o Mundo mudou desde o ponto (por exemplo, um lugar alterado).

## 5. Pontos a validar

- "Última jogada": a Jornada salva mais recentemente.
- Retrato: o da ficha do personagem; sem retrato, o padrão.
- Campos como Cena e Cenas jogadas dependem de o resumo da Jornada expô-los.
- Armazenamento: um ponto é cópia do `journey.db` (ADR-075) ou diferença? Impacta tamanho em disco e a retenção dos backups (backlog, "retenção dos backups automáticos").
