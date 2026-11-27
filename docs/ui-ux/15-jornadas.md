# Tela Jornadas (lista) e Pontos de retorno

**Estado:** biblioteca redesenhada e Pontos de retorno implementados a partir dos protótipos aprovados em 2026-11-24 (`prototipos/jornadas.html` e `prototipos/tela-da-jornada.html`). A restauração de backups das Jornadas danificadas é uma operação distinta.

## 1. Objetivo

Listar as Jornadas salvas, continuar de onde parou, restaurar uma danificada, excluir, abrir uma **Nova Jornada** e **voltar a um ponto de retorno**.

## 2. Lista de Jornadas

- **Ações da tela**: **Nova Jornada** e, à direita, **Voltar ao menu**, sem cabeçalho visível. Na biblioteca vazia, ambos ficam no convite central.
- **Lista (esquerda)**: campo de busca por nome da Jornada, personagem ou Mundo, sem exigir acentos, seguido dos cartões compactos. Cada cartão mostra nome, retrato, etiquetas (**Última**, **Em Cena**, **Fora de Cena** ou situação de problema) e "salvo há…". Com a busca vazia, aparecem todas as Jornadas.
- **Detalhe (direita)**: identificação curta no topo (retrato, nome, personagem, Mundo, situação) e **lista de Pontos de retorno da Jornada escolhida, sem resumo**. No rodapé, **Continuar Jornada** (ou **Restaurar…** para Jornadas danificadas) e **Excluir Jornada**, lado a lado e alinhados à direita.
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

- **Save padrão**: o estado atual do `journey.db` aparece sempre como primeira linha: **Jogo salvo** na biblioteca e **Jogando agora** dentro da Jornada, com etiqueta **Atual**. Não é um ponto de retorno: não entra nos limites, não mostra contagem de mensagens e não pode ser renomeado, substituído, excluído nem carregado. Na biblioteca, **Continuar** abre a Jornada pelo fluxo normal. A linha continua visível mesmo quando a lista de pontos está vazia ou falha, sem mensagens técnicas.
- **Dentro da Jornada**: menu de opções (engrenagem do topo direito) → **Pontos de retorno**. Abre uma mini-tela com **Salvar agora** (nome opcional) e a lista de pontos.
- **Tipos**: **manual** (o jogador cria) e **automático** (o sistema cria no início e no fim de cada Cena e ao iniciar a Jornada). Automáticos não são editáveis nem excluíveis; ficam os **5** mais recentes. Manuais: até **20**.
- **Ações**: **Carregar** (todos); **Salvar por cima**, **Renomear** e **Excluir** (só manuais). Salvar por cima, Excluir e Carregar pedem confirmação.
- **Carregar**: volta o chat, a Ficha, a Cena e as mudanças locais persistidas na Jornada. Antes disso o estado de agora é guardado em **Antes de carregar**, então dá para desfazer enquanto o ponto estiver retido. Estado da Cena e Diário terão seus dados incluídos conforme passarem a integrar o banco da Jornada.
- **Na lista de Jornadas**: o detalhe oferece Carregar, Renomear e Excluir (sem Salvar por cima, que só faz sentido dentro do jogo); Carregar abre a Jornada naquele ponto.
- Cada ponto mostra nome, tipo, quando, lugar e número de mensagens.

## 4. Decisões confirmadas na implementação

1. **Carregar sobrescreve o estado ativo**, com a rede de segurança **Antes de carregar**. É uma exceção aprovada ao ADR-041 para esta primeira entrega.
2. **20 manuais e 5 automáticos**, incluindo **Antes de carregar**. Ao atingir o limite manual, use **Salvar por cima** ou exclua um manual. Os automáticos são rotacionados do mais antigo ao mais novo.
3. **O Mundo-base permanece na versão fixada na criação da Jornada**. Apenas as alterações locais da partida voltam. Uma divergência da referência do Mundo impede o carregamento.
4. As cópias consistentes do SQLite ficam em `return-points/`, com catálogo independente do banco ativo e retrato incorporado à cópia quando disponível. A restauração publica o banco principal em uma transação SQLite; o Mundo anexado continua somente leitura.

## 5. Pontos a validar

- "Última jogada": a Jornada salva mais recentemente.
- Retrato: o da ficha do personagem; sem retrato, o padrão.
- Campos como Cena e Cenas jogadas dependem de o resumo da Jornada expô-los.
- Conferir criação, carregamento, desfazer e rolagem na aplicação Tauri para Windows.
