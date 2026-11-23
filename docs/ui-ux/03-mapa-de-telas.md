# Mapa de telas

## Arquitetura de navegação

> **MVP (2026-11-23):** a tela da Jornada não tem barra de navegação nem abas (só uma barra fina com o nome da Jornada, o modelo e o ⚙); o layout aprovado está em `09-tela-da-jornada.md`.

**PROPOSTO:** `Menu → Mundos → Jornadas → Jornada ativa`, com superfícies globais de configurações e backups. Dentro da Jornada, navegação persistente e contida: Chat/Cena, mapa-múndi, ficha, inventário, diário e continuidades. A transição narrativa↔tática preserva a mesma Cena e histórico (ADR-020); não cria um “lobby de combate”.

## Telas obrigatórias

| # / tela | Objetivo e fonte | Componentes | Hierarquia/regiões | Navegação | Vazio / carregando / erro | Chat, mapa e auxiliares |
|---|---|---|---|---|---|---|
| 1 Menu principal | entrar, continuar e administrar; GDD desktop | Button, Panel, Notification | título; continuar; bibliotecas; settings/backups | para 2, 4, 14, 15 | sem Jornada; leitura local; falha de banco recuperável | sem mapa/chat ativo |
| 2 Biblioteca de Mundos | listar Mundos reutilizáveis (ADR-021/024) | cards, busca, ContextMenu | filtros; lista; detalhes/versão | criar/editar 3; usar em 4 | empty CTA; indexando; versão/conflito | sem chat/mapa; preview não canônico |
| 3 Criar/configurar Mundo | definir fontes e configuração sem inventar cânone | Window, Tabs, inputs, ProgressBar | dados básicos; geração/importação; revisão | salvar volta 2; cancelar preserva anterior | rascunho; geração; erro/import conflict | **PROPOSTO** assistente separado do Narrador da Jornada |
| 4 Biblioteca de Jornadas | iniciar/retomar/arquivar Jornadas | CharacterCard, cards, ContextMenu | Mundo/filtros; lista; progresso/continuidade | criar via 5; abrir 6; árvore 13 | nenhuma Jornada; leitura; versão incompatível | sem chat/mapa ativo |
| 5 Criação de personagem | criar protagonista e objetivos aprovados | CharacterSheet, Tabs, inputs, DicePrompt apenas se regra exigir | identidade; atributos aprovados; Ambição/Desejo; revisão | confirmar inicia Jornada; voltar sem aplicar | rascunho; validação; regra indisponível | sem mapa; auxílio textual, não Cena |
| 6 Interface principal da Jornada | shell persistente Fora de Cena | ChatMessage/Input, CharacterCard, nav | cabeçalho de contexto; chat dominante; resumo lateral; ações | abre 7–13; encerra/volta com confirmação | histórico vazio contextual; streaming; persistência/IA | chat principal; mapa-múndi só quando aberto; auxiliares sob demanda |
| 7 Cena narrativa | interpretar situação com chat próprio | chat, DicePrompt, contexto, cards | contexto/participantes; histórico dominante; compositor | retorna 6; entra 8 se fase tática | Cena sem mensagens; IA carregando; retry sem duplicar efeitos | chat domina; mapa localizado ausente (ADR-005) |
| 8 Cena tática | resolver situação espacial | canvas Pixi, tokens, turn/status **PENDENTE**, chat secundário | mapa dominante; participantes/ações; chat acessível | volta 7/6 preservando Cena | mapa carregando; assets faltando; estado dessincronizado bloqueia ação | mapa domina, chat secundário nunca removido |
| 9 Mapa-múndi hexagonal | exploração regional (ADR-019) | Pixi canvas, Tooltip, painel de local | hexes; localização; POIs conhecidos; detalhes | abre/fecha a partir 6; viagem pode iniciar Cena | região desconhecida; geração; rota/estado inválido | modo separado; chat Fora de Cena disponível, não sobrepõe tática |
| 10 Ficha do personagem | consultar estado oficial | CharacterSheet, Tabs, ResourceBar | resumo; atributos; condições; objetivos; histórico permitido | overlay/rota de 6–8 | seção vazia; motor lendo; conflito de versão | auxiliar; não substitui chat/mapa |
| 11 Inventário/equipamentos | consultar e operar itens | slots, ItemCard, ContextMenu, Dialog | grade/lista; equipamento; detalhes; ações | overlay de 6–8; comércio contextual | vazio; salvando; operação recusada pelo motor | auxiliar; alterações só após validação |
| 12 Diário/editor literário | consultar diário e gerar/revisar livro (ADR-023, 030–038) | livro opcional, editor DOM, Tabs, ProgressBar | diário factual; capítulos; revisão; exportação | de 6/4; volta preserva rascunho | sem entradas; gerando; exportação falha | chat/mapa ausentes; conteúdo deriva da Jornada, aprovação do jogador |
| 13 Árvore de ramificações | consultar/retomar continuidades (ADR-041/042/043) | canvas/SVG **PROPOSTO**, cards, Dialog | árvore; detalhe; ações de retomar/arquivar/excluir | de 4/6/15; retomar ponto antigo ramifica | linha única; carregando; integridade/conflito | sem chat/mapa; estados nunca se misturam |
| 14 Narrador/provedores IA | escolher local/online e capacidades | Tabs, inputs, cards, ProgressBar, Notification | provedor/modelo; privacidade; download; teste | global ou por Jornada conforme decisão futura | nenhum modelo; download; chave/capacidade/timeout | preview não aplica estado; segredos não aparecem em export/log |
| 15 Salvamentos/backups | restaurar, exportar/importar (ADR-039–049) | listas, Dialog, ProgressBar, file picker nativo | autosaves/marcos; backups; compatibilidade/conflitos | de menu/Jornada/árvore | nenhum backup; verificando; corrompido/incompatível | sem chat/mapa; restauração anterior cria ramificação, não sobrescreve |

## Superfícies adicionais comprovadas

- **PROPOSTO como subestado, não nova tela:** central de downloads/modelos dentro de 14, porque o GDD exige modelos locais e compatibilidade de hardware.
- **CONFIRMADO como capacidade de 12:** revisão editorial, modelos editoriais, capas/metadados e exportação Markdown/PDF/EPUB; separar em tabs evita inflar a navegação.
- **CONFIRMADO como fluxos de 2/3:** importação, canonização e atualização controlada de Mundos, com aprovação de conflitos (ADRs 024–026).
- Memória não recebe tela administrativa na primeira fase: o GDD exige subsistema, mas não exige exposição integral. **PROPOSTO:** diagnóstico mínimo em settings avançados só após critérios de suporte.

## Regras transversais

Loading nunca simula sucesso; erro de IA não duplica transação; operação persistente exibe resultado do motor. Fechar overlay devolve foco ao invocador. Estados vazios explicam o próximo passo sem criar conteúdo canônico. Mapas nunca são usados como decoração de Cena narrativa.

