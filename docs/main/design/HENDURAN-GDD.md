# Henduran — Game Design Document (GDD)

**Versão do documento:** 6.9 — Consolidação e encerramento da rodada de decisões críticas  
**Data:** 22 de novembro de 2026  
**Estado do projeto:** pré-produção; repositório novo, implementação ainda não iniciada  
**Escopo da versão:** decisões confirmadas e propostas de especificação, sem converter hipóteses em requisitos; rodada de questões críticas encerrada após P-66  
**Fontes:** conversas do projeto Henduran; repositórios [`midrasil/astra-rules`](https://github.com/midrasil/astra-rules), [`midrasil/henduran`](https://github.com/midrasil/henduran) e referência técnica [`CODED-Xavier/Caliope`](https://github.com/CODED-Xavier/Caliope). Consulta de repositórios nesta elaboração: árvore e arquivos principais do Astra, amostra de componentes do Caliope. O repositório remoto do Henduran estava vazio no momento da consulta; assets locais não foram inspecionados.

> **Status de decisão.** **[CONFIRMADO]** decisão expressamente afirmada pelo autor; **[ADAPTADO]** regra do Astra que necessita de versão própria para Henduran (o comportamento exato pode permanecer pendente); **[PROPOSTO]** solução recomendada, não aprovada; **[PENDENTE]** definição inexistente ou insuficiente; **[DESCARTADO]** alternativa expressamente abandonada. Um detalhe *existente no Astra* não é automaticamente uma regra *aprovada no Henduran*.

## Sumário

1. [Visão geral](#i-visão-geral)
2. [Experiência do jogador](#ii-experiência-do-jogador)
3. [Estrutura narrativa](#iii-estrutura-narrativa)
4. [Personagens](#iv-personagens)
5. [Sistema de regras](#v-sistema-de-regras)
6. [Exploração e mundo](#vi-exploração-e-mundo)
7. [Combate](#vii-combate)
8. [Sistemas complementares](#viii-sistemas-complementares)
9. [Interface e experiência de uso](#ix-interface-e-experiência-de-uso)
10. [Direção artística e audiovisual](#x-direção-artística-e-audiovisual)
11. [Arquitetura técnica](#xi-arquitetura-técnica)
12. [Escopo e planejamento](#xii-escopo-e-planejamento)
13. [Pendências de design](#xiii-pendências-de-design)
14. [Critérios de aceite transversais](#xiv-critérios-de-aceite-transversais)
15. [Glossário](#xv-glossário)
16. [Registro de decisões e referências](#xvi-registro-de-decisões-e-referências)

---

## I. Visão geral

### 1. Identidade e conceito

**[CONFIRMADO]** Henduran é um RPG digital de fantasia, solo, procedural e **AI-first**. Sua experiência principal é conversar com um **Narrador IA** por chat, interpretar livremente um único personagem e viver uma Jornada contínua em um mundo com consequências persistentes. O Narrador descreve situações, interpreta NPCs, responde às decisões do jogador, solicita resoluções quando necessário e desenvolve acontecimentos contextualizados. O **Astra**, sistema próprio do autor, fornece a base das regras, adaptada especificamente para o Henduran.

**[CONFIRMADO]** A aplicação é **exclusivamente desktop**, permite **modelos de linguagem locais baixados pela plataforma** e uso opcional de **provedores online mediante API key**. O desenvolvimento do software será conduzido por **Codex e/ou Claude Code**, sem expectativa de implementação manual pelo autor. A interface usará um **pacote comercial de UI pixel art**. O jogador explorará um mapa-múndi hexagonal e, nas situações adequadas, utilizará mapas localizados com grid e tokens em formato de moeda. Esses recursos dão suporte ao chat; não invertem a prioridade narrativa.

**[CONFIRMADO]** A Jornada tem uma **Ambição** (objetivo de longo prazo, central à vida do personagem) e um **Desejo** (objetivo atual). Eles dão direção ao jogo, mas não limitam a liberdade do jogador. O mundo não precisa existir exclusivamente em função desses objetivos.

**[PENDENTE]** Classificação etária, plataforma desktop além de Windows, distribuição comercial, licenciamento do produto, cenários/lore iniciais, preço, acessibilidade mínima e critérios para conclusão de uma Jornada.

### 2. Proposta de valor e público

**[CONFIRMADO]** O diferencial pretendido é uma experiência de RPG de mesa solo mediada por IA, em que o jogador escreve e atua livremente, sem se limitar a comandos fixos, enquanto o software automatiza o sistema próprio e mantém continuidade entre Cenas.

**[PROPOSTO]** Público prioritário: pessoas que gostam de RPG de mesa, narrativa interativa, criação de personagens e campanhas solo, e aceitam que a qualidade literária varie com o modelo de IA escolhido. Este perfil é uma hipótese para testes, não uma pesquisa de mercado realizada.

### 3. Pilares de design

| Pilar | Implicação verificável | Estado |
|---|---|---|
| Chat como experiência central | Toda ação narrativa importante pode ser declarada em linguagem natural; mapa não substitui conversa | [CONFIRMADO] |
| Agência do jogador | IA não decide, por conveniência, ações voluntárias do protagonista | [CONFIRMADO] |
| Narrador expressivo, motor confiável | IA interpreta e propõe; motor valida regras e estado oficial | [CONFIRMADO] |
| Jornada persistente | Cenas afetam recursos, NPCs, lugares e oportunidades futuras | [CONFIRMADO] |
| Sistema Astra adaptado | Wiki interna e mecânicas específicas do Henduran, sem dependência de runtime do `astra-rules` | [CONFIRMADO] |
| Procedural a serviço da narrativa | Eventos e mapas apoiam o drama; a cada hexágono não corresponde necessariamente uma chamada à IA | [CONFIRMADO na documentação anterior; sujeito a revalidação para Henduran] |
| IA intercambiável | Jogador escolhe LLM local ou API externa | [CONFIRMADO] |

### 4. Não objetivos iniciais

**[CONFIRMADO]** Não desenvolver um sistema genérico de RPG que permita trocar livremente a base Astra; não implementar **Competências nem Capacidades** na primeira versão; não exigir navegador nem versão web; não construir em torno de combate gráfico em tempo real.

**[PENDENTE]** Multiplayer, editor de campanhas, marketplace, criação visual de mapas, ferramentas de mods, voz e geração de imagens não foram aprovados como requisitos iniciais.

## II. Experiência do jogador

### 1. Fantasia central e metas

O jogador cria e interpreta seu personagem, determina seus objetivos e conversa com um Narrador capaz de representar o mundo. **Ambição** dá direção de longo prazo; **Desejo** acompanha a motivação atual. Descobrir uma pista, negociar com um ferreiro, investigar uma casa ou sobreviver a uma emboscada são atividades potencialmente relevantes, mesmo quando não estão vinculadas a uma missão formal. **[CONFIRMADO]**

| Horizonte | Manifestação | Estado |
|---|---|---|
| Imediato | Responder ao Narrador, negociar, investigar, decidir uma ação | [CONFIRMADO] |
| Atual | Trabalhar em direção ao Desejo | [CONFIRMADO] |
| Longo | Perseguir a Ambição e lidar com suas consequências | [CONFIRMADO] |
| Meta de encerramento | Concluir uma Ambição encerra um arco, não necessariamente a Jornada; o jogador pode prosseguir com outra Ambição ou optar por finalizar | [CONFIRMADO — ADR-022]; condições excepcionais pendentes |

### 2. Loop principal

**[CONFIRMADO]** O jogo alterna entre **Fora de Cena**, quando o jogador se dirige ao Narrador e explora/planeja, e **Em Cena**, quando um acontecimento delimitado é interpretado em chat próprio. O início de uma Cena **não depende** de um evento aleatório: uma escolha do jogador, como entrar na forja de uma cidade e conversar com o ferreiro, é razão suficiente para iniciar uma Cena.

```text
Jornada carregada
  → Fora de Cena: conversar com o Narrador, consultar estado e/ou explorar
    → jogador declara intenção (ex.: visitar ferreiro)
    → Narrador e motor avaliam contexto e iniciam uma Cena quando adequado
      → Cena: chat próprio, personagens e contexto local
        → diálogos e ações livres
        → teste/ação estruturada, se necessário
        → combate tático, se necessário (não é obrigatório)
      → desfecho/encerramento validado
    → estado persistente atualizado
  → Fora de Cena, com novas possibilidades
```

**[PROPOSTO]** Se uma intenção puder ser atendida por uma resposta de informação sem representar acontecimento na ficção, o Narrador responde Fora de Cena. Se exige interpretação de NPC, negociação ou ação em tempo ficcional, a situação candidata a Cena deve ser identificável e rastreável.

### 3. Loop secundário de interação e teste

```text
Jogador informa ação → Narrador interpreta intenção →
  sem incerteza mecânica: narrativa coerente + registro se persistente
  com incerteza: solicita teste estruturado →
    jogador confirma (fora de combate, conforme documentação conceitual anterior) →
    motor monta reserva e rola → IA recebe resultado → IA narra consequência
```

**[PENDENTE]** O fluxo exato de confirmação de rolagens, se toda rolagem fora de combate exige aprovação e as exceções em combate; o Henduran ainda não ratificou a política em novo documento. A regra operacional da antiga documentação é apresentada como candidata, não imposta silenciosamente.

### 4. Sucesso, falha e continuidade

**[CONFIRMADO]** Nem todo teste falho termina uma Cena ou bloqueia o jogo. As consequências devem respeitar o mundo e as regras, sem retirar a agência do jogador. **[PROPOSTO]** Distinguir formalmente: sucesso de ação, resolução de Cena, conclusão de Desejo, conclusão de Ambição e término da Jornada; são estados distintos. **[CONFIRMADO — ADR-022]** Concluir uma Ambição encerra um arco narrativo e não encerra automaticamente a Jornada. O jogador pode continuar com outra Ambição ou escolher concluir sua Jornada. **[CONFIRMADO — ADR-027]** A derrota não equivale necessariamente à morte: derrotas elegíveis acumulam um contador permanente; ao esgotar o limite de derrotas sobrevivíveis, a **derrota seguinte** causa morte definitiva do protagonista e encerramento da Jornada. **[CONFIRMADO — ADR-028]** Apenas incapacitações mecânicas do protagonista em combate contam como derrotas elegíveis para o contador de mortalidade. **[PENDENTE]** Limite numérico, regra mecânica exata para caracterizar a incapacitação, situações especiais, reinício, epílogos e forma exata dos finais.

## III. Estrutura narrativa

### Continuidade e encerramento da Jornada (ADR-022)

**[CONFIRMADO]** Uma Jornada pode atravessar vários arcos narrativos. A conclusão de uma Ambição marca o desfecho de um arco, mas **não impõe** o fim da Jornada. O jogador pode decidir encerrar a Jornada ou prosseguir com outra Ambição, de acordo com as condições narrativas já aprovadas na ADR-011. A continuidade ocorre na mesma Jornada e conserva o estado persistente, suas consequências e a história anterior.

**[CONFIRMADO]** O Narrador pode propor um fechamento narrativo para o arco concluído, mas não escolhe unilateralmente o fim da Jornada nem a nova Ambição do protagonista. **[PROPOSTO]** Separar no estado da aplicação `arco_concluido`, `jornada_ativa` e `jornada_encerrada`, sem converter essa proposta de campos em contrato técnico aprovado.

**[CONFIRMADO — ADR-027]** A Jornada usa mortalidade progressiva: derrotas elegíveis anteriores ao limite não matam automaticamente, são registradas permanentemente e podem ter consequências mecânicas/narrativas; depois de esgotadas as derrotas sobrevivíveis, a próxima derrota elegível causa morte definitiva e encerra a Jornada. **[CONFIRMADO — ADR-028]** Apenas incapacitação mecânica em combate incrementa o contador; capturas, rendições, fracassos narrativos, falhas de testes, retiradas e derrotas sociais não o incrementam por si só. **[CONFIRMADO — ADR-029]** Cada incapacitação sobrevivida pode produzir consequências contextuais propostas pelo Narrador IA, como captura, perdas ou ferimentos, desde que as alterações mecânicas sejam validadas pelo motor e respeitem o estado canônico; não há penalidade universal fixa aprovada. **[PENDENTE]** Quantidade de derrotas sobrevivíveis, limiar mecânico de incapacitação, lista e intensidade de penalidades, outros eventos que inviabilizem a continuidade, epílogo, créditos, retrospectiva e possibilidade de reabertura de Jornada encerrada. **[CONFIRMADO — ADR-023]** Diário literário e geração de livro exportável, com capítulos e revisão assistida por IA; os formatos e o processo de geração permanecem pendentes. A decisão não autoriza encerrar a Jornada automaticamente apenas por satisfação do Desejo ou Ambição.


### 1. Conceito e tipos de interação

**[CONFIRMADO]** Uma **Cena Henduran** é uma unidade narrativa contextualizada com **chat próprio**. Pode começar por iniciativa do jogador, ação de um NPC, consequência anterior, exploração ou evento procedural. Pode conter apenas conversa, testes, investigação, comércio ou conflito. Não exige combate. **[CONFIRMADO — ADR-005]** Cenas narrativas não exibem mapa localizado: essa representação fica restrita a situações táticas.

**[CONFIRMADO]** **Fora de Cena** é a interação direta com o Narrador, não uma conversa interpretada pelo personagem. Isso pode incluir dúvidas sobre regras, planejamento, contexto do mundo e deslocamento pelo mapa-múndi. **[PROPOSTO]** Manter um canal explícito de correção/contestação distinto das falas de personagem, inclusive durante uma Cena, para impedir que dúvidas sejam registradas como ações ficcionais.

**Importante:** a palavra *Cena* também aparece no Astra de mesa; **Cena narrativa** e **Cena Tática** são conceitos mecânicos daquele sistema. Uma Cena Henduran pode conter uma **fase tática** sem necessariamente abrir outro chat. **[CONFIRMADO — ADR-005]** Somente a fase tática utiliza mapa localizado. O modo de abertura/fechamento dessa fase e sua relação exata com o ciclo de vida da Cena permanecem **[PENDENTES]**.

### 2. Ciclo de vida de Cena

| Estado conceitual | Gatilho de entrada | Operações principais | Saída/condição | Estado |
|---|---|---|---|---|
| Candidata | Intenção, contexto ou acontecimento | Identificar local, participantes, motivo e continuidade | Decidir se inicia Cena ou responde Fora de Cena | [PROPOSTO] |
| Aberta | Situação contextualizada | Criar chat, vincular estado inicial, apresentar contexto | Cena passa a ser interativa | [CONFIRMADO no princípio; detalhes PROPOSTOS] |
| Ativa | Jogador e IA interagem | Mensagens, ações, testes, registro e eventual fase tática | Conclusão ou suspensão | [CONFIRMADO no princípio] |
| Suspensa | Interrupção que exige retomada | Preservar estado e contexto | Retorno ou encerramento | [PENDENTE] |
| Encerrada | Situação resolvida ou deslocamento de foco | Consolidar efeitos persistentes e histórico | Retorno Fora de Cena ou nova Cena | [CONFIRMADO no princípio; validação PENDENTE] |

**[PROPOSTO]** Persistir separadamente `scene_id`, `journey_id`, local, participantes, estado, mensagens, relações com eventos e versão de regras utilizada. As mensagens são evidência narrativa; **não** substituem o estado oficial. Não decidir apenas pelo texto gerado se uma transação, dano, deslocamento ou gasto aconteceu.

### 3. Eventos e procedimentos narrativos

Eventos podem surgir de contexto, consequências ou geração procedural. **[CONFIRMADO]** A aleatoriedade do mapa é apenas **uma** fonte de Cenas; visita a estabelecimento, busca por NPC ou investigação voluntária também iniciam Cenas. **[PROPOSTO]** Diferenciar uma proposta de evento de um evento confirmado: o Narrador propõe, o motor verifica consistência e o jogador conserva escolhas aplicáveis.

**[PENDENTE]** Frequência, tabelas/pesos, gatilhos, risco, tempo decorrido e possibilidade de eventos simultâneos. Não presumir que o Narrador gere automaticamente uma missão formal a cada conversa.

### 4. Exemplo canônico de fluxo: a forja

1. Fora de Cena, em uma cidade, jogador informa: “Vou até o ferreiro para comprar uma espada”. **[CONFIRMADO: situação desejada]**
2. O sistema contextualiza a forja e inicia uma Cena com chat próprio. **[CONFIRMADO em alto nível]**
3. A IA descreve o ambiente, interpreta o ferreiro e negocia livremente; os preços e itens declarados precisam ser coerentes com dados aprovados do mundo. **[PROPOSTO: fonte estruturada para mercadorias]**
4. Se houver uma compra, o motor valida disponibilidade, preço, saldo e regras aplicáveis; registra débito/crédito e inventário. **[PROPOSTO: transação atômica]**
5. O ferreiro pode lembrar da interação em encontros futuros quando o fato for persistente. **[CONFIRMADO: continuidade; forma técnica PROPOSTA]**
6. O desfecho encerra a Cena e devolve o jogador ao estado Fora de Cena. **[CONFIRMADO em alto nível]**

A compra **não** exige teste por padrão. **[PENDENTE]** Política para barganha, escassez, moedas e preços específicos do cenário.

### 5. Memória e reatividade

**[CONFIRMADO]** O mundo precisa conservar consequências para além do chat e das Cenas. O Narrador deve ter acesso adequado a informações relevantes, sem tratar toda mensagem gerada como verdade persistente.

**[CONFIRMADO — ADR-008]** O Narrador usa **memória híbrida**: (a) **estado oficial** — fichas, recursos, lugares, relações e efeitos aceitos; (b) **fatos estruturados** persistentes; (c) **resumos narrativos** por Cena e outros recortes relevantes; (d) **busca semântica** para recuperar contexto. Memória recuperada não substitui o estado oficial nem autoriza aplicar modificações mecânicas. **[PROPOSTO]** Registrar a origem de cada fato, controle de versões e conhecimento por personagem (quem sabe o quê). A recuperação por busca textual ou semântica pode aproveitar conceitos do Caliope, mas não determinar mecanicamente o saldo ou a posição de alguém.

**[CONFIRMADO — ADR-051]** A recuperação da memória do Narrador será **híbrida**, combinando consultas aos fatos estruturados e entidades canônicas mantidos no **SQLite**, busca textual com **FTS5** e **embeddings semânticos** para identificar contexto relevante mesmo com redações diferentes. Os vetores e demais estruturas de recuperação semântica serão **índices auxiliares reconstruíveis** a partir de dados persistidos, e **não** uma segunda fonte da verdade. A recuperação poderá reunir resultados textuais, semânticos e filtros estruturados para apoiar a narração, sempre respeitando o estado oficial e a continuidade ativa. A ausência, corrupção ou desatualização do índice semântico não poderá modificar o cânone: a aplicação deverá ser capaz de reconstruí-lo; mecanismos específicos de degradação e reconstrução ainda serão definidos. **[CONFIRMADO — ADR-052]** A geração dos **embeddings** será configurável, permitindo ao jogador escolher entre um **modelo local** e uma **API remota compatível**. O modelo de geração de vetores não precisa ser o mesmo utilizado para a narração. A memória canônica permanecerá no SQLite; ao trocar de modelo ou provedor, os índices semânticos auxiliares deverão poder ser **reconstruídos** a partir dos dados persistidos, sem reescrever fatos canônicos. A operação remota depende de configuração do jogador e poderá implicar conexão, envio de trechos de memória ao provedor e custos; a opção local não exige essa transmissão. Modelos e provedores específicos, requisitos de hardware, dimensões vetoriais, formato e local de armazenamento, reindexação, atualização de índices e parâmetros de recuperação seguem não decididos. **[CONFIRMADO — ADR-053]** Quando embeddings estiverem indisponíveis, corrompidos, incompatíveis ou em reconstrução, **a Jornada continuará** com recuperação de memória por **fatos estruturados do SQLite, filtros autorizados e busca textual FTS5**. O Narrador e a interface deverão **informar a limitação temporária da recuperação semântica**, sem apresentar esse modo como memória completa. O índice semântico voltará a ser utilizado somente após sua disponibilidade e validação; sua indisponibilidade não autoriza inventar lembranças, ignorar fatos canônicos nem misturar estados de ramificações. A escolha não determina frequência de tentativas ou detalhes da reindexação. **[CONFIRMADO — ADR-054]** A atualização da memória semântica ocorrerá por **indexação incremental assíncrona**: os fatos e eventos canônicos deverão ser confirmados primeiro no SQLite e, então, os trabalhos de embeddings serão registrados em fila para processamento separado, **sem bloquear a Jornada**. Enquanto um fato novo ainda não estiver indexado semanticamente, ele continuará acessível por consulta canônica estruturada e, quando pertinente, FTS5; a indexação atrasada ou falha não modificará a verdade do jogo. A fila e o índice auxiliar deverão manter vínculos com Mundo, Jornada, continuidade e versão canônica pertinentes; resultados de gerações antigas não poderão sobrescrever indexação mais recente ou contaminar outras ramificações. **[CONFIRMADO — ADR-055]** Falhas temporárias na geração de embeddings terão **novas tentativas controladas**, separadas por **intervalos progressivos** e sujeitas a um **limite de tentativas**. Trabalhos que atingirem esse limite ou demandarem intervenção permanecerão identificáveis como **não concluídos**, para posterior **reprocessamento manual**, sem perder os fatos originais armazenados no SQLite. O processamento não bloqueará a Jornada, que continuará usando a recuperação canônica estruturada e o FTS5 (ADR-053 e ADR-054). Erros permanentes ou de configuração não devem provocar tentativas automáticas infinitas, especialmente quando houver custo de API; nenhum limite numérico ou intervalo específico é aprovado nesta decisão. **[CONFIRMADO — ADR-056]** A **fila de trabalhos de embeddings será persistida no SQLite**, com os estados e as informações necessárias para reconhecer trabalhos **pendentes, em processamento, interrompidos ou não concluídos**. Após encerrar ou reiniciar o Henduran, os trabalhos pendentes e aqueles interrompidos poderão ser recuperados e retomados, **validando a versão do conteúdo canônico, o Mundo, a Jornada, a ramificação e a configuração do modelo de embeddings** antes do processamento ou publicação de resultados. Trabalhos obsoletos não poderão sobrescrever índices mais recentes. A persistência da fila deve ser compatível com a confirmação dos fatos canônicos (ADR-054), com operações atômicas (ADR-049) e com os reintentos limitados (ADR-055); isso não exige que toda operação de indexação se torne parte da transação que confirma o fato original. **[PENDENTE]** Modelo/provedor dos embeddings, requisitos para execução local, formato e local de armazenamento dos vetores, esquema SQLite e estados detalhados da fila, gatilhos de indexação, concorrência e recuperação de trabalhos em execução, prioridades, quantidade máxima de tentativas, intervalos e progressão dos reintentos, classificação de falhas, deduplicação, política de reconstrução e atualização dos índices, critérios de acesso a segredos e conhecimento por personagem, parâmetros de recuperação, ranking e filtros de relevância.

**[CONFIRMADO — ADR-057]** Os **vetores semânticos e respectivos metadados de indexação serão armazenados no SQLite**, por meio de um **mecanismo de consulta vetorial compatível** com a arquitetura desktop do Henduran. Os vetores são índices auxiliares reconstruíveis, não estados canônicos, e suas associações a Mundo, Jornada, ramificação, origem e versão devem permitir filtragem e evitar vazamento de memórias entre continuidades. A escolha não fixa extensão SQLite, biblioteca de busca, tabela, esquema vetorial, dimensão, estratégia de indexação, implementação de similaridade, metas de desempenho ou mecanismo de reconstrução. Esses detalhes permanecem pendentes.

**[CONFIRMADO — ADR-058]** A memória recuperável do Narrador combinará **conhecimento compartilhado e versionado do Mundo** com **memórias particulares isoladas por Jornada e ramificação**. O Narrador poderá consultar informações gerais do Mundo na versão compatível com a Jornada ativa, mas descobertas, acontecimentos, relações e consequências exclusivos de uma continuidade não poderão ser apresentados como conhecimento adquirido em outra. A recuperação híbrida (SQLite, FTS5 e vetores auxiliares) deverá respeitar esse escopo antes de fornecer contexto ao modelo; o índice vetorial, embora fisicamente armazenado no SQLite (ADR-057), não concede acesso a memórias fora da continuidade autorizada. **[CONFIRMADO — ADR-059]** Ao continuar a partir de um salvamento anterior, uma nova ramificação deverá **herdar por referência as memórias canônicas imutáveis anteriores ao ponto de divergência**, sem duplicá-las logicamente; a partir desse ponto, **cada ramificação terá suas próprias memórias e descobertas**. Memórias de acontecimentos posteriores na linha de origem **não** se tornam acessíveis à nova ramificação. A herança é limitada ao estado e ao conhecimento válidos no instante restaurado, respeitando o versionamento do Mundo e os escopos dos personagens; compartilhamento por referência não permite modificar retroativamente o passado comum. **[PENDENTE]** Implementação das referências e dos filtros de acesso, limites temporais de recuperação, tratamento de eventuais correções do passado, permissões de personagens e NPCs, atualização de conhecimento compartilhado entre versões de Mundo, organização física dos índices e otimização do armazenamento.

**[CONFIRMADO — ADR-067]** A **transmissão ou revelação de conhecimento** entre entidades ocorrerá por **eventos estruturados propostos pelo Narrador e validados pelo motor**, registrando ao menos **fonte, destinatário(s), conteúdo comunicado e contexto da ocorrência**. O motor verificará conhecimento e acesso da fonte, presença ou capacidade de comunicação dos participantes, permissões e continuidade ativa, conforme regras detalhadas ainda pendentes, antes de persistir o evento. A comunicação pode atualizar o que o destinatário **ouviu, acredita ou suspeita**, mas **não confirma automaticamente a veracidade do conteúdo** nem altera a verdade canônica. O mesmo fato pode ser comunicado como relato, mentira, engano ou afirmação verdadeira, preservando a proveniência. A validação das consequências cognitivas será consistente com as ADR-060 a ADR-066; **não** se presume que todo personagem próximo tenha ouvido ou compreendido algo sem checagem de percepção aplicável. **[PENDENTE]** Esquema dos eventos de revelação, classificação e sigilo, regras de percepção e testemunhas, filtros e permissões granulares, tratamento de comunicação indireta, interoperabilidade com diálogo e critérios de atualização de crenças.

**[CONFIRMADO — ADR-066]** A **verdade canônica** do Henduran será estabelecida apenas por **regras do Mundo e do motor, acontecimentos efetivamente registrados e operações autorizadas e validadas pelo motor**. O Narrador poderá criar propostas de novos acontecimentos ou fornecer interpretações narrativas, mas **não poderá elevar sozinho uma hipótese, rumor, alegação, crença ou inferência a fato verdadeiro**. Evidências, grau de confiança e convicção subjetiva não bastam para confirmar fatos. Toda criação ou alteração de fato canônico deverá respeitar permissões, restrições do Mundo, estado e histórico da continuidade, validação e persistência transacional, sem reescrever retroativamente o passado. A confirmação no cânone é distinta da **descoberta** desse fato por protagonista/NPCs: conhecimento e sigilo continuam sujeitos às ADR-060 a ADR-065. Esta decisão **não** determina uma lista fechada de tipos de fatos, nem um algoritmo de confirmação ou a forma de revelação. **[PENDENTE]** Critérios operacionais de confirmação e validação, tipos de evidência, regras de criação autorizada de fatos novos em geração procedural, conflito e correção canônica, mecanismos de revelação e auditoria.

**[CONFIRMADO — ADR-065]** O **Narrador avaliará contextualmente as evidências** e poderá **propor mudanças na confiança subjetiva** de protagonistas e NPCs, considerando situação, fontes, personagens, relações, possibilidades de engano e histórico das crenças. O **motor deverá validar** a proposta antes de persistir mudanças, verificando **proveniência da evidência, conhecimento efetivo da entidade, coerência com o histórico e o estado canônico, permissões e regras aplicáveis**. A avaliação pelo Narrador **não determina automaticamente a verdade canônica**, não permite atualizar a crença de quem não teve acesso à evidência e não substitui o histórico prévio de fontes, alegações e contradições (ADR-060 a ADR-064). A atualização validada deverá ser transacional e associada à continuidade correta; propostas inválidas não serão aplicadas. **[PENDENTE]** Pesos e categorias de evidência, escala e limites da confiança, critérios objetivos de coerência e confirmação, fórmulas de atualização, níveis de discricionariedade da IA e regras detalhadas de avaliação/registro.

**[CONFIRMADO — ADR-064]** O **grau de confiança de cada entidade em uma crença, suspeita, rumor ou alegação** será representado por uma **medida estruturada interna mantida pelo motor**, enquanto o Narrador realizará a **interpretação qualitativa e contextual** dessa medida em falas, atitudes e decisões. A confiança é **subjetiva e vinculada à entidade, à informação e à continuidade**, não equivale à probabilidade objetiva de verdade e **não promove automaticamente** uma informação a fato canônico. Novas evidências ou acontecimentos poderão motivar mudanças de confiança **após validação do motor**, mantendo fontes e histórico de evolução das crenças (ADR-061 a ADR-063). A interface e a narrativa não são obrigadas a expor o número interno. **[PENDENTE]** Escala, limites, categorias qualitativas e transições, pesos e critérios de evidência, regras de atualização, normalização, persistência, classificação de confiança e validação específica.

**[CONFIRMADO — ADR-063]** O comportamento dos **NPCs** diante de informações, crenças e suspeitas será **interpretado contextualmente pelo Narrador**, considerando a personalidade, os objetivos, a situação da Cena, as relações e aquilo que cada entidade de fato sabe ou acredita (ADR-060 a ADR-062). O Narrador poderá propor **falas, decisões e ações coerentes com crenças equivocadas**, sem transformar essas crenças em fatos canônicos ou conferir conhecimento indevido a outros personagens. **Alterações persistentes** decorrentes dessas ações — recursos, inventário, relações, condições, posição, eventos e demais efeitos de regras — deverão ser submetidas ao **motor determinístico**, que validará conhecimento, permissões, condições, regras e consequências antes de aplicar mudanças. Isso não exige que toda fala corriqueira receba autorização mecânica, nem substitui a interpretação contextual por tabelas de respostas comportamentais fixas. A IA não poderá modificar sozinha o estado canônico ou decidir ações voluntárias pelo protagonista. **[PENDENTE]** Critérios de confiança e força de crenças, regras de motivação e comportamento, classificação de ações com efeitos persistentes, permissões operacionais, validações específicas, formas de explicabilidade e testes de coerência.

**[CONFIRMADO — ADR-062]** Informações **contraditórias** conhecidas por uma entidade deverão ser **preservadas como versões, hipóteses ou alegações distintas**, associadas às respectivas **fontes, evidências, proveniência e momentos de aquisição**. O sistema deverá manter um **histórico da evolução das crenças por personagem**, de modo que mudança de convicção ou reavaliação de evidências não apague a versão anterior nem reescreva retroativamente o que a entidade sabia em cada momento. A presença de informação mais recente, mais repetida ou mais convincente para um personagem **não altera automaticamente a verdade canônica**; o Narrador propõe interpretações e aquisições, e o motor valida alterações persistentes em conformidade com a ADR-061. Informações conflitantes poderão coexistir sem que o motor seja obrigado a escolher uma versão verdadeira antes de haver confirmação válida. Cada registro respeitará permissões e escopo de Mundo, Jornada e ramificação. **[PENDENTE]** Esquema de fontes e evidências, critérios de confiança, relevância e confirmação, gatilhos e regras de transição/revisão de crenças, resolução de conflitos de fatos canônicos, indicadores de incerteza e implementação do histórico e dos filtros.

**[CONFIRMADO — ADR-061]** A aquisição ou revelação de informação pelo protagonista ou NPCs será **proposta pelo Narrador e validada pelo motor** antes de atualizar registros de conhecimento. O registro deverá distinguir **fato confirmado, crença, suspeita, rumor e alegação atribuída a outra entidade**, sem promover automaticamente qualquer informação relatada à condição de verdade canônica. Um NPC pode mentir, estar enganado ou divulgar informação não verificada; o sistema deverá representar **o conteúdo conhecido ou acreditado**, bem como sua natureza epistemológica, sem assumir que ele é verdadeiro no Mundo. A validação considerará origem, entidades participantes, escopo da Jornada e ramificação, e autorização para a divulgação, respeitando a ADR-060. Mudanças registradas deverão ser persistentes e transacionais, não derivadas de texto do Narrador sem operação validada. **[PENDENTE]** Esquema de evidências e proveniência, critérios para confirmação e revisão de crenças, transições de classificação, regras operacionais para preservar e consultar contradições conforme ADR-062, sigilo e acesso, interface e armazenamento de registros de conhecimento.

**[CONFIRMADO — ADR-060]** O Henduran deverá distinguir **fatos canônicos do Mundo**, **conhecimentos efetivamente possuídos pelo protagonista e por cada NPC** e **informações que o Narrador pode consultar para conduzir a cena**. O motor registrará a associação entre fatos e entidades que os conhecem, além do escopo temporal e da continuidade válida. O Narrador poderá receber, de forma controlada, segredos relevantes à condução de NPCs e cenas, mas **falas, ações e revelações devem respeitar o que cada entidade sabe e está autorizada a comunicar**. Uma verdade canônica não se torna automaticamente conhecida por todos, e acesso do Narrador não é autorização para revelar o segredo ao protagonista. A recuperação de memória por SQLite, FTS5 ou embeddings deve aplicar filtros de conhecimento e escopo **antes de fornecer o contexto ao modelo**; instruções textuais isoladas não substituem o controle de acesso. Mudanças de conhecimento devem ser persistidas e validadas pelo motor, mantendo coerência com as ramificações e o passado herdado (ADR-058 e ADR-059). **[PENDENTE]** Esquema de permissões e conhecimento por entidade, classificação de segredos, mecanismos de revelação e transmissão, filtros exatos do contexto, políticas para narrador onisciente restrito e auditoria de revelações.

**[PENDENTE]** Política de retcon, edição e desfazer; quando fatos narrativos são promovidos a canônicos; mecanismos e níveis específicos de segredos e de revelação; tratamento de alucinações e versões contraditórias.

### 6. Narrativa procedural vs. autoria

**[CONFIRMADO]** O projeto tem narrativa procedural conduzida por IA, não uma campanha previamente roteirizada. **[PENDENTE]** Quanto lore fixo existirá, como serão estabelecidos elementos canônicos do mundo, níveis de liberdade criativa e restrições temáticas. **[PROPOSTO]** Um conjunto pequeno de fatos autorais de mundo pode servir de sementes; o sistema registra novos fatos criados legitimamente ao longo da Jornada.

## IV. Personagens

### 1. Personagem do jogador

**[CONFIRMADO]** Personagem único, criado pelo jogador, com identidade, Ambição, Desejo, ficha e recursos do Astra adaptado. A criação não utilizará Competências nem Capacidades inicialmente. O sistema original não utiliza classes nem nível global.

**Astra de origem — para adaptação, não aprovação automática:** seis Atributos (Força, Agilidade, Vigor, Carisma, Determinação, Astúcia), escalados de 1 a 5 para personagens; Perícias de 0 a 5; Vida = `3 + Vigor`; Vontade = `3 + Determinação`; Carga máxima = `5 + Força`; Iniciativa usa `Astúcia + Determinação`. Criação original: distribuição de Atributos 4/3/3/2/2/1, perfis de Perícias, Convicções/Pilares, equipamento inicial. Fonte: `astra-rules/Criação de Personagem` e `Regras/Personagens`.

**[PENDENTE]** Quais perfis de Perícias e etapas originais serão preservados integralmente; tratamento de Perícias inadequadas ao cenário; histórico/antecedentes e seus efeitos; personalização visual; seleção de retrato.

### 2. Ficha e estados

| Conjunto | Referência de origem | Necessidade no Henduran |
|---|---|---|
| Atributos e Perícias | Núcleo Astra | Adaptar/congelar versão, validar limites |
| Vida | Trilha superficial/agravado; incapacitação | Preservar efeitos relevantes e apresentar visualmente |
| Vontade | Trilha, usos e recuperação | Adaptar restrições por sessão |
| Ambição e Desejo | Um de cada; benefícios por sessão | Redesenhar gatilhos para Jornada contínua |
| Convicções e Pilares | Três Convicções, Pilares, Fraturas | Preservar demais benefícios, adaptando limites a eventos significativos; revogar benefício gratuito de rerrolagem por Convicção (ADR-013) |
| Condições | Catálogo de estados e efeitos | Mecanismo determinístico, excluir vínculos a Capacidades |
| Inventário/equipamento | Armas, armaduras, escudos, consumíveis, itens | Implementação e apresentação apropriadas |

**[PROPOSTO]** Cada alteração de ficha deve possuir fonte (rolagem, compra, descanso, ação confirmada, efeito, correção), com validação de limites e registro recuperável. Valores derivados recalculados após mudanças relevantes. **[CONFIRMADO — ADR-007]** Estado atual e histórico de eventos relevantes devem ser mantidos de forma consistente. **[PENDENTE]** Política de desfazer, correção e recuperação de versões anteriores.

### 3. NPCs e criaturas

O Astra inclui fichas simplificadas de NPC, bestiário e **Capacidades de NPC**. Como o Henduran exclui Capacidades inicialmente, a importação do bestiário **não pode ser literal**: remover uma Capacidade de um monstro pode alterar seu desafio, seus ataques e suas resistências. **[ADAPTADO; comportamento de substituição PENDENTE]**

**[PROPOSTO]** Um NPC persistente possui identidade, papel, contexto, local e relação com o protagonista; uma criatura em conflito também precisa de estatísticas mecânicas válidas. Não assumir um sistema numérico de reputação nem simulação contínua de todos os NPCs sem aprovação. **[PENDENTE]** política de criação e ajuste de NPCs sem Capacidades, escala de poder e memória por NPC.

### 4. Progressão

Astra de origem: XP compra aumentos de Atributos, Perícias, Competências, domínio adicional de arma e outros efeitos; custo de Atributo = novo nível × 5 XP e Perícia = novo nível × 3 XP, com modificações por Convicção rompida. **[ADAPTADO]** Competências deixam de ser opção de compra; o restante requer confirmação na wiki interna.

**[CONFIRMADO — ADR-014]** XP será concedido por **marcos narrativos e conquistas significativas**, como concluir objetivos, superar desafios relevantes, descobrir informações decisivas ou produzir mudanças importantes na Jornada. O Narrador poderá identificar e propor marcos, mas a concessão precisa passar por validação do motor e registro persistente, evitando concessões duplicadas pelo mesmo marco. **[PENDENTE]** Valores exatos de XP, gradação e limites de frequência dependem de balanceamento; critérios de reconhecimento dos marcos ainda exigem especificação. Não conceder XP automaticamente por mensagem, teste, Cena ou tempo decorrido.

## V. Sistema de regras

### 1. Princípio de autoridade

**[CONFIRMADO]** `astra-rules` é **referência de origem**. O Henduran terá **wiki própria integrada** com regras efetivamente utilizadas; adaptações são legítimas e esperadas. O **motor de regras** executa a versão Henduran. A IA não escolhe resultados mecânicos arbitrários, não altera diretamente a fonte oficial de estado e não deve responder consultas mecânicas com regras de outro RPG.

**[PROPOSTO]** Manter para cada regra um identificador local, versão e campo de proveniência (`original`, `adaptada`, `nova`), com vínculo opcional ao texto Astra de origem. A wiki é a referência de design; código e testes são sua implementação verificável. Mudanças devem atualizar wiki, testes e comportamento conjuntamente.

### 2. Matriz de adaptação

| Subsistema | Regra Astra de origem | Henduran | Estado e dependências |
|---|---|---|---|
| Reserva d10 | Atributo + Perícia; 6+ sucesso; pares de 10 concedem +1 adicional | Candidato a preservar sem alterar | [PROPOSTO], validar fichas e testes |
| Dificuldade | Sucessos ≥ dificuldade; dificuldade 2 é referência sugerida | Narrador pode propor, motor executa após validação | [PROPOSTO], contrato de testes |
| Testes opostos | Mais sucessos vence; empate conserva situação, salvo regra especial | Preservar sob a versão local | [PROPOSTO], relações com combate |
| Atributos | Seis atributos, escalas e derivados | Preservação inicial sugerida | [PROPOSTO], criação de personagem |
| Perícias | Perícias com atributo vinculado; lista adaptável por cenário | Preservar o conceito; revisar lista | [PROPOSTO], cenário |
| Competências | Progressões em níveis com habilidades | Excluir do lançamento inicial | [CONFIRMADO] |
| Capacidades | Efeitos de Competências e NPCs | Excluir do lançamento inicial | [CONFIRMADO]; revisar bestiário e exceções |
| Ambição/Desejo | Benefícios e trocas por sessão | Efeitos originais de Vontade por acontecimentos significativos, sem duplicar o mesmo progresso | [CONFIRMADO — ADR-011/ADR-012]; frequência máxima entre eventos distintos pendente |
| Convicções/Pilares | Fraturas e efeitos por sessão | Preservar inicialmente os demais efeitos, vinculados a acontecimentos significativos com controle de duplicação; benefício de rerrolagem gratuita por Convicção revogado | [CONFIRMADO — ADR-013]; frequências adicionais pendentes |
| Vida e Vontade | Trilhas superficial/agravado | Candidatas a preservar; Vontade exige adaptação | [PROPOSTO/ADAPTADO] |
| Cenas táticas | Rodadas, turnos e Iniciativa | Regras-base para fase tática no chat | [PROPOSTO], grid e interação |
| Ações táticas | Confrontar, Manobras, Aguardar, movimentação | Mapear para operações de motor | [PROPOSTO], critérios completos a ratificar |
| Equipamentos | Valor abstrato, Carga, armas e proteções | Moeda concreta no Henduran; Valor do Astra como referência inicial de precificação | [CONFIRMADO — ADR-015]; nomes, equivalências e demais regras comerciais pendentes |
| Condições | Efeitos tipados e durações | Preservar após auditoria de dependências | [PROPOSTO] |
| Criaturas | Fichas e bestiário com Capacidades | Adaptar ou filtrar conteúdo incompatível | [ADAPTADO], balanceamento pendente |

### 3. Exemplo mecânico: teste básico do Astra

**Regra da fonte:** personagem com Agilidade 3 + Furtividade 2 rola 5d10. Cada dado com 6, 7, 8, 9 ou 10 conta 1 sucesso; cada par de 10 adiciona mais 1. Se a dificuldade for 3 e os dados forem `10,10,7,4,2`, há `1 + 1 + 1 + 1 do par = 4` sucessos e o teste é bem-sucedido. **[PROPOSTO]** Isso pode servir como teste de conformidade do motor do Henduran **se a mecânica for ratificada**.

**[PENDENTE]** Contrato para teste sem Atributo/Perícia aplicável, exceções por Condição e efeitos opcionais; nenhuma fórmula nova deve ser inferida por agentes.

### 4. Adaptação de referências a “sessão”

Na fonte Astra, Ambição recupera Vontade agravada ao final de sessão mediante progresso ativo; Desejo recupera Vontade superficial uma vez por sessão e só pode ser trocado no início de sessão; Convicções/Pilares e certas vantagens também contam usos por sessão; XP é sugerido por sessão. **[CONFIRMADO]** O Henduran **não replicará automaticamente sessões de mesa**. **[CONFIRMADO — ADR-010]** A periodicidade será definida por mecânica a partir de marcos e acontecimentos significativos.

**[CONFIRMADO — ADR-010]** O Henduran não terá uma unidade universal que substitua uma sessão de mesa. As regras dependentes de sessão serão adaptadas para **marcos narrativos e acontecimentos significativos**, com gatilhos, limites e frequência definidos separadamente para cada mecânica. Não substituir `sessão` sistematicamente por `Cena`, dia no mundo ou intervalo artificial.

**[CONFIRMADO — ADR-011]** O jogador pode alterar seu **Desejo** quando ele for concluído, abandonado ou perder relevância na história. A **Ambição** muda quando acontecimentos significativos, sua conclusão ou uma transformação real das motivações do personagem justificarem a mudança. Essas alterações são decisões do jogador apoiadas pelo contexto da Jornada; o Narrador pode sugerir, não impor objetivos. A mudança de um objetivo não concede nem renova benefícios de Vontade por si só. **[CONFIRMADO — ADR-012]** Os benefícios originais de Vontade de Ambição e Desejo são preservados inicialmente, com validação contextual e prevenção de recompensas duplicadas; limites adicionais dependem de testes.

**[CONFIRMADO — ADR-012]** A adaptação inicial dos efeitos de **Ambição** e **Desejo** preserva a magnitude do Astra: ao validar progresso ativo significativo na Ambição, **1 ponto de dano agravado de Vontade torna-se superficial**; ao validar o cumprimento efetivo de um Desejo, **recupera-se 1 ponto de dano superficial de Vontade**. Os efeitos dependem de acontecimentos relevantes, não de encerramento de Cena ou de sessão. O motor deve vincular a concessão a uma ocorrência identificável e impedir duplicações do mesmo progresso ou cumprimento; trocar ou reescrever objetivos não constitui, por si só, novo acontecimento recompensável. O Narrador pode propor a qualificação do evento, mas não conceder a mudança diretamente nem inventar bônus.

**[PENDENTE]** A periodicidade máxima entre acontecimentos *distintos*, os critérios objetivos para considerar um avanço significativo de Ambição e os controles adicionais de equilíbrio serão definidos a partir de testes. Não está aprovada recompensa automática por cada Cena, mensagem, mudança de objetivo ou ação incidental. **[CONFIRMADO — ADR-013]** Convicções e Pilares preservam inicialmente os demais efeitos do Astra, com gatilhos em acontecimentos significativos e prevenção de recompensa duplicada pelo mesmo evento. O benefício concedido por Convicção de **rerrolar dados gratuitamente é revogado**. O benefício alternativo de ignorar penalidades físicas sem custo de Vontade fica preservado inicialmente, mediante os critérios do sistema adaptado. Não se confunde essa remoção com a mecânica geral de rerrolar dados mediante gasto normal de Vontade, que não foi revogada nesta decisão. **[PENDENTE]** Limites adicionais de frequência, adaptação dos usos restantes de Vontade, XP e regras detalhadas de Fraturas e restauração.

### Convicções e Pilares — adaptação inicial (ADR-013)

**[CONFIRMADO]** A atuação em defesa de uma Convicção e a interação significativa com um Pilar continuam podendo produzir os benefícios correspondentes, sujeitos à validação do motor e à prevenção de duplicação por evento. Em particular, recorrer a um Pilar preserva inicialmente a conversão de **1 ponto de dano agravado de Vontade em superficial**, fora de situação tática e com interação efetivamente vivenciada; a condição de frequência deixa de ser uma sessão e passa a depender de eventos significativos. A recuperação por reparação de Fraturas e restauração de Convicções permanece em avaliação quanto à frequência digital; não conceder automaticamente por mensagem ou fim de Cena.

**[CONFIRMADO]** O benefício gratuito de **rerrolagem por Convicção** é excluído. A alternativa original de **ignorar penalidades físicas sem gastar Vontade** é mantida inicialmente, se houver defesa válida da Convicção/Pilar e benefício ainda não aplicado ao mesmo acontecimento. A regra geral de rerrolagem por gasto de Vontade não foi alterada por essa decisão.


### 5. Exclusão de Competências e Capacidades

**[CONFIRMADO]** A exclusão é intencional e não implica remover Atributos, Perícias, Vida, Vontade, equipamento, Condições ou combate.

**[PROPOSTO]** Auditoria de dependências nas seguintes áreas antes de implementá-las: criação (passo de Competências), custos de XP, substituições de Atributos, propriedades de armas dependentes de Capacidade, fichas de NPC e bestiário, recursos e ataques especiais. Remover referências sem criar vantagens compensatórias implícitas. Quando um comportamento sem Capacidade não ficar definido, marcar como pendente em vez de fabricar uma regra.

### 6. Interface da wiki

**[CONFIRMADO]** O Henduran terá wiki própria, acessível dentro do aplicativo. **[PROPOSTO]** Fichas de regras com busca, índice, links internos, exemplos e versão da regra; integração de consulta ao Narrador via recuperação contextual e uso de ferramentas somente-leitura para buscar trechos aplicáveis. **[PENDENTE]** Formato de publicação, autoria de textos adaptados e política de sincronização com o motor.

## VI. Exploração e mundo

### Biblioteca de Mundos independentes (ADR-021)

**[CONFIRMADO]** O Henduran permitirá criar e manter **Mundos independentes e reutilizáveis**. Um Mundo é uma definição de ambientação que pode ser **criada manualmente**, **gerada com auxílio de IA** ou **importada a partir de wikis e documentos**. O jogador escolhe um Mundo como base de uma ou mais Jornadas. **Cada Jornada possui estado próprio**, incluindo as consequências de suas ações, sem sobrescrever automaticamente o Mundo de origem nem outras Jornadas.

**[CONFIRMADO]** A geração híbrida de geografia da ADR-018 continua válida: ela produz estrutura e detalhes espaciais apropriados a cada Jornada, respeitando as definições e restrições do Mundo selecionado. Mundo e Jornada não são sinônimos. O Narrador consulta os dados de ambos, mas o **estado oficial da Jornada** continua separado da memória recuperável da IA (ADR-007 e ADR-008).

**[CONFIRMADO — ADR-024]** Mundos serão **versionados** e cada Jornada ficará vinculada a uma **versão identificável do Mundo**. Alterações no Mundo de origem **não modificam automaticamente** Jornadas existentes. Quando houver uma nova versão, o jogador poderá optar por incorporar atualizações à Jornada por meio de processo **controlado**, com **detecção de conflitos** e preservação dos fatos canônicos já estabelecidos. A ausência de aplicação de uma atualização não impede que a Jornada continue normalmente.

**[PROPOSTO]** Modelar as entidades `WorldDefinition`, `WorldVersion`, `Journey` e `SourceDocument`, com referência à versão utilizada e um registro auditável de migrações aceitas. O compromisso com versionamento e atualização controlada está aprovado; a estrutura exata do banco, o formato do diff e os algoritmos de merge continuam pendentes.

**[CONFIRMADO — ADR-025]** A importação de wikis e documentos será **assistida por IA**, que extrai informações e apresenta uma **proposta estruturada** de entidades, relações e fatos, destacando lacunas, incertezas e contradições. O jogador deverá **revisar e aprovar** os dados antes de sua incorporação ao cânone do Mundo. **Nenhum conteúdo importado se torna canônico automaticamente**. As informações importadas deverão preservar **proveniência rastreável** (fonte ou documento associado), inclusive após a aprovação. A leitura da fonte e a preparação da proposta não equivalem à autorização para alterar o Mundo; a aprovação gera uma alteração registrada no Mundo e sujeita ao versionamento da ADR-024.

**[PROPOSTO]** Fluxo operacional: selecionar fontes permitidas → extrair conteúdo e proveniência → estruturar entidades/relações → comparar com o cânone existente e apontar conflitos → apresentar prévia editável → receber aprovação explícita do jogador → gerar nova versão do Mundo e indexar o material aprovado para consulta. Fatos não aprovados podem permanecer como referência não canônica apenas se forem claramente identificados como tal.

**[PENDENTE]** Formatos e wikis suportados inicialmente; granularidade da aprovação (entidade, lote ou importação completa); resolução de contradições, conteúdo sem fonte confiável e edições durante revisão; política de licenças e redistribuição; geração de mapas a partir de lore incompleto; limites e UX do editor de Mundos.

**[CONFIRMADO — ADR-024 e ADR-026]** A atualização entre versões exige **detecção de conflitos com o estado canônico da Jornada** antes de sua incorporação. Se houver conflitos, a IA deverá **propor alternativas revisáveis**, como preservar o acontecimento da Jornada, adaptar o conteúdo da versão nova ou descartar a alteração incompatível. **A aplicação depende de aprovação explícita do jogador**, seguida de validação mecânica e registro do resultado; o Narrador não poderá resolver conflitos por conta própria nem reescrever acontecimentos canônicos unilateralmente. Alterações não aprovadas não são aplicadas. O jogador pode manter a versão anterior sem interromper a Jornada.

**[PENDENTE]** Interface do diff e das alternativas, granularidade da aprovação, política de edição manual e preservação de histórico, migrações reversíveis ou não, compatibilidade de mapas e entidades, reindexação de memórias, tratamento de saves e momento permitido para aplicar uma atualização.

**Referência técnica examinada:** `CODED-Xavier/Caliope` apresenta `backend/app/scenarios.py`, `lorebook.py`, `playerlore.py` e `wikiresearch.py` para cenários reutilizáveis, ativação de lore e pesquisa MediaWiki/Fandom. A existência desses componentes **não confirma** um gerador completo de mundos geográficos e não autoriza cópia sem auditoria (ADR-016).

**Critérios de aceite propostos:** duas Jornadas derivadas do mesmo Mundo não compartilham consequências; uma fonte importada mantém referência de proveniência; um fato do Mundo não é confundido com ação já ocorrida na Jornada; dados contraditórios são sinalizados em vez de sobrepostos silenciosamente.

### Estratégia de geração do mundo (ADR-018)

**[CONFIRMADO]** O mundo do Henduran terá **geração híbrida**: uma **estrutura geográfica inicial** será estabelecida para cada Jornada a partir das definições do Mundo selecionado e o sistema poderá **detalhar ou expandir proceduralmente** regiões e elementos conforme a exploração e a necessidade de gameplay. **Locais descobertos, NPCs estabelecidos, acontecimentos e alterações do mundo são persistentes**. O mundo não é redefinido quando o jogador revisita um local nem simplesmente porque uma nova resposta do Narrador foi gerada.

**[CONFIRMADO]** A geração de conteúdo e a improvisação do Narrador devem respeitar o estado oficial da Jornada, com operações validadas e registro de eventos relevantes (ADR-004, ADR-007 e ADR-008). A geração não implica que a IA possa inventar posições, custos, efeitos ou fatos que contradigam dados já estabelecidos.

**[PROPOSTO]** Separar a **estrutura macro** (geografia e referências necessárias para navegação), o **detalhamento sob demanda** (locais e particularidades) e a **canonização** de novos elementos (registro oficial com origem e identificação estável). Usar parâmetros reproduzíveis para partes determinísticas quando viável, sem prometer reconstrução por seed como substituta da persistência.

**[CONFIRMADO — ADR-019]** O mapa-múndi usa hexágonos **regionais**, capazes de conter múltiplos pontos de interesse internos. **[PENDENTE]** Extensão do mapa inicial, expansão limitada ou ilimitada, algoritmos, biomas, distribuição de assentamentos, seed, distância exata por hexágono, regras de descoberta, visibilidade, rotas, ritmo de geração e integração com a definição do Mundo selecionado. P-11 define a estratégia geral; P-12, a escala conceitual, não esses parâmetros.

### 1. Mapa-múndi

**[CONFIRMADO]** Exploração com **mapa hexagonal**; o jogador pode deslocar-se pelo mundo Fora de Cena. A documentação do protótipo anterior prevê deslocamento manual por hexágonos e rota automática interrompida por acontecimentos, com atualização de tempo/estado pelo motor e sem chamada IA a cada passo. **[PROPOSTO PARA HENDURAN]** Preservar esse princípio, sujeito a teste de UX.

**[CONFIRMADO — ADR-019]** Cada hexágono representa uma **área regional** e poderá conter **múltiplos pontos de interesse**. Esses pontos não exigem mapas locais para Cenas narrativas (ADR-005). **[PENDENTE]** Distância exata em cada hexágono, orientação, custo por terreno, visibilidade, descoberta, fog of war, algoritmo de rota, relógio e calendário, velocidade, descanso durante viagem e critérios de geração de pontos de interesse.

### 2. Geração procedural de mundo

**[CONFIRMADO]** O projeto terá geração procedural, mas não está aprovado um algoritmo, nível de detalhe ou simulação universal de NPCs. **[PROPOSTO]** Separar gerador de **estrutura** (locais, conexões, terrenos, restrições) de criação de **significado narrativo** pela IA. O motor deveria garantir consistência espacial antes de expor novas localizações como definitivas.

**[PENDENTE]** Seeds; versionamento e regeneração; quantidade de conteúdo autoral; se uma área pode mudar fisicamente após descoberta; regras de coerência entre locais e mapas localizados.

### 3. Mapas localizados e tokens

**[CONFIRMADO]** Grid para interações táticas e combate; tokens de personagens em formato de moeda. O grid de combate é **quadrado** na referência Astra; o mapa-múndi é **hexagonal** no Henduran. São representações distintas.

**[CONFIRMADO — ADR-005]** Mapas localizados são exclusivos de situações táticas (combate ou outro conflito em que posição, distâncias e turnos precisem de resolução estruturada). Cenas sociais, de investigação e de comércio funcionam no chat sem mapa localizado, salvo se passarem a uma fase tática. O mapa-múndi hexagonal continua disponível para exploração Fora de Cena e não é um mapa localizado de Cena. **[PROPOSTO]** Tokens e objetos possuem coordenadas oficiais mantidas pelo motor; a interface visualiza e solicita movimentos. **[PENDENTE]** Geração e composição de mapas táticos, movimentação de NPCs, passagem de fase narrativa para tática, conservação do chat e atualização de mapas após alterações do mundo.

### 4. Interações com mundo

**[CONFIRMADO]** O jogador pode iniciar acontecimentos voluntariamente — exemplo: escolher ir à forja. O Narrador pode apresentar locais, pessoas e oportunidades, mas sua liberdade não autoriza criar retroativamente uma consequência contraditória com um fato persistente.

**[PROPOSTO]** Consultas de presença/localização, disponibilidade de mercadorias, passagem de tempo e alterações do mapa deverão passar por operações controladas. **[PENDENTE]** Mecanismos de descoberta, exploração de interiores e manipulação fina de objetos.

## VII. Combate

### 1. Escopo

**[CONFIRMADO]** Henduran terá combate tático em grid com tokens, baseado nas regras Astra adaptadas. **[CONFIRMADO]** O combate é uma possibilidade de Cena, não seu destino obrigatório. **[PROPOSTO]** A fase tática deve preservar o chat como canal de descrição e declaração de intenção, complementado por ferramentas visuais.

### 2. Estrutura da fonte Astra

Astra diferencia Cenas narrativas e táticas; a Cena Tática organiza iniciativa, rodadas, turnos, **Ação + Movimentação**. Iniciativa é `Astúcia + Determinação` em d10 e participantes agem por sucessos. O combate usa **Confrontar**, com respostas **Aceitar Confronto**, **Defender** (escudo ou outra permissão) e **Esquivar**; manobras como agarrar, derrubar, reposicionar, desarmar e mirar; também Aguardar e movimentação. A posição em quadrados determina alcance, adjacência e certas vantagens. Fonte: `astra-rules/Regras/Cenas e Conflitos`, `Regras/Movimento` e `Regras/Equipamentos`. **[PROPOSTO]** Preservar as interações principais após revisão da adaptação.

### 3. Fluxo conceitual de Confronto

```text
Narrador / jogador declara Ataque
  → motor verifica turno, Ação, alvo, alcance, equipamento e condições
  → alvo escolhe resposta válida (jogador ou controlador de NPC)
  → motor monta reservas e rola
  → resolve margem, empate, dano e mitigação segundo regra Henduran
  → registra recursos, posições, estados e efeitos
  → Narrador recebe resultado e descreve a consequência
```

**[PENDENTE]** Como o jogador fornece a resposta em tempo real, interface para confirmações, automação de ações de NPCs, possibilidade de rolar escondido, regras de movimentação fora do combate e situações táticas sem combate.

### 4. Dados operacionais de origem a validar

| Mecânica na fonte Astra | Regra consultada | Situação |
|---|---|---|
| Ataque corpo a corpo | Agilidade + Lutar, salvo substituição expressa | [PROPOSTO] |
| Arma de disparo | Agilidade + Atirar | [PROPOSTO] |
| Arremesso | Força + Arremessar | [PROPOSTO] |
| Resposta Defender | Força + Lutar + proteção de escudo | [PROPOSTO] |
| Resposta Esquivar | Agilidade + Acrobacia | [PROPOSTO] |
| Empate no Confronto | Atacante causa dano base da arma como superficial | [PROPOSTO] |
| Derrota por margem | Margem de sucessos + dano da arma, com exceções | [PROPOSTO] |
| Ação/Movimentação | Recursos separados por turno tático | [PROPOSTO] |

**Nota:** fórmulas acima são transcritas em resumo da regra de origem, **não** aprovação automática da versão final do Henduran. Exceções de armaduras, alcance, condições, propriedades e bestiário dependem da wiki adaptada. Excluir Capacidades elimina suas substituições opcionais, mas não necessariamente as propriedades de equipamento.

### 5. Dano, recuperação e consequências

Astra distingue **dano superficial e agravado**. Vida cheia gera Debilitado; toda a trilha com dano agravado gera Incapacitado. Vontade mede desgaste psíquico e pode financiar rerrolagens e outras vantagens, com custos e condições. **[PROPOSTO]** Conservar a distinção e executar conversões pela camada mecânica, não por linguagem natural improvisada.

**[CONFIRMADO — ADR-027]** A derrota elegível do protagonista incrementa um contador **permanente**, que não diminui por cura, descanso, tratamento ou mudança de arco; enquanto houver derrotas sobrevivíveis restantes, a derrota gera sobrevivência e consequências a definir. **Após esgotar o limite, a próxima derrota elegível causa morte definitiva e encerra a Jornada.** A contagem deve ser registrada pelo motor, e não apenas narrada pela IA. **[CONFIRMADO — ADR-028]** Somente a incapacitação mecânica do protagonista durante combate é derrota elegível. Captura, rendição, fuga, fracasso narrativo, derrota social e simples falha em testes não acrescentam derrotas ao contador. O motor deve validar a condição mecânica e evitar dupla contagem da mesma incapacitação. **[CONFIRMADO — ADR-029]** Após uma incapacitação sobrevivida, o Narrador propõe consequências pertinentes à Cena, aos adversários e aos acontecimentos. O motor valida e registra mudanças de recursos, condições, inventário, localização e outros estados mecânicos; a narração por si só não altera esses dados. **[PENDENTE]** Regra exata que define incapacitação (conforme adaptação do Astra), número de derrotas toleradas, penalidades específicas, exceções e interação com dano/retirada, saque, fuga, encerramento de confronto, duração e expiração de condições, comportamento de NPCs sem Capacidades.

## VIII. Sistemas complementares

### 1. Inventário e economia

**[CONFIRMADO]** Equipamentos e comércio são parte da interação pretendida, exemplificados pela compra de espada na forja. **Astra de origem:** equipamentos possuem **Valor** abstrato, **Carga** inteira e classes de armas, armaduras, escudos, consumíveis e itens comuns; o cenário determina moeda e regras de compra.

**[CONFIRMADO — ADR-015]** O Henduran terá **moeda concreta**, contabilizada como recurso do personagem, com preços inicialmente derivados do **Valor** dos equipamentos do Astra. Uma compra ou venda válida alterará dinheiro e itens, não apenas o texto narrado. **[PROPOSTO]** Fazer transações por operação atômica: validar item, disponibilidade, preço e saldo → aplicar item e débito/crédito em uma única operação → narrar o resultado. **[PENDENTE]** Nome e denominações da moeda, taxa de conversão do Valor do Astra, regras de venda, estoques, disponibilidade, barganha, procedência e fabricação. Nenhuma equivalência numérica foi aprovada. Não desenvolver crafting completo só porque há ferreiros.

### 2. Descanso, recursos e passagem do tempo

**[CONFIRMADO]** O motor deve administrar recursos do sistema, não deixar a IA decidir números sem validação. **[PROPOSTO]** O Narrador solicita descanso ou avanço temporal; o motor verifica condições e aplica recuperação prevista na regra Henduran. **[PENDENTE]** Calendário, granularidade temporal, restrições de descanso e periodicidade dos efeitos migrados das sessões.

### 3. Relacionamentos, reputação e facções

**[CONFIRMADO]** Relações e consequências com NPCs devem persistir quando narrativamente relevantes. **[PENDENTE]** Não foi aprovado um sistema numérico de afinidade, reputação, facções com pontos ou simulação econômica do mundo. **[PROPOSTO]** Começar registrando fatos e atitudes verificáveis, sem inventar escalas de -100 a +100 herdadas do Caliope.

### 4. Registros e diário

**[CONFIRMADO — ADR-023]** O Henduran terá **diário narrativo** e permitirá gerar um **livro literário exportável** com organização em capítulos e revisão assistida por IA. O diário será construído a partir dos acontecimentos efetivamente registrados na Jornada, podendo expressá-los literariamente sem modificar os fatos canônicos. Arcos narrativos ou a Jornada completa poderão servir de base à elaboração do livro.

**[CONFIRMADO]** O histórico mecânico e os fatos canônicos continuam sendo a fonte de verdade; o texto literário é uma representação derivada, não uma instrução para alterar o Mundo, a ficha, eventos ou consequências. Revisões feitas pela IA não devem inventar acontecimentos ou contrariar o que ocorreu; inconsistências devem ser detectáveis e corrigíveis.

**[CONFIRMADO — ADR-030]** A geração de entradas literárias do diário ocorre **exclusivamente mediante solicitação do jogador**. O sistema continua a registrar automaticamente fatos canônicos e histórico mecânico independentemente do diário, mas não dispara produção de texto literário por marcos narrativos, capítulos, mudanças de cena, tempo decorrido ou mensagens. O Narrador não produz uma entrada literária sem pedido; solicitar entrada não autoriza modificar os fatos canônicos. A geração de livro continua aprovada pela ADR-023, com fluxo específico pendente.

**[CONFIRMADO — ADR-031]** A perspectiva literária do diário e do livro é configurável entre **primeira e terceira pessoa**, com parâmetros da voz narrativa estabelecidos pelo jogador. A geração e a revisão assistidas por IA devem manter consistência de perspectiva, tom e voz entre entradas e capítulos da mesma obra, usando as configurações literárias selecionadas. Essa configuração não altera o cânone da Jornada nem autoriza a geração de textos sem solicitação (ADR-030). Mudanças de perspectiva são possíveis enquanto decisão editorial do jogador; a política para reescrever material anterior permanece pendente.

**[CONFIRMADO — ADR-032]** O Henduran fornecerá um **editor literário** para entradas de diário e capítulos, com edição manual direta, seleção de trechos para reescrita assistida por IA, solicitação de melhorias e **aprovação de versões** pelo jogador antes de incorporá-las ao diário ou ao livro. A revisão pode produzir propostas, mas não modifica automaticamente um texto aprovado sem uma decisão do jogador. O texto literário editado permanece separado do estado canônico da Jornada; alterações editoriais não reescrevem eventos, personagens, inventário ou outras condições reais da história.

**[CONFIRMADO — ADR-033]** O diário e o livro literário terão exportação inicial nos formatos **Markdown (`.md`), PDF (`.pdf`) e EPUB (`.epub`)**. A exportação utilizará a versão de texto escolhida/aprovada no editor, sem modificar o registro canônico da Jornada. Markdown atenderá à edição e ao arquivamento externo; PDF à leitura com layout paginado; EPUB à leitura digital refluível. O mesmo conteúdo literário deverá ser representado de modo coerente nos três formatos, respeitando as características de cada um. A decisão não inclui publicação ou compartilhamento automático.

**[CONFIRMADO — ADR-034]** A organização de capítulos será **híbrida**: o jogador poderá criar, titular e estruturar capítulos manualmente ou solicitar que a IA proponha uma organização de acontecimentos e entradas literárias. O jogador poderá **reorganizar, fundir, dividir, renomear, editar e aprovar** a estrutura e seus capítulos antes da exportação. Propostas da IA não são aplicadas automaticamente e não exigem correspondência direta entre capítulo, Cena ou arco narrativo. A composição literária continua **sob solicitação explícita** (ADR-030), com edição e aprovação (ADR-032), e não altera eventos canônicos.

**[CONFIRMADO — ADR-035]** O Henduran disponibilizará **modelos editoriais selecionáveis** para a apresentação dos livros exportados. O jogador escolherá um modelo antes da exportação, com opções de apresentação literária distintas; a quantidade, os nomes e os estilos concretos dos modelos ainda não estão fixados. Modelos organizam tipografia, espaçamento, margens e hierarquia de títulos conforme as capacidades de cada formato. No **PDF**, a composição é paginada; no **EPUB**, os estilos devem respeitar texto refluível e preferências do leitor. A decisão não implica editor completo de diagramação nem autoriza alterações ao texto aprovado ou aos fatos canônicos. O **Markdown** conserva estrutura de texto independente de uma paginação específica.

**[CONFIRMADO — ADR-036]** O Henduran terá um sistema híbrido de capas para livros literários: modelos predefinidos, importação de imagens externas e geração opcional por IA mediante provedor configurado. A capa é um recurso visual derivado e não altera o conteúdo literário aprovado nem o estado canônico da Jornada.

**[CONFIRMADO — ADR-037]** Diário e livro exportáveis terão **metadados editoriais básicos**: título, subtítulo, autor, pseudônimo opcional, sinopse, data de exportação, nome da Jornada, nome do Mundo e idioma. Esses campos identificam e contextualizam a obra e podem subsidiar capa, folha de rosto e metadados técnicos de PDF/EPUB, sem alterar o conteúdo literário aprovado ou o registro canônico. Os metadados devem ser obtidos de dados conhecidos ou preenchidos/editados pelo jogador, sem atribuir automaticamente autoria ou sinopse inventada como fato.

**[CONFIRMADO — ADR-038]** A publicação e o compartilhamento de livros permanecerão **externos ao Henduran**, por iniciativa do jogador. O aplicativo gera os arquivos literários localmente nos formatos aprovados pela ADR-033, sem enviar automaticamente arquivos ou metadados para plataformas de publicação, sem integração direta obrigatória com serviços externos e sem biblioteca pública própria no escopo inicial. A escolha de onde, quando e como publicar ou compartilhar os arquivos é responsabilidade do jogador. Isso não altera a integração com provedores de IA já definida para recursos específicos, como geração opcional de capas.

**[PENDENTE]** Conjunto e desenho de modelos, opções de personalização, sumário, tipografia e estilos específicos, imagens, estrutura dos arquivos, regras detalhadas de composição de capítulos, limites e escopo de cada entrada solicitada, parâmetros de voz, revisão retroativa, UX detalhada do editor, histórico de versões, critérios técnicos de fidelidade, custo de processamento e fluxos de geração/revisão do livro. **Detalhes técnicos de exportação, parâmetros concretos das capas, regras de preenchimento dos campos bibliográficos e política de direitos autorais permanecem pendentes.** Outros formatos, como TXT e DOCX, não estão aprovados para a exportação inicial.

## IX. Interface e experiência de uso

### 1. Prioridade da interface

**[CONFIRMADO]** O **chat é a superfície principal**. UI pixel art utilizará pacote comercial comprado. Mapas, fichas e inventário complementam o chat. Nenhuma decisão obriga React, WebView2, Godot ou MonoGame; o uso de um tileset **não exige** um motor gráfico específico.

### 2. Superfícies de produto

| Superfície | Finalidade | Estado |
|---|---|---|
| Biblioteca de Jornadas / iniciar jogo | Carregar/criar uma Jornada | [PROPOSTO] |
| Fora de Cena | Diálogo direto com Narrador, mapa-múndi e consulta | [CONFIRMADO] |
| Cena | Chat próprio da situação, falas de NPCs e ações livres | [CONFIRMADO] |
| Interface tática | Grid, tokens, iniciativas, resoluções e opções do personagem | [CONFIRMADO em conceito] |
| Ficha de personagem | Consultar atributos, recursos, Perícias, equipamentos e objetivos | [CONFIRMADO em conceito] |
| Wiki de regras | Consultar regras adaptadas sem sair do jogo | [CONFIRMADO] |
| Gerenciador de IA | Download/carga de modelo local ou chave e seleção de API | [CONFIRMADO] |
| Inventário e comércio | Ver itens e realizar operações válidas | [CONFIRMADO em conceito] |

**[PROPOSTO]** Layout responsivo para desktop com chat em área central, painel contextual recolhível e mapa por alternância/área ajustável. **[PENDENTE]** Layout final, dimensões mínimas, barras, atalhos, telas simultâneas, modo janela e resolução alvo.

### 3. Chat e narrativa

**[CONFIRMADO]** Entrada livre em linguagem natural; IA interpreta NPCs e ambiente. **[PROPOSTO]** Distinguir visualmente mensagens do Narrador, falas de NPCs, jogador, notificações do motor, rolagens e mensagens de correção/OFF. Oferecer streaming incremental e manter texto selecionável e rolável.

**[PENDENTE]** Edição, regeneração, exclusão e retrocesso de mensagens; reações visuais/retratos por humor; sugestões contextuais opcionais/editáveis (presentes na documentação anterior, não explicitamente reconfirmadas em Henduran); separar chats de Cenas e canal Fora de Cena na navegação.

### 4. Usabilidade e acessibilidade

**[PROPOSTO]** Mesmo com fontes pixel art, priorizar legibilidade em parágrafos longos; evitar escalonamento fracionário de sprites; permitir zoom de texto sem distorcer todo o UI; navegação por teclado, foco visível, contraste suficiente e mensagens não dependentes apenas de cor. **[PENDENTE]** Requisitos formais de acessibilidade, leitores de tela, dublagem e plataformas alvo.

### 5. Critérios preliminares de interface

- **[PROPOSTO]** O jogador consegue enviar e ler mensagens longas sem perder a posição de leitura.
- **[PROPOSTO]** Uma Cena possui histórico distinto e recuperável.
- **[PROPOSTO]** Uma compra só muda inventário após validação do motor.
- **[PROPOSTO]** Uma operação tática recusada pelo motor apresenta motivo e não move token indevidamente.
- **[PROPOSTO]** Os elementos comerciais da UI ficam fora do repositório público quando a licença não permite redistribuição.

### Decisão de apresentação tática (ADR-020)

**[CONFIRMADO]** Quando uma situação exigir estrutura tática, o **mapa localizado torna-se a área predominante** da interface. O **chat permanece como área secundária**, disponível para narração, respostas do Narrador e acompanhamento dos acontecimentos. A prioridade visual do mapa não reduz o papel do Narrador como condutor da Jornada.

**[CONFIRMADO]** Em Cenas não táticas, não há mapa localizado obrigatório: a interface continua centrada no chat. O mapa-múndi hexagonal de exploração Fora de Cena é um sistema separado. Uma transição narrativa → tática não perde o histórico nem os fatos persistidos da Cena.

**[PENDENTE]** Proporção entre painéis, comportamento em resoluções menores, expansão/recolhimento do chat, foco do teclado, fluxo de comandos e animações serão definidos em protótipo de UI. Nenhuma medida de tela ou layout rígido é aprovada nesta ADR.

**Aceite mínimo:** em uma Cena tática o jogador consegue visualizar o mapa e ler o chat sem abandonar a situação; ao retornar à narração, o chat volta a ser o foco, com registros e estado preservados.

## X. Direção artística e audiovisual

### 1. Direção visual confirmada

**[CONFIRMADO]** Interface em **pixel art** baseada no [RPG UI Pack da Franuka](https://franuka.itch.io/rpg-ui-pack), adquirido pelo autor. Exploração em mapa hexagonal; combate em grid; tokens com aparência de moeda.

**[CONFIRMADO — ADR-017]** A UI será construída a partir de uma **biblioteca reutilizável de componentes React/TypeScript e CSS** com identidade visual fornecida pelos sprites do RPG UI Pack da Franuka. **Antes de implementar os componentes**, Codex/Claude Code devem executar um **inventário automatizado local** dos assets (arquivos, dimensões, formatos, estados e possibilidades de redimensionamento), sem modificar os originais. Componentes previstos apenas quando suportados pelos arquivos inspecionados: painéis, botões, janelas, barras, menus, elementos de chat e inventário. A interface não deve conter implementações visuais duplicadas por tela quando um componente comum for apropriado.

**[PENDENTE]** Conteúdo real do pacote UI (sprites, dimensões, estados, escalas, fontes e licença), pois os assets estão na máquina local e não foram examinados. Não presumir que todos os componentes pretendidos estão disponíveis nem que sua redistribuição em Git público é permitida. **CSS continua responsável por layout, tipografia e comportamento responsivo**, sem retirar a identidade visual pixel art dos sprites.

### 2. Mapas e cenários

**[PENDENTE]** Estilo exato de tiles de terreno, perspectiva dos mapas localizados, iluminação, animações, retratos de NPC, retrato do jogador, efeitos climáticos, transições e geração de imagens. Preferências de tiles e mapas vistas em protótipos anteriores **não são automaticamente decisões do Henduran**.

### 3. Áudio e efeitos

**[PENDENTE]** Música, efeitos sonoros, voz/TTS, custos e licenças. **[PROPOSTO]** Priorizar feedback discreto para resultado de teste, abertura de Cena e transação; áudio não é dependência do vertical slice central.

## XI. Arquitetura técnica

### 1. Decisões e alternativas

**[CONFIRMADO]** Desktop **somente Windows na primeira fase**, IA local baixada no aplicativo, opção online por API key, interface pixel art, desenvolvimento por agentes, regras adaptadas e chat central. **Stack aprovada:** **Tauri + React + TypeScript + PixiJS + Python**. **Godot 4 + C#** e **MonoGame + C#** foram avaliados, mas não escolhidos para a arquitetura inicial. Ver `docs/decisoes/ADR-001-stack-desktop-windows.md`.

| Alternativa | Ganho principal | Custo/risco principal | Estado |
|---|---|---|---|
| Tauri + React + TypeScript + PixiJS + Python | UI de chat e teste automatizado; compatibilidade conceitual com Caliope | Multiplicidade de runtimes; integração desktop/sidecar | [CONFIRMADO] |
| Godot 4 + C# + serviço IA | UI e mapa 2D com componentes nativos | Integração de chat extenso e automação via editor/cena | [NÃO SELECIONADO] |
| MonoGame + C# + serviço IA | Código C# direto e bom controle | UI textual/menus exigem mais infraestrutura | [NÃO SELECIONADO] |

**[PROPOSTO]** Validar cedo a stack já aprovada com uma prova de chat em streaming, UI pixel art e empacotamento Windows. Escolhas de biblioteca para persistência, transporte de mensagens, mecanismo de execução do Python e linguagem do motor determinístico continuam pendentes; não foram aprovadas implicitamente.

### 2. Responsabilidades conceituais

```text
Interface desktop
  ├─ chat e navegação
  ├─ wiki, ficha e inventário
  └─ renderizador de hexágonos/grid/tokens
        ↕ comandos, consultas e eventos tipados
Aplicação / Orquestração Henduran
  ├─ Jornada e Cenas
  ├─ autorizações e transições
  ├─ estado persistente e memória canônica
  └─ motor de regras Astra adaptado (determinístico)
        ↕ operações validadas e resultados oficiais
Serviço de IA
  ├─ modelos locais GGUF / llama.cpp
  ├─ provedores online e credenciais
  ├─ construção de contexto, prompts e skills
  └─ recuperação de memória narrativa
```

Esta é uma **divisão lógica [PROPOSTA]**, não compromisso com processos físicos separados nem com uma linguagem obrigatória para o motor.

### Decisão de reaproveitamento do Caliope — ADR-016

**[CONFIRMADO]** O Henduran aproveitará **seletivamente componentes independentes do Caliope**, após auditoria de **compatibilidade técnica, licença e permissões**. A **orquestração narrativa**, o **motor de regras** e demais sistemas mecânicos específicos do Henduran serão implementados para o próprio projeto, não transplantados indiscriminadamente do Caliope.

**[CANDIDATOS À AUDITORIA, NÃO APROVADOS AUTOMATICAMENTE PARA CÓPIA]** Cliente de LLM/API, download e gestão de GGUF, inicialização e supervisão de llama.cpp, memória/embeddings, gestão de skills. A reutilização de cada módulo depende de exame de dependências, licença, eventuais autorizações para redistribuição e adequação à distribuição Windows do Henduran. Código não aprovado pode servir apenas como referência arquitetural.

**[NÃO REUTILIZAR COMO MOTOR DO HENDURAN]** Regras, fórmulas, combate, economia e progressão próprios do Caliope; prompts e orquestração narrativa fortemente acoplados ao projeto de origem.

**[PENDENTE]** Inventário módulo a módulo, registros das autorizações e atribuições necessárias, testes de isolamento, empacotamento do sidecar e seleção definitiva do código a portar. A existência de autorização informal não substitui a verificação documental de direitos e condições aplicáveis.

### 3. Reaproveitamento seletivo do Caliope

O repositório Caliope possui backend Python/FastAPI e frontend React/Vite. A inspeção identificou módulos `llm.py` (cliente compatível com API OpenAI), `modelhub.py` (GGUF/downloads via Hugging Face), `runtime.py` (servidor llama.cpp), `memory.py` (SQLite FTS5 e embeddings), `skills.py` (SKILL.md), `engine.py` (turno do chat) e `prompts.py`. **[PROPOSTO]** Reutilizar inicialmente **infraestrutura de LLM**, não seu motor de RPG, combat system ou regras de NPC. A integração deve ter contratos próprios, e a adequação do código e direitos de reutilização devem ser confirmados com o autor/licença antes de copiar arquivos.

### 4. Esquema conceitual de dados

**[PROPOSTO]** Entidades mínimas, sujeitas a evolução:

| Entidade | Campos/relacionamentos essenciais (não schema final) |
|---|---|
| `Journey` | id, versão de regras, estado, protagonista, objetivos, Cena ativa |
| `Character` | id, identidade, atributos, perícias, recursos, condições, inventário |
| `Scene` | id, journey, tipo/contexto, status, local, participantes, histórico |
| `Message` | id, cena/canal, emissor, conteúdo, referência a resolução, ordem |
| `WorldLocation` | id, descrição, posição/relações, fatos confirmados |
| `WorldFact` | id, proposição, origem, validade, conhecimento por entidade |
| `RuleOperation` | id, tipo, argumentos, autorização, resultado, efeitos |
| `InventoryTransaction` | id, partes, itens, preço, estado, referência de Cena |
| `LLMProfile` | provedor, identificador de modelo, opções, referência segura às credenciais |

**[CONFIRMADO — ADR-007]** O Henduran manterá estado atual persistido e histórico de eventos relevantes, com vínculo entre operações, efeitos e Cenas. **[CONFIRMADO — ADR-009]** Correções pontuais de inconsistências e restauração de salvamentos anteriores serão suportadas, restaurando um estado consistente sem mesclar eventos posteriores incompatíveis.

**[CONFIRMADO — ADR-039]** O Henduran utilizará **salvamentos híbridos**: salvamento automático após alterações relevantes do estado e possibilidade de o jogador criar **salvamentos manuais identificáveis**. O jogador poderá restaurar estados anteriores, de acordo com a ADR-009. Uma restauração deve manter em conjunto o estado mecânico e narrativo, o inventário, os recursos, os NPCs, as relações, a localização, os eventos, as informações de memória e o **contador permanente de derrotas correspondente ao ponto salvo**; não deverá montar um estado combinando partes incompatíveis de momentos diferentes. Restaurações não autorizam desfazer seletivamente ações isoladas no estado atual. A permanência das derrotas (ADR-027) vale na continuidade do estado jogado, sem impedir restauração integral de um salvamento anterior já autorizada.

**[CONFIRMADO — ADR-049]** Alterações lógicas no estado persistente serão **atômicas**: todos os efeitos validados de uma operação serão gravados integralmente, ou nenhum deles será aplicado. Exemplo: uma compra não poderá debitar dinheiro sem entregar o item ou atualizar o estoque quando essas alterações fizerem parte da mesma operação. Após queda do aplicativo, perda de energia ou falha de gravação, o Henduran deverá **recuperar automaticamente o último estado transacional consistente**, sem depender da criação de um novo checkpoint para garantir a integridade de operações já confirmadas. O registro de eventos canônicos e as alterações de estado relacionadas à operação deverão manter consistência entre si; execução/repetição da mesma operação não poderá duplicar seus efeitos. Isso não exige histórico integral do tipo *event sourcing* e não escolhe ainda banco de dados, tecnologia de transação nem arquitetura física. **[CONFIRMADO — ADR-050]** O **SQLite será o banco de dados local principal** do Henduran para estados estruturados, dados de Mundos e Jornadas, ramificações, salvamentos, relações, histórico de eventos e metadados persistentes. **Arquivos volumosos** (como imagens) poderão ser armazenados fora do banco quando apropriado, mantendo referências controladas e consistentes. Esta escolha não determina o mecanismo de busca semântica nem exige que todo anexo fique fora do SQLite. **[PENDENTE]** Esquema de tabelas, índices, migrações do banco, estratégia de transações/commit/recovery, limites transacionais, consistência entre o banco e arquivos externos, durabilidade efetiva, manutenção e testes de falha.

**[CONFIRMADO — ADR-048]** Checkpoints de **autosave** serão gerados após **alterações persistentes de estado** e **acontecimentos canônicos importantes** da Jornada. Operações como mudanças validadas em inventário, recursos, localização, relações, combate ou eventos relevantes são candidatas a checkpoints segundo regras a especificar. **Persistência do histórico de mensagens não equivale à criação de um novo checkpoint:** mensagens e registros narrativos devem ser armazenados adequadamente sem gerar necessariamente um autosave restaurável a cada interação. Não foi aprovada uma cadência periódica de checkpoints nem a criação de um checkpoint obrigatório a cada mensagem. O checkpoint deve refletir um estado completo e consistente após a alteração confirmada, sem duplicar salvamentos por um mesmo evento. **[PENDENTE]** Gatilhos exatos, agrupamento de alterações, política de falhas e intervalos de persistência do histórico; frequência, quantidades e retenção quantitativa de checkpoints.\n\n**[CONFIRMADO — ADR-040]** A política de retenção automática será **híbrida**: o Henduran preservará tanto um conjunto de **salvamentos recentes** quanto determinados **pontos associados a marcos importantes da Jornada**. Outros autosaves poderão ser descartados conforme critérios de retenção a especificar. A finalidade é permitir recuperação tanto de problemas recentes como de momentos narrativos importantes, sem impor histórico ilimitado de checkpoints. Os salvamentos **manuais permanecem independentes** da rotação ou descarte de autosaves; essa política não autoriza excluí-los automaticamente. Um marco narrativo não concede XP nem altera o estado por ser um marco de retenção, e o autosave correspondente continua sendo um estado integralmente restaurável.

**[CONFIRMADO — ADR-041]** Ao **continuar a partir de um salvamento anterior**, o Henduran criará **automaticamente uma ramificação independente** da Jornada. A continuidade de origem permanece preservada e acessível para consulta ou retomada; a nova continuidade nasce do estado completo do ponto restaurado e prossegue com histórico, memória, inventário, relações, eventos e contador de derrotas próprios. A mera visualização de um save não precisa criar ramificação: o gatilho aprovado é a retomada do jogo a partir de um estado anterior. Narrativa, mecânicas e operações de uma ramificação não alteram outras ramificações e não permitem transferir arbitrariamente itens, eventos ou derrotas entre linhas. Não se aplica sobrescrita destrutiva automática da continuidade original.

**[CONFIRMADO — ADR-042]** As ramificações de uma mesma Jornada serão apresentadas e gerenciadas por uma **árvore visual de continuidades**. A interface permitirá identificar as relações entre linhas, os pontos de divergência e o progresso de cada ramificação, facilitando selecionar, consultar e retomar uma delas. A árvore é uma representação da estrutura persistida, não altera a independência dos estados aprovada na ADR-041 e não concede mistura ou fusão automática de eventos entre linhas.

**[CONFIRMADO — ADR-043]** A árvore de continuidades permitirá **arquivar** ramificações para retirá-las da visualização principal sem perder seus dados nem impedir sua futura retomada. Também será possível solicitar **exclusão definitiva controlada**, mediante **confirmação explícita** e **verificação de dependências** antes de qualquer remoção. A exclusão não poderá invalidar ramificações descendentes, pontos históricos compartilhados, saves ou demais continuidades ainda existentes. Quando a segurança da operação não puder ser comprovada, o motor deverá impedir a remoção ou exigir resolução específica antes de prosseguir; não há exclusão automática por inatividade. A medida não define ainda a estratégia técnica para referências e armazenamento compartilhados.

**[PENDENTE]** Esquema SQLite, tabelas, índices, migrações e estratégia de referências a arquivos grandes, seleção dos eventos registrados, **frequência e gatilhos exatos** dos autosaves, **quantidade de saves recentes, critérios de marcos preservados e intervalos de retenção**, formatos dos saves, nomes e metadados dos slots manuais, **detalhes da árvore visual e dos identificadores de ramificação**, apresentação das linhas arquivadas, estratégia de exclusão segura e recuperação, efeitos em armazenamento, importação/exportação de saves e UX de recuperação. **[CONFIRMADO — ADR-044]** Haverá **backup portátil exportável e importável** de uma Jornada, incluindo suas ramificações e as dependências do Mundo necessárias para que os dados sejam restaurados coerentemente em outra instalação do Henduran. A operação não exige sincronização em nuvem nem serviço remoto. O pacote de backup não deve incluir segredos de API, modelos de IA instalados ou assets comerciais sem permissão de redistribuição. **[CONFIRMADO — ADR-045]** A importação de backups será **assistida**, com detecção prévia de conflitos entre dados importados e dados existentes. O jogador receberá alternativas adequadas à situação: **importar como cópia independente**, **reutilizar dependências compatíveis** ou **substituir dados existentes** apenas mediante confirmação explícita e verificação de segurança e integridade. Não haverá sobrescrita ou fusão silenciosa de Mundos, Jornadas ou ramificações. Reutilização ou substituição não pode quebrar relações de dependência de dados já instalados; se a operação não puder ser realizada com segurança, deverá ser impedida. **[CONFIRMADO — ADR-046]** Backups criados em versões anteriores poderão passar por **migração para a versão atual**, com identificação da versão de origem, validação de integridade e compatibilidade, apresentação dos riscos e **confirmação explícita do jogador antes de aplicar alterações**. O **backup original será preservado sem modificações**. Uma migração insegura, impossível ou não validada será interrompida sem alterar os dados instalados ou o arquivo original. As regras de importação assistida e detecção de conflitos (ADR-045) permanecem aplicáveis após uma migração. **[CONFIRMADO — ADR-047]** O formato dos backups portáteis será um **pacote ZIP estruturado e versionado**, contendo manifesto de identificação e versão, dados estruturados da Jornada, suas ramificações, histórico e memória necessários à restauração, dependências necessárias do Mundo e anexos cuja inclusão seja permitida. O manifesto permite que o importador reconheça o esquema do pacote antes de iniciar validações e eventual migração, mas seus campos exatos ainda não foram definidos. O formato ZIP não autoriza a inclusão de segredos, modelos de IA instalados ou assets comerciais sem permissão de redistribuição. **[PENDENTE]** Esquema interno e nomes dos arquivos, campos do manifesto, algoritmos e parâmetros de compressão, limites e proteção contra arquivos maliciosos, checksums e validação técnica de integridade, versões legadas efetivamente suportadas, passos concretos de migração e rollback, regras de identificação de conflitos, seleção de dados opcionais e comportamento de restauração. **[PROPOSTO]** Chaves de API em armazenamento seguro do sistema, nunca no save ou repositório.

### 5. Ferramentas do Narrador

**[PROPOSTO]** Contratos de operação distintos, como `consultar_regra`, `consultar_personagem`, `propor_cena`, `solicitar_teste`, `propor_movimento`, `registrar_fato`, `propor_transacao`, `encerrar_cena`. As operações que modificam estado passam por validação e política de permissão. A ferramenta devolve resultado estruturado, com sucesso/erro. A IA recebe apenas os campos necessários.

Exemplo conceitual de solicitação de teste **(não API definitiva)**:

```json
{
  "tipo": "solicitar_teste",
  "personagem_id": "pc-1",
  "pericia": "Persuadir",
  "dificuldade": 2,
  "motivo": "Convencer o ferreiro a revelar a origem da lâmina"
}
```

A dificuldade `2` é **ilustrativa**, retirada da escala sugerida pelo Astra, não aprovação para a situação. O motor verifica permissões e regra vigente antes de executar; o Narrador não injeta resultados numéricos como fonte de verdade.

#### Diretriz aprovada: autonomia com permissões (ADR-004)

**[CONFIRMADO]** O Narrador IA conduz acontecimentos, interpreta NPCs e pode propor mudanças persistentes no mundo. Essas mudanças são efetivadas exclusivamente por **operações tipadas, autorizadas, validadas e auditáveis**. O motor Astra adaptado mantém a autoridade sobre rolagens, recursos, inventário, condições, movimentação e demais efeitos mecânicos. O jogador conserva as decisões de seu personagem; uma resposta narrativa nunca substitui uma escolha do jogador.

**[PROPOSTO — matriz inicial, a detalhar]:**

| Operação | Política candidata |
|---|---|
| Descrever ambiente, improvisar fala de NPC | Autonomia narrativa, respeitando fatos canônicos |
| Consultar regras, fichas e estado | Leitura controlada, sem alterações |
| Sugerir cena, acontecimento, NPC ou fato persistente | Ferramenta tipada; validação de coerência e escopo antes de persistir |
| Solicitar teste, ação tática, dano, mudança de Vida/Vontade, condição | Motor de regras executa/recusa; **testes fora de situações táticas exigem confirmação prévia do jogador (ADR-006)**; a política detalhada das ações táticas segue pendente |
| Compra, venda, gasto de XP, movimento ou escolha do personagem | Necessita uma decisão do jogador que autorize a ação; executar somente após validação |
| Corrigir informação contraditória ou erro do Narrador | **[CONFIRMADO — ADR-009]** Suportar retificação pontual controlada, sem autorizar a IA a reescrever livremente fatos ou alterar escolhas legítimas do jogador |
| Restaurar salvamento anterior | **[CONFIRMADO — ADR-009]** Ação iniciada pelo jogador, restaurando estado e memória consistentes com o ponto escolhido; detalhes de checkpoints e UX pendentes |
| Desfazer individualmente ações arbitrárias já consumadas | **Não aprovado**; não inferir histórico inteiramente reversível a partir da ADR-009 |

A tabela é um **rascunho de implementação**, e não aprovação de cada permissão individual. O protocolo deve garantir que mensagens geradas pela IA não atualizem diretamente a base de dados. Operações recusadas retornam erro estruturado ao Narrador, sem efeito parcial. Conforme ADR-006, cada teste fora de situações táticas requer confirmação antes de sua execução. A regra de confirmação não concede ao Narrador permissão para decidir a ação do protagonista. A UX de confirmação e o fluxo específico de testes táticos continuam em detalhamento.

### 6. Operação local e online

**[CONFIRMADO]** Baixar modelos localmente no aplicativo e oferecer provedores por API key. **[PROPOSTO]** Interface única de chat com streaming, cancelamento, mensagens de erro, limite de contexto e observabilidade local; gerenciamento de download com progresso/verificação de integridade; processo local de IA encerrado com o aplicativo. **[PENDENTE]** plataformas suportadas, empacotamento de Python/llama.cpp, hardware mínimo, drivers, quantizações padrão, provedores oficiais e telemetria.

### 7. Testes e desenvolvimento por agentes

**[CONFIRMADO]** Codex/Claude Code desenvolverão o produto. **[PROPOSTO]** Criar `AGENTS.md` com fronteiras, comandos de execução, padrões de teste, regras de não inventar mecânicas e proteção de assets. Testar separadamente: regras por exemplos de rolagem; transações e persistência; parsing de mensagens; integração por simulador/fake de LLM; E2E do chat e screenshots da UI. Testes com LLM real devem reconhecer variabilidade e não exigir reprodução literal da prosa.

## Encerramento da rodada de questões críticas — consolidação v6.9

**[CONFIRMADO — DECISÃO DE PROCESSO, SEM NOVA ADR TÉCNICA]** A rodada sequencial de perguntas críticas foi encerrada após a aprovação de **P-66 / ADR-067**. A questão **P-67**, apresentada sobre percepção indireta de revelações, **não foi respondida nem aprovada**. Nenhuma alternativa recomendada para P-67 deve ser tratada como requisito.

O processo de aprovação já produziu **67 ADRs (ADR-001 a ADR-067)**, correspondendo a escolhas técnicas e de produto anteriores. A quantidade ultrapassou o plano inicial de 22 questões; por isso, não se abrirão novas decisões individuais por padrão. Exceções somente para divergências realmente bloqueadoras, mudança de escopo ou decisão cujo custo/impacto exija validação do autor.

O desenvolvimento deve ser dirigido pelos documentos adicionais:

- `docs/planejamento/CONSOLIDACAO-DE-ESCOPO.md`: inventário de confirmados, bloqueios reais e detalhes delegáveis;
- `docs/planejamento/PLANO-DE-DESENVOLVIMENTO.md`: implementação por incrementos com entregáveis e critérios de aceite;
- `docs/planejamento/BRIEFING-PARA-AGENTES.md`: contexto e instruções para Codex/Claude Code antes de executar mudanças.

**[PROPOSTO — NÃO APROVADO COMO ESCOPO FINAL]** Começar pelo vertical slice de chat, Cena social e motor determinístico; validar persistência, testes e uma operação de inventário antes de expandir exploração e tático. O mapa hexagonal e o combate em grid continuam metas de produto aprovadas, mas sua ordem de construção poderá ser ajustada conforme dependências. O recorte e os marcos são hipóteses operacionais a validar na implementação.

## XII. Escopo e planejamento

### 1. Vertical slice — proposta

**Objetivo [PROPOSTO]:** demonstrar uma Jornada pequena que começa Fora de Cena, entra em uma Cena social iniciada voluntariamente, conversa com um ferreiro, realiza uma operação de inventário validada, executa um teste, encerra a Cena e conserva suas consequências após reiniciar o aplicativo. O Narrador deve responder por pelo menos um modelo local e, em seguida, pelo menos um provedor online configurado pelo usuário. Um mapa hexagonal e um grid com tokens podem entrar em uma segunda expansão do slice caso não estejam impedindo a validação do chat.

**Critérios mínimos [PROPOSTOS]:** chat com streaming; carga/salvamento; contextos separados por Cena; persistência de efeitos; não alteração indevida de recurso; troca de provedor sem mudar o resultado mecânico; UI com assets licenciados carregados da máquina local.

### Adaptação de NPCs e orçamento de criação (ADR-003)

**[CONFIRMADO]** Os NPCs e criaturas do bestiário Astra poderão ser adaptados para Henduran, removendo Competências e Capacidades e revisando o equilíbrio. O ponto de partida será `astra-rules/Regras/Criaturas/Criação de NPCs.md`, inclusive seus patamares **Capanga, Par, Veterano, Elite e Lendário**.

O orçamento original combina limites de Atributos, Perícias, Absorção natural, Pontos de Capacidade e referências de encontros. **[ADAPTADO — princípio aprovado]** O Henduran utilizará inicialmente os componentes não dependentes de Capacidades; os Pontos de Capacidade não serão gastos nem redistribuídos automaticamente. **[PENDENTE]** Definir os ajustes pontuais para criaturas cujo funcionamento depende essencialmente dessas Capacidades e testar o desafio em contexto solo. Os patamares são régua de aproximação, não cálculo exato de desafio.

**Critérios de conformidade propostos:** ficha sem Capacidades; Atributos e Perícias dentro do orçamento escolhido ou exceção explícita; ataques e recursos válidos no motor; efeitos especiais não inventados; testes de combate para selecionar o patamar adequado. O Narrador pode criar conceito, personalidade e histórico, mas propostas mecânicas precisam ser validadas pelo motor.

### Decisão de implementação do motor Astra (ADR-002)

**[CONFIRMADO]** A adaptação do Astra será implementada progressivamente, sem que essa sequência implique simplificação permanente. O objetivo final é contemplar os subsistemas aplicáveis do Astra, **adaptados ao Henduran**. Competências e Capacidades permanecem fora do escopo inicial por decisão anterior; o retorno delas não está aprovado.

**[PROPOSTO — sequência de trabalho, não escopo fechado]:**

1. Personagem, Atributos, Perícias, reservas de d10, resultados e testes.
2. Vida, Vontade, inventário, equipamentos básicos, estado persistente e integração com Cenas.
3. Confrontos, iniciativa, ações, movimento, grid, condições e NPCs selecionados.
4. Demais regras aplicáveis, progressão e refinamentos validados por testes.

A ordem exata, o conteúdo de cada marco e os critérios de conformidade serão definidos em uma matriz de implementação. Nenhuma etapa autoriza o Narrador IA a produzir resultados mecânicos sem validação do motor.

### 2. MVP — recorte sugerido

| Entrega | Necessidade | Estado |
|---|---|---|
| Chat e Narrador com contexto | Central para a experiência | [PROPOSTO MVP] |
| Criar/carregar Jornada e personagem | Continuidade | [PROPOSTO MVP] |
| Fora de Cena → Cena → Fora de Cena | Loop principal | [PROPOSTO MVP] |
| Regras básicas e testes automáticos | Identidade Astra | [PROPOSTO MVP] |
| Inventário e compra simplificada | Cena social demonstrável | [PROPOSTO MVP] |
| Wiki interna mínima das regras usadas | Fonte de verdade | [PROPOSTO MVP] |
| Modelo local e alternativa online | Compromisso de plataforma | [PROPOSTO MVP] |
| Mapa hexagonal navegável básico | Exploração | [PROPOSTO MVP, após slice do chat] |
| Combate em grid/tokens funcional básico | Loop tático | [PROPOSTO MVP, após regras de combate] |

**Não incluir inicialmente [PROPOSTO]:** Competências/Capacidades [CONFIRMADO], sistemas econômicos globais, crafting detalhado, multiplayer, áudio dinâmico, editor universal de campanhas, geração de imagens em tempo real, simulação integral de todos os NPCs, campanhas autorais extensas.

### 3. Marcos sugeridos (sem prazos)

1. **M0 — Decisões e requisitos:** ratificar GDD, regras adaptadas iniciais, stack e responsabilidades; inspecionar licença/assets.
2. **M1 — Serviço de IA isolado:** carregar modelo local, trocar provedor, streaming, cancelamento, testes de falha e credenciais.
3. **M2 — Chat e Cenas:** Jornada persistida, Fora de Cena, Cena social, memória e estado oficial.
4. **M3 — Regras básicas:** criação, ficha, rolagens e operações estruturadas; wiki correspondente.
5. **M4 — Exploração:** mapa hexagonal, deslocamento, posição persistente, início voluntário/procedural de Cena.
6. **M5 — Tático:** grid, tokens, iniciativa, Ação/Movimentação e Confronto segundo regras adaptadas.
7. **M6 — Teste integrado:** regressões, hardware local, consistência narrativa, recuperação de falhas e empacotamento desktop.

**[PROPOSTO]** Os marcos são dependências de validação, não compromissos de cronograma nem promessa de completar todos os sistemas de uma vez.

### 4. Riscos e mitigação

| Risco | Impacto | Mitigação proposta |
|---|---|---|
| IA confunde narração com mudança oficial | Corrupção da Jornada | Comandos tipados + validação + registro |
| Memória cresce sem controle | Lentidão/contradições | Recuperação seletiva + fatos canônicos separados |
| Migração de “sessão” desequilibra recursos | Exploração de Vontade/XP | Revisão de frequência baseada em testes |
| Bestiário depende de Capacidades excluídas | Combate inconsistente | Adaptar fichas explicitamente |
| Muitos sistemas simultâneos | Escopo inviável | Slice social antes da geração global |
| Modelo local fraco | Narrativa inconsistente | Limites de contexto, prompts testados, modos de erro |
| Dependências de UI e sidecar | Distribuição problemática | Empacotar/testar cedo em instalação limpa |
| Licença de código/assets | Distribuição indevida | Verificar permissões e manter assets fora do Git público quando exigido |
| Agentes implementam suposições | Divergência entre design e código | `AGENTS.md`, ADRs, testes e status de decisão |

## XIII. Pendências de design

A tabela abaixo consolida as questões que devem ser decididas, com impacto e recomendação. Nenhuma recomendação é aprovação automática.

| ID | Pergunta | Alternativas e impactos | Recomendação | Prioridade |
|---|---|---|---|---|
| P-01 | **RESOLVIDA — stack aprovada** | Tauri + React + TypeScript + PixiJS + Python | ADR-001; validar empacotamento e integração | Resolvida |
| P-02 | **RESOLVIDA — marcos narrativos e acontecimentos significativos** | Cada mecânica terá gatilhos e limites próprios, sem sessão artificial universal (ADR-010) | Definir frequência, critérios e efeitos específicos em P-03 e revisão das regras | Resolvida |
| P-03 | **RESOLVIDA — mudança de objetivos condicionada à história** | Desejo: conclusão, abandono ou perda de relevância; Ambição: acontecimentos significativos ou transformação das motivações | ADR-011; benefícios de Vontade e limites antifarming permanecem pendentes | Resolvida |
| P-04 | **RESOLVIDA — implementação progressiva** | O motor Astra adaptado será construído em etapas; não haverá simplificação permanente das regras por esse motivo | Definir matriz de subsistemas e critérios de aceite por marco (ADR-002) | Resolvida |
| P-05 | **RESOLVIDA — adaptar NPCs existentes** | Excluir Competências e Capacidades da implementação inicial; usar orçamento de criação de NPCs do Astra como referência de patamares, limites e equilíbrio (ADR-003) | Testar fichas adaptadas e encontros representativos | Resolvida |
| P-06 | **RESOLVIDA — mapas localizados só em situações táticas** | Cenas narrativas usam chat; mapa localizado apenas em fase tática, inclusive sem combate; mapa hexagonal Fora de Cena é independente (ADR-005) | Definir gatilhos e fluxo de transição à fase tática | Resolvida |
| P-07 | **RESOLVIDA — confirmação prévia obrigatória** | Todo teste fora de situações táticas deve ser apresentado ao jogador e confirmado antes da rolagem (ADR-006) | Implementar fluxo de solicitação/aceite/cancelamento, sem rolagem antecipada | Resolvida |
| P-08 | **RESOLVIDA — Narrador autônomo sob regras e permissões** | A IA conduz a narrativa e solicita mudanças de mundo por ferramentas validadas; motor de regras decide os efeitos; escolhas pertencentes ao jogador são preservadas | ADR-004; detalhar matriz de permissões por operação durante a implementação | Resolvida |
| P-09 | **RESOLVIDA — persistência e política de correção** | Estado atual + histórico de eventos relevantes (ADR-007); correções pontuais e restauração de salvamentos (ADR-009); autosaves e saves manuais (ADR-039) | Detalhar formato, retenção, frequência, integridade de memória e UX sem permitir desfazer seletivo indiscriminado | Resolvida |
| P-10 | **RESOLVIDA — memória híbrida** | Fatos estruturados + resumos narrativos + busca semântica; estado oficial independente | ADR-008; modelos de indexação, proveniência e conhecimento individual ainda em detalhamento | Resolvida |
| P-11 | **RESOLVIDA — mundo híbrido** | Estrutura geográfica inicial + detalhamento e expansão procedural persistentes; locais, personagens, acontecimentos e mudanças permanecem após descoberta | ADR-018; definir escala/rotas/visibilidade em P-12 e lore em P-15 | Resolvida |
| P-12 | **RESOLVIDA PARCIALMENTE — hexágonos regionais** | Hexágonos representam áreas geográficas amplas com múltiplos pontos de interesse internos; medida exata, rota, custos e visibilidade não definidos | ADR-019; especificação espacial e casos de teste posteriores | Princípio aprovado; parâmetros pendentes |
| P-13 | **RESOLVIDA — mapa predominante e chat secundário em situações táticas** | Nas situações táticas, o mapa recebe prioridade visual e o chat permanece acessível em área secundária | ADR-020; proporções, modos de expansão, foco, redimensionamento e navegação detalhada pendentes de protótipo | Resolvida |
| P-14 | **RESOLVIDA — moeda concreta e Valor Astra como referência** | O jogador possui dinheiro contabilizado; preços partem do Valor abstrato do Astra sem conversão numérica ainda aprovada | ADR-015; detalhar unidade monetária, conversão, barganha e estoques | Resolvida |
| P-15 | **RESOLVIDA — Mundos independentes e reutilizáveis** | Criação manual, geração assistida por IA e importação de wikis/documentos; cada Jornada utiliza um Mundo selecionado com estado próprio | ADR-021; definir editor, ingestão, proveniência, licenças, versionamento e política de publicação | Resolvida |
| P-16 | **RESOLVIDA — Windows inicial** | Windows é a única plataforma do lançamento inicial; outras plataformas não estão comprometidas | Testar instalação limpa no Windows | Resolvida |
| P-17 | **RESOLVIDA — reaproveitamento seletivo** | Reutilizar apenas componentes independentes após auditoria de compatibilidade, licença e permissões; reescrever orquestração narrativa e motor mecânico do Henduran | ADR-016; inventário e auditoria de módulos ainda necessários | Resolvida |
| P-18 | **RESOLVIDA — biblioteca reutilizável pixel art** | Componentes React/CSS reutilizáveis a partir de inventário automatizado local dos sprites Franuka; assets originais preservados | ADR-017; auditoria real dos arquivos, licença e protótipo visual ainda necessários | Resolvida |
| P-19 | **RESOLVIDA — Jornada contínua, encerramento opcional** | Concluir uma Ambição fecha um arco, mas a Jornada pode continuar com outra Ambição ou ser encerrada pelo jogador | ADR-022; morte, derrota, epílogos e outras situações excepcionais ainda dependem de decisão | Resolvida |
| P-20 | **RESOLVIDA — Diário narrativo e livro literário exportável** | Diário fundamentado no histórico da Jornada; capítulos e geração de livro com revisão assistida por IA | ADR-023; Markdown/PDF/EPUB aprovados na ADR-033; composição de capítulos e critérios de fidelidade pendentes | Resolvida |
| P-21 | Hardware e modelos recomendados? | Faixas por VRAM e RAM, fallback CPU — impacto em experiência | Medir no hardware de referência | Média |
| P-22 | Idioma, segurança e limites narrativos? | Preferências e filtros configuráveis; regras de conteúdo — impacto em distribuição e UX | Política explícita depois do slice | Média |
| P-23 | **RESOLVIDA — versionamento de Mundos e atualização controlada de Jornadas** | Jornada vinculada a versão do Mundo; atualizações opcionais, com detecção de conflitos e proteção a fatos canônicos | ADR-024; interface, política de conflitos, migrações e reversibilidade pendentes | Resolvida |
| P-24 | **RESOLVIDA — importação assistida com aprovação do jogador** | IA prepara proposta estruturada, preserva fontes e sinaliza inconsistências; somente dados revisados e aprovados tornam-se canônicos | ADR-025; formatos, granularidade de aprovação, tratamento de conflitos e licenças pendentes | Resolvida |
| P-25 | **RESOLVIDA — conflitos entre versões com mediação por IA e aprovação do jogador** | IA apresenta alternativas para conflitos; nada é incorporado antes da aprovação explícita e da validação; fatos canônicos permanecem protegidos | ADR-026; UI de comparação, granularidade, rollback e migradores ainda pendentes | Resolvida |
| P-26 | **RESOLVIDA — mortalidade progressiva e derrotas permanentes** | Incapacitações mecânicas em combate acumulam contador permanente; após esgotar o limite de sobrevivência, a derrota seguinte causa morte definitiva e encerra a Jornada | ADR-027 e ADR-028; número de derrotas, limiar mecânico e consequências pendentes | Resolvida |
| P-27 | **RESOLVIDA — apenas incapacitação mecânica em combate** | Nenhuma derrota fora de combate incrementa o contador de mortalidade; motor valida e evita contagem duplicada | ADR-028; limiar de incapacitação e exceções ainda pendentes | Resolvida |
| P-28 | **RESOLVIDA — consequências contextuais de incapacitação sobrevivida** | Narrador IA propõe consequências coerentes com o confronto e o motor valida e persiste seus efeitos mecânicos | ADR-029; penalidades específicas e regras de aplicação pendentes | Resolvida |
| P-29 | **RESOLVIDA — diário literário somente sob demanda** | Histórico e fatos canônicos registrados normalmente; entradas literárias geradas exclusivamente quando o jogador solicita | ADR-030; escopo da solicitação e fluxo específico de exportação pendentes | Resolvida |
| P-30 | **RESOLVIDA — perspectiva e voz literária configuráveis** | Primeira ou terceira pessoa, parâmetros de voz definidos pelo jogador e consistência ao longo de capítulos e entradas | ADR-031; parâmetros específicos, alterações retroativas e regras de aplicação à exportação pendentes | Resolvida |
| P-31 | **RESOLVIDA — editor literário com revisão e aprovação** | Edição manual, reescrita de trechos por IA, solicitação de melhorias e aprovação de versões, sem alterar o estado canônico | ADR-032; interface, histórico de versões e fluxo de exportação pendentes | Resolvida |
| P-32 | **RESOLVIDA — formatos iniciais de exportação literária** | Exportação de diário e livro nos formatos Markdown, PDF e EPUB | ADR-033; seleção de modelos editoriais na ADR-035; capas, detalhes de layout e publicação pendentes | Resolvida |
| P-33 | **RESOLVIDA — organização híbrida de capítulos** | Criação manual ou proposta pela IA sob demanda; jogador pode reorganizar, fundir, dividir, renomear, editar e aprovar | ADR-034; modelos editoriais selecionáveis na ADR-035; capas e detalhes de montagem pendentes | Resolvida |
| P-34 | **RESOLVIDA — modelos editoriais selecionáveis** | Jogador escolhe entre modelos predefinidos para a apresentação dos livros exportados; estilos adaptados a PDF paginado e EPUB refluível | ADR-035; número/estilo dos modelos, publicação e implementação da exportação pendentes; sistema de capas aprovado na ADR-036 | Resolvida |
| P-35 | **RESOLVIDA — sistema híbrido de capas** | Modelos predefinidos, importação de imagens e geração opcional por IA mediante provedor configurado | ADR-036; publicação e detalhes técnicos de capa pendentes | Resolvida |
| P-36 | **RESOLVIDA — metadados editoriais básicos** | Título, subtítulo, autor, pseudônimo opcional, sinopse, data de exportação, Jornada, Mundo e idioma | ADR-037; preenchimento e metadados técnicos pendentes; política de publicação resolvida na ADR-038 | Resolvida |
| P-37 | **RESOLVIDA — publicação externa pelo jogador** | Exportação local de Markdown/PDF/EPUB; jogador decide onde, quando e como compartilhar ou publicar; sem integrações de publicação ou biblioteca pública própria inicialmente | ADR-038; aspectos jurídicos e técnicos da exportação pendentes | Resolvida |
| P-38 | **RESOLVIDA — salvamentos híbridos** | Autosaves após alterações relevantes; salvamentos manuais identificáveis; restauração integral de estado anterior consistente | ADR-039; retenção híbrida na ADR-040; frequência, formato e política de ramificação pendentes | Resolvida |
| P-39 | **RESOLVIDA — retenção híbrida de autosaves** | Preservar salvamentos automáticos recentes e pontos de marcos importantes; outros autosaves podem ser descartados; saves manuais independentes | ADR-040; quantidades, intervalos e critérios específicos pendentes | Resolvida |
| P-40 | **RESOLVIDA — ramificações independentes por restauração** | Continuar um salvamento anterior cria automaticamente nova ramificação, mantendo a continuidade original disponível; estados e históricos não se misturam | ADR-041; árvore de navegação aprovada na ADR-042; arquivamento/exclusão controlados pela ADR-043; armazenamento pendente | Resolvida |
| P-41 | **RESOLVIDA — árvore visual de continuidades** | Visualização das ramificações, relações, pontos de divergência e progresso de cada linha para consulta e retomada | ADR-042; arquivamento/exclusão controlados pela ADR-043; layout detalhado e armazenamento pendentes | Resolvida |
| P-42 | **RESOLVIDA — arquivamento e exclusão controlada de ramificações** | Arquivar para ocultar sem perder dados; excluir definitivamente apenas com confirmação e verificação de dependências | ADR-043; armazenamento, recuperação e UX detalhada pendentes | Resolvida |
| P-43 | **RESOLVIDA — backups portáteis** | Exportar e importar pacotes portáteis de Jornadas, ramificações e dependências necessárias do Mundo; sem exigir sincronização em nuvem | ADR-044; conflitos na ADR-045, migração na ADR-046 e formato ZIP na ADR-047; procedimentos técnicos pendentes | Resolvida |
| P-44 | **RESOLVIDA — importação assistida de backups** | Detectar conflitos e oferecer cópia independente, reutilização segura de dependências compatíveis ou substituição explícita com validação; impedir sobrescrita silenciosa | ADR-045; migração entre versões tratada na ADR-046; identificação de conflitos, UX e formato pendentes | Resolvida |
| P-45 | **RESOLVIDA — migração controlada de backups entre versões** | Identificar versão, migrar dados quando viável, validar e solicitar confirmação explícita, preservando o backup original; falha segura sem alterações | ADR-046; ZIP definido na ADR-047; versões suportadas e procedimentos de migração pendentes | Resolvida |
| P-46 | **RESOLVIDA — ZIP estruturado e versionado** | Pacote com manifesto, dados de Jornada/Mundo/ramificações e anexos permitidos, sem segredos de API ou assets sem direitos de redistribuição | ADR-047; esquema interno, compressão, integridade e validações técnicas pendentes | Resolvida |\n| P-47 | **RESOLVIDA — autosaves por mudanças e eventos importantes** | Checkpoints após alterações persistentes de estado e acontecimentos canônicos relevantes; histórico de mensagens persistido separadamente dos checkpoints | ADR-048; gatilhos precisos, agrupamento, frequência e retenção quantitativa pendentes | Resolvida |
| P-48 | **RESOLVIDA — operações atômicas e recuperação transacional** | Alterações lógicas confirmadas integralmente ou descartadas; após falha, recuperar último estado transacional consistente sem depender dos checkpoints | ADR-049; SQLite escolhido na ADR-050; estratégia física e testes de recuperação pendentes | Resolvida |
| P-49 | **RESOLVIDA — SQLite como banco principal** | SQLite para estado, Mundos, Jornadas, eventos, salvamentos e ramificações; arquivos volumosos podem ficar externamente sob referências consistentes | ADR-050; esquema, índices, migrações e detalhes transacionais pendentes | Resolvida |
| P-50 | **RESOLVIDA — recuperação de memória híbrida** | SQLite canônico com consultas estruturadas, busca textual FTS5 e embeddings semânticos como índice auxiliar reconstruível | ADR-051; escolha local/remota na ADR-052; modelo/provedor, vetores e parâmetros pendentes | Resolvida |
| P-51 | **RESOLVIDA — embeddings locais ou remotos configuráveis** | Jogador escolhe modelo local ou API remota; índices semânticos reconstruíveis ao trocar de modelo; cânone sempre no SQLite | ADR-052; fallback definido na ADR-053; modelo, hardware, armazenamento vetorial e reindexação pendentes | Resolvida |
| P-52 | **RESOLVIDA — continuidade sem embeddings** | Jornada continua com fatos estruturados no SQLite e busca FTS5, informando limitação semântica temporária; retorno após validação do índice | ADR-053; atualização assíncrona definida na ADR-054; política de falhas e reindexação pendentes | Resolvida |
| P-53 | **RESOLVIDA — indexação semântica incremental assíncrona** | Confirmar primeiro os dados canônicos no SQLite; registrar trabalhos em fila e atualizar embeddings sem bloquear a Jornada; usar SQLite/FTS5 enquanto pendente | ADR-054; falhas e reintentos definidos na ADR-055; desenho da fila e vetores pendentes | Resolvida |
| P-54 | **RESOLVIDA — reintentos controlados na indexação** | Repetir falhas temporárias com intervalos progressivos e limite; preservar trabalhos não concluídos para reprocessamento manual, sem bloquear a Jornada | ADR-055; persistência da fila na ADR-056; limites numéricos, intervalos, prioridades e implementação pendentes | Resolvida |
| P-55 | **RESOLVIDA — fila persistente de embeddings** | Registrar trabalhos e estados da fila no SQLite, recuperar pendentes e interrompidos após reiniciar e validar versões antes de reprocessar | ADR-056; vetores no SQLite pela ADR-057; esquema da fila, concorrência e prioridades pendentes | Resolvida |
| P-56 | **RESOLVIDA — vetores semânticos no SQLite** | Persistir embeddings e seus metadados no SQLite, com mecanismo compatível de consulta vetorial, preservando seu caráter auxiliar e reconstruível | ADR-057; extensão/biblioteca, esquema, desempenho e política de reconstrução pendentes | Resolvida |
| P-57 | **RESOLVIDA — memória compartilhada do Mundo e isolada por continuidade** | Conhecimento geral do Mundo compartilhado e versionado; memórias próprias isoladas por Jornada e ramificação, sem vazamento de descobertas entre continuidades | ADR-058; herança definida na ADR-059; filtros e organização física dos índices pendentes | Resolvida |
| P-58 | **RESOLVIDA — passado de memória comum por referência** | Nova ramificação herda por referência memórias imutáveis válidas até o ponto de bifurcação; memórias posteriores são independentes e isoladas | ADR-059; permissões por entidade na ADR-060; referências físicas, índices e otimização pendentes | Resolvida |
| P-59 | **RESOLVIDA — conhecimento e segredos por entidade** | Registrar quem conhece cada fato; Narrador acessa segredos necessários de forma controlada, sem atribuir conhecimento ou revelar informações indevidamente | ADR-060; aquisições e categorias epistemológicas na ADR-061; permissões e filtros pendentes | Resolvida |
| P-60 | **RESOLVIDA — aquisição validada e classes de conhecimento** | Narrador propõe e motor valida conhecimento por entidade, distinguindo fatos confirmados, crenças, suspeitas, rumores e alegações sem confundir relato com verdade canônica | ADR-061; contradições tratadas na ADR-062; evidências e critérios específicos pendentes | Resolvida |
| P-61 | **RESOLVIDA — versões contraditórias e evolução de crenças** | Preservar versões conflitantes, fontes, evidências e histórico das crenças por personagem, sem atualizar automaticamente o cânone | ADR-062; critérios de evidência, confiança, atualização e confirmação pendentes | Resolvida |
| P-62 | **RESOLVIDA — comportamento contextual dos NPCs** | Narrador interpreta crenças, personalidade e objetivos, mas motor valida conhecimento, permissões e consequências persistentes | ADR-063; modelo de confiança definido na ADR-064, escala e verificações específicas pendentes | Resolvida |
| P-63 | **RESOLVIDA — confiança estruturada com interpretação qualitativa** | Motor mantém grau de confiança subjetivo por entidade e informação; Narrador interpreta qualitativamente, sem confundir convicção e verdade canônica | ADR-064; avaliação contextual e validação na ADR-065; escala e fórmulas pendentes | Resolvida |
| P-64 | **RESOLVIDA — avaliação contextual e validação de evidências** | Narrador propõe impacto das evidências; motor valida proveniência, conhecimento, coerência, permissões e alteração persistente da confiança | ADR-065; pesos, categorias, escala, limites e fórmulas pendentes | Resolvida |
| P-65 | **RESOLVIDA — autoridade sobre a verdade canônica** | Fatos canônicos somente por regras, acontecimentos registrados ou operações autorizadas e validadas; inferências e convicção subjetiva não criam verdade | ADR-066; revelações pela ADR-067; critérios operacionais e tipos de evidência pendentes | Resolvida |
| P-66 | **RESOLVIDA — transmissão estruturada de conhecimentos** | Narrador propõe eventos de revelação; motor valida fonte, destinatários, conteúdo, contexto, permissões e continuidade; comunicação não implica verdade | ADR-067; esquema, classificação de segredos, percepção e filtros pendentes | Resolvida |

## XIV. Critérios de aceite transversais

Estes são **critérios propostos** para orientar agentes e testes, não um compromisso de que já estejam implementados.

1. **Identidade:** o uso principal pode ocorrer por chat sem obrigar ação em mapa em toda Cena.
2. **Agência:** a IA não envia silenciosamente uma decisão voluntária em nome do protagonista.
3. **Separação de estado:** uma mensagem “você ganhou uma espada” não altera inventário sem operação validada.
4. **Consistência:** reiniciar o aplicativo conserva a compra e os fatos associados sem duplicar a transação.
5. **Regras:** a mesma rolagem de dados com os mesmos resultados e condições produz o mesmo resultado mecânico.
6. **Provedor:** mudar de LLM não modifica cálculos do motor.
7. **Cenas:** uma visita voluntária ao ferreiro pode abrir Cena sem disparo de evento aleatório.
8. **Cenas sem mapa:** Cena exclusivamente social, comercial ou investigativa pode terminar sem combate ou testes e não abre mapa localizado. Somente uma fase tática pode fazê-lo (ADR-005).
9. **Testes narrativos:** o motor não executa rolagem fora de situação tática sem confirmação prévia do jogador; rejeição/cancelamento não consome recursos nem produz resultado mecânico (ADR-006).
10. **Tático:** posições e dano observados pelo jogador correspondem ao estado oficial.
11. **Competências/Capacidades:** não há interface, compra, requisito ou efeito ativo dependente dessas mecânicas no escopo inicial.
12. **Wiki:** a regra exibida e o comportamento testado do motor possuem a mesma revisão identificável.
13. **Assets:** o build carrega sprites licenciados, mas o Git público não recebe pacotes que não possam ser redistribuídos.
14. **Falhas de IA:** timeout, queda de processo e cancelamento não deixam transações mecânicas pela metade.
14. **Memória:** um fato canônico recuperado não depende exclusivamente de regenerar um resumo pelo LLM.

## XV. Glossário

| Termo | Sentido no Henduran |
|---|---|
| **Jornada** | Continuidade de um personagem, objetivos, mundo e consequências, contendo diversas Cenas |
| **Ambição** | Objetivo central de longo prazo; mecânica adaptada do Astra [CONFIRMADO/ADAPTADO] |
| **Desejo** | Objetivo atual; mecânica adaptada do Astra [CONFIRMADO/ADAPTADO] |
| **Narrador IA** | Modelo orquestrado para descrever, interpretar NPCs e propor resoluções |
| **Fora de Cena** | Interação do jogador diretamente com o Narrador e exploração fora de situação localizada |
| **Cena Henduran** | Unidade narrativa contextualizada com chat próprio; pode ser apenas social |
| **Cena Tática (Astra)** | Resolução estruturada em rodadas/turnos, não necessariamente combate |
| **Motor de regras** | Componente determinístico que valida e resolve efeitos mecânicos da adaptação Astra |
| **Estado oficial** | Fatos, posições e recursos efetivamente persistidos e válidos no mundo |
| **Memória narrativa** | Resumos e fatos recuperáveis para contexto do Narrador, não substitutos do estado oficial |
| **Capacidades/Competências** | Mecânicas existentes no Astra, excluídas da implementação inicial do Henduran |
| **Wiki interna** | Referência das regras adaptadas efetivamente adotadas no Henduran |
| **Token-moeda** | Representação visual de personagem/criatura como ficha redonda em mapa |
| **LLM local** | Modelo executado no computador do jogador, por exemplo via llama.cpp com GGUF |
| **API externa** | Serviço remoto de modelo acessível por chave configurada pelo jogador |

## XVI. Registro de decisões e referências

### 1. Decisões confirmadas na conversa

| Código | Decisão | Estado |
|---|---|---|
| D-001 | Nome do novo produto: Henduran | [CONFIRMADO] |
| D-002 | Projeto reiniciado do zero; protótipo anterior não será base obrigatória | [CONFIRMADO] |
| D-003 | RPG solo procedural centrado no chat e Narrador IA | [CONFIRMADO] |
| D-004 | Jornada com Ambição e Desejo | [CONFIRMADO] |
| D-005 | Cenas com chats próprios; iniciadas voluntária ou contextualmente, não só por evento aleatório | [CONFIRMADO] |
| D-006 | Interação Fora de Cena diretamente com o Narrador | [CONFIRMADO] |
| D-007 | Exploração em mapa hexagonal; combate com grid e token-moeda | [CONFIRMADO] |
| D-008 | Regras derivadas do Astra com adaptações próprias e wiki interna | [CONFIRMADO] |
| D-009 | Competências e Capacidades ausentes na primeira versão | [CONFIRMADO] |
| D-010 | Referências a sessões, Ambição e Desejo serão adaptadas | [CONFIRMADO], soluções em aberto |
| D-011 | Desktop exclusivo; LLM local baixado pelo app e LLM online por API key | [CONFIRMADO] |
| D-012 | UI em pixel art com pack comprado | [CONFIRMADO] |
| D-013 | Codex/Claude Code farão a implementação, sem programação manual pretendida | [CONFIRMADO] |
| D-014 | Caliope é referência de integração e possível reaproveitamento parcial | [CONFIRMADO o interesse]; reuso exato [PENDENTE] |
| D-015 | Fonte de verdade mecânica do Henduran será sua versão adaptada, não atualização automática do Astra | [CONFIRMADO] |
| D-016 | Stack: Tauri + React + TypeScript + PixiJS + Python | [CONFIRMADO — ADR-001] |
| D-017 | Plataforma inicial: somente Windows | [CONFIRMADO — ADR-001] |
| D-018 | Motor Astra adaptado implementado progressivamente, preservando como objetivo o conjunto completo de regras aplicáveis, sem Competências e Capacidades inicialmente | [CONFIRMADO — ADR-002] |

| D-019 | NPCs e criaturas do Astra serão adaptados sem Competências/Capacidades, utilizando inicialmente o orçamento de criação de NPCs como referência de equilíbrio | [CONFIRMADO — ADR-003] |
| D-020 | Narrador IA autônomo na narrativa, com ferramentas validadas, autoridade mecânica do motor e decisões do jogador preservadas | [CONFIRMADO — ADR-004] |
| D-021 | Mapas localizados ficam restritos a situações táticas; Cenas narrativas funcionam pelo chat e o mapa-múndi hexagonal permanece independente | [CONFIRMADO — ADR-005] |
| D-022 | Cada teste fora de situações táticas requer confirmação prévia do jogador; rolagens não podem ocorrer antes da confirmação | [CONFIRMADO — ADR-006] |
| D-023 | Persistência híbrida: estado atual da Jornada e histórico de eventos relevantes | [CONFIRMADO — ADR-007] |
| D-024 | Memória híbrida do Narrador: fatos estruturados, resumos narrativos e busca semântica; estado oficial independente da memória recuperável | [CONFIRMADO — ADR-008] |
| D-025 | Correções pontuais de inconsistências e restauração de salvamentos anteriores, com continuidade consistente; sem autorização geral de desfazer eventos isolados | [CONFIRMADO — ADR-009] |
| D-026 | Marcos narrativos e acontecimentos significativos orientam a adaptação de regras por sessão; cada mecânica terá seus próprios gatilhos e limites, a definir | [CONFIRMADO — ADR-010] |
| D-027 | Alteração de Desejo condicionada a conclusão, abandono ou perda de relevância; Ambição condicionada a acontecimentos significativos, conclusão ou mudança genuína de motivações | [CONFIRMADO — ADR-011] |
| D-028 | Benefícios originais de Vontade por Ambição e Desejo mantidos inicialmente, vinculados a acontecimentos significativos; impedir duplicidade do mesmo progresso, avaliar limites adicionais em testes | [CONFIRMADO — ADR-012] |
| D-029 | Convicções/Pilares: preservar inicialmente os demais benefícios em acontecimentos significativos e com prevenção de duplicação; revogar rerrolagem gratuita por Convicção; demais limites a testar | [CONFIRMADO — ADR-013] |
| D-030 | XP concedido por marcos narrativos e conquistas significativas, mediante validação do motor e prevenção de duplicidades; valores exatos pendentes de balanceamento | [CONFIRMADO — ADR-014] |
| D-031 | Economia com moeda concreta e saldo persistente; preços inicialmente baseados no Valor abstrato dos equipamentos do Astra; equivalências e comércio detalhado ainda pendentes | [CONFIRMADO — ADR-015] |
| D-032 | Reaproveitar seletivamente componentes independentes do Caliope somente após auditoria técnica, de licença e permissões; reescrever os sistemas narrativos e mecânicos do Henduran | [CONFIRMADO — ADR-016] |
| D-033 | Biblioteca reutilizável React/TypeScript/CSS de UI pixel art, construída após inventário local automatizado dos assets Franuka, preservando originais e restrições de licença | [CONFIRMADO — ADR-017] |
| D-034 | Mundo híbrido: estrutura geográfica inicial e geração/detalhamento/expansão procedural persistente, com locais, personagens, acontecimentos e mudanças preservados | [CONFIRMADO — ADR-018] |
| D-035 | Mapa-múndi hexagonal em escala regional: cada hexágono representa uma área geográfica ampla com múltiplos pontos de interesse internos; tamanho/distância exatos pendentes | [CONFIRMADO — ADR-019] |
| D-036 | Nas situações táticas, mapa localizado predominante na interface e chat narrativo em painel secundário, ainda visível/acessível; Cenas narrativas seguem centradas no chat | [CONFIRMADO — ADR-020] |
| D-037 | Mundos independentes e reutilizáveis; criação manual, geração assistida por IA ou importação de wikis/documentos; Jornadas derivadas mantêm estados próprios | [CONFIRMADO — ADR-021] |
| D-038 | Jornada contínua com encerramento opcional: concluir Ambição encerra um arco narrativo, não obrigatoriamente a Jornada; jogador pode continuar com outra Ambição ou encerrá-la | [CONFIRMADO — ADR-022] |
| D-039 | Diário narrativo e geração de livro literário exportável, com capítulos e revisão assistida por IA; fidelidade aos fatos canônicos da Jornada; formatos e processo de geração pendentes | [CONFIRMADO — ADR-023] |
| D-040 | Mundos versionados; cada Jornada vinculada a versão identificável; atualizações opcionais e controladas com detecção de conflitos e preservação dos fatos canônicos | [CONFIRMADO — ADR-024] |
| D-041 | Importação assistida por IA com proposta estruturada, revisão e aprovação explícita do jogador antes de canonização, mantendo proveniência das fontes; novas versões seguem ADR-024 | [CONFIRMADO — ADR-025] |
| D-042 | Conflitos em atualizações de Mundo para Jornadas são mediados por IA com alternativas apresentadas ao jogador; nenhuma resolução é aplicada sem aprovação explícita, validação e preservação do cânone | [CONFIRMADO — ADR-026] |
| D-043 | Mortalidade progressiva: derrotas elegíveis acumuladas são permanentes; após esgotado o número de derrotas sobrevivíveis, a derrota seguinte causa morte definitiva e encerra a Jornada; limite exato pendente | [CONFIRMADO — ADR-027] |
| D-044 | Somente incapacitações mecânicas do protagonista em combate contam como derrotas para a mortalidade; outras formas de falha e derrota não incrementam o contador por si só | [CONFIRMADO — ADR-028] |
| D-045 | Consequências de incapacitação sobrevivida são propostas contextualmente pelo Narrador IA e passam pela validação do motor antes de alterar o estado persistente; penalidades específicas pendentes | [CONFIRMADO — ADR-029] |
| D-046 | Apenas solicitação explícita do jogador gera entradas literárias no diário; registro canônico automático é independente; detalhes editoriais e formatos de exportação pendentes | [CONFIRMADO — ADR-030] |
| D-047 | Primeira ou terceira pessoa selecionável pelo jogador; parâmetros de voz narrativa e consistência de perspectiva e tom entre capítulos e entradas do diário/livro, sem alterar o cânone | [CONFIRMADO — ADR-031] |
| D-048 | Editor literário com edição manual, seleção e reescrita de trechos por IA, melhorias sob demanda e aprovação de versões antes da incorporação, mantendo o texto separado do cânone | [CONFIRMADO — ADR-032] |
| D-049 | Exportação inicial do diário e do livro em Markdown, PDF e EPUB; diagramação, modelos editoriais, metadados, publicação e formatos adicionais ainda pendentes | [CONFIRMADO — ADR-033] |
| D-050 | Organização híbrida de capítulos: criação manual ou proposta por IA somente quando solicitada, com edição, reordenação, divisão, fusão, renomeação e aprovação do jogador; não altera o cânone | [CONFIRMADO — ADR-034] |
| D-051 | Livros exportados contam com modelos editoriais selecionáveis; PDF usa paginação, EPUB respeita fluxo refluível, Markdown mantém estrutura textual; sem editor completo de diagramação no escopo inicial | [CONFIRMADO — ADR-035] |
| D-052 | Sistema híbrido de capas: modelos predefinidos, importação de imagens e geração opcional por IA quando houver provedor configurado; publicação e detalhes técnicos de capa permanecem pendentes | [CONFIRMADO — ADR-036] |
| D-053 | Metadados editoriais básicos para diário e livro: título, subtítulo, autor, pseudônimo opcional, sinopse, data de exportação, nome da Jornada, nome do Mundo e idioma; apresentação e publicação pendentes à época da ADR-037 | [CONFIRMADO — ADR-037] |
| D-054 | Exportação literária local; publicação e compartilhamento externos por iniciativa do jogador; sem integrações diretas de publicação ou biblioteca pública própria no escopo inicial | [CONFIRMADO — ADR-038] |
| D-055 | Salvamento híbrido com autosaves após alterações relevantes e saves manuais identificáveis; restauração consistente de estado e memória de ponto anterior, sem desfazer seletivo; frequência e formato pendentes; retenção detalhada na ADR-040 | [CONFIRMADO — ADR-039] |
| D-056 | Retenção híbrida de autosaves: preservar checkpoints recentes e marcos importantes da Jornada, com descarte seletivo de outros autosaves; saves manuais independentes; quantidades e intervalos pendentes | [CONFIRMADO — ADR-040] |
| D-057 | Continuar de um salvamento anterior cria automaticamente nova ramificação independente, preservando a continuidade original; estado, histórico, memória e contador de derrotas não se misturam | [CONFIRMADO — ADR-041] |
| D-058 | Ramificações da Jornada gerenciadas em árvore visual de continuidades, com relações, pontos de divergência e progresso identificáveis e acesso à consulta/retomada | [CONFIRMADO — ADR-042] |
| D-059 | Ramificações podem ser arquivadas para ocultação não destrutiva ou excluídas definitivamente com confirmação explícita e proteção de continuidades dependentes | [CONFIRMADO — ADR-043] |
| D-060 | Exportação e importação de pacotes portáteis de backup, com Jornada, suas ramificações e dependências necessárias do Mundo para restauração consistente em outra instalação; formato e compatibilidade pendentes; conflitos definidos na ADR-045 | [CONFIRMADO — ADR-044] |
| D-061 | Importação assistida de backup com detecção de conflitos e opções de cópia independente, reutilização de dependências compatíveis ou substituição mediante confirmação explícita e validação; sem mescla ou sobrescrita silenciosa | [CONFIRMADO — ADR-045] |
| D-062 | Migração validada de backups de versões anteriores para o esquema atual, sujeita à confirmação explícita e à preservação integral do backup original; erro ou incompatibilidade não modifica os dados instalados | [CONFIRMADO — ADR-046] |
| D-063 | Backup portátil em ZIP estruturado e versionado, com manifesto, estado/histórico da Jornada, ramificações, dependências necessárias do Mundo e anexos permitidos; esquema interno e validações técnicas pendentes | [CONFIRMADO — ADR-047] |\n| D-064 | Autosaves após alterações persistentes de estado e acontecimentos canônicos relevantes; histórico de mensagens persistido independentemente de novos checkpoints; gatilhos e intervalos precisos pendentes | [CONFIRMADO — ADR-048] |
| D-065 | Operações persistentes atômicas: efeitos validados confirmados como conjunto ou descartados; recuperação automática do último estado transacional consistente, sem exigir checkpoint por operação; implementação no SQLite pendente | [CONFIRMADO — ADR-049] |
| D-066 | SQLite como banco local principal para dados estruturados e transacionais; arquivos volumosos podem ser externos, com referências consistentes; esquema, índices, migrações e transações pendentes | [CONFIRMADO — ADR-050] |
| D-067 | Recuperação de memória do Narrador por SQLite canônico, FTS5 e embeddings semânticos auxiliares reconstruíveis; sem duplicar fonte da verdade; implementação e parâmetros pendentes | [CONFIRMADO — ADR-051] |
| D-068 | Embeddings gerados por modelo local ou API remota configurável pelo jogador; troca de modelo requer índice auxiliar reconstruível sem alterar fatos canônicos; especificações de modelos, vetores e reindexação pendentes | [CONFIRMADO — ADR-052] |
| D-069 | Embeddings indisponíveis ou em reindexação não interrompem a Jornada: recuperação por SQLite estruturado e FTS5, com aviso da limitação ao jogador; índice semântico somente retorna após validação | [CONFIRMADO — ADR-053] |
| D-070 | Atualização incremental assíncrona de embeddings com persistência canônica prévia no SQLite; indexação em fila sem bloquear a Jornada, respeitando contexto e versões; reintentos na ADR-055 e desenho da fila e vetores pendentes | [CONFIRMADO — ADR-054] |
| D-071 | Falhas temporárias de embeddings geram tentativas limitadas com intervalos progressivos; trabalhos não concluídos ficam identificáveis para reprocessamento manual; limites, prioridades e implementação pendentes | [CONFIRMADO — ADR-055] |
| D-072 | Fila persistente de indexação semântica no SQLite; recuperação de trabalhos pendentes ou interrompidos após reinício com validação de versões canônicas, modelo e continuidade, sem sobrescrever índices recentes | [CONFIRMADO — ADR-056] |
| D-073 | Vetores de embeddings e metadados indexados no SQLite, com consultas vetoriais por mecanismo compatível; índices auxiliares reconstruíveis; extensão/biblioteca, esquema, desempenho e reconstrução técnica pendentes | [CONFIRMADO — ADR-057] |
| D-074 | Memória compartilhada e versionada do Mundo, combinada a memórias de Jornada e ramificação isoladas; recuperação respeita escopo da continuidade ativa; herança detalhada na ADR-059 | [CONFIRMADO — ADR-058] |
| D-075 | Ramificações herdam por referência o histórico imutável de memórias até o ponto restaurado; cada linha possui memórias posteriores isoladas; referências, filtros, permissões e índices pendentes | [CONFIRMADO — ADR-059] |
| D-076 | Conhecimento e segredos controlados por entidade: distinguir verdade canônica do que protagonista e NPCs sabem; acesso controlado do Narrador e revelações sujeitas a validação contextual; esquema e filtros pendentes | [CONFIRMADO — ADR-060] |
| D-077 | Aquisições e revelações de conhecimento propostas pelo Narrador e validadas pelo motor; registros distinguem fatos confirmados, crenças, suspeitas, rumores e alegações por entidade sem transformar automaticamente relatos em cânone | [CONFIRMADO — ADR-061] |
| D-078 | Informações contraditórias, fontes e evidências coexistem sem sobrescrita; histórico de crenças por entidade registra revisões sem reescrever passado ou alterar automaticamente a verdade canônica; critérios de evidência/confiança pendentes | [CONFIRMADO — ADR-062] |
| D-079 | Narrador interpreta contextual e autonomamente falas e ações de NPCs com base em crenças, personalidade, objetivos e contexto; motor valida conhecimento, permissões e todas as alterações persistentes, sem tratar crenças como cânone | [CONFIRMADO — ADR-063] |
| D-080 | Motor mantém medida estruturada de confiança subjetiva por entidade e informação; Narrador a interpreta qualitativamente sem torná-la verdade canônica; escala e regras de atualização pendentes | [CONFIRMADO — ADR-064] |
| D-081 | Narrador propõe impacto contextual de evidências nas crenças; motor valida proveniência, conhecimento, coerência, permissões e regras antes de atualizar transacionalmente confiança por entidade e continuidade; critérios numéricos pendentes | [CONFIRMADO — ADR-065] |
| D-082 | Verdade canônica estabelecida somente por regras, acontecimentos registrados e operações autorizadas e validadas pelo motor; relatos, inferências e confiança não a promovem automaticamente; revelações estruturadas na ADR-067 e confirmação operacional pendente | [CONFIRMADO — ADR-066] |
| D-083 | Transmissões de conhecimento por eventos estruturados propostos pelo Narrador e validados pelo motor; registrar fonte, destinatários, conteúdo e contexto, sem confundir comunicação com verdade canônica; esquema e percepção pendentes | [CONFIRMADO — ADR-067] |

### 2. Tecnologia selecionada

**[CONFIRMADO]** Tauri + React + TypeScript + PixiJS + Python, com Windows como plataforma única da fase inicial (`docs/decisoes/ADR-001-stack-desktop-windows.md`). Godot e MonoGame foram alternativas analisadas e não selecionadas. O motor de regras e os mecanismos de comunicação entre processos ainda dependem de projeto técnico específico.

### 3. Fontes consultadas

- [`astra-rules/Readme.md`](https://github.com/midrasil/astra-rules/blob/main/Readme.md) — identidade, escopo do sistema e índice.
- [`Regras/Mecânica Básica/Reserva de Dados.md`](https://github.com/midrasil/astra-rules/blob/main/Regras/Mec%C3%A2nica%20B%C3%A1sica/Reserva%20de%20Dados.md) — testes, sucessos e dificuldade.
- [`Regras/Personagens/Ambição e Desejo.md`](https://github.com/midrasil/astra-rules/blob/main/Regras/Personagens/Ambi%C3%A7%C3%A3o%20e%20Desejo.md) — motivações e benefícios por sessão.
- [`Regras/Personagens/Convicções e Pilares.md`](https://github.com/midrasil/astra-rules/blob/main/Regras/Personagens/Convic%C3%A7%C3%B5es%20e%20Pilares.md) — Fraturas e Pilares.
- `Regras/Personagens/{Atributos,Perícias,Vida,Vontade,Progressão}.md` — ficha, recursos e XP.
- `Criação de Personagem/{0,2,3}*.md` — criação e derivados.
- `Regras/Cenas e Conflitos/{A Cena,Cenas Táticas}.md` e `Ações/{Confrontar,Manobras,Aguardar}.md` — estrutura e ações táticas.
- `Regras/Movimento/Movimentação.md`; `Regras/Equipamentos/Equipamentos.md`; `Regras/Criaturas/Ficha de NPC.md`.
- [`CODED-Xavier/Caliope`](https://github.com/CODED-Xavier/Caliope) — documentação e inspeção parcial de módulos de LLM, memória, downloads e skills.
- Histórico de conversa do Henduran — decisões de produto e mudanças de escopo. As especificações antigas do Astra: Jornada são referências históricas; nenhum detalhe só presente nelas foi automaticamente promovido a requisito confirmado.

### 4. Controle de mudanças

- **v6.9:** encerramento da rodada de perguntas após P-66/ADR-067; P-67 mantida sem aprovação; consolidação de escopo, plano incremental e briefing de agentes adicionados, sem novas decisões de produto.\n- **v6.8:** P-66 resolvida; transmissões e revelações de conhecimentos registradas como eventos estruturados propostos pelo Narrador, validados pelo motor e vinculados a fontes, destinatários, conteúdo e contexto; esquema, segredos e percepção pendentes; ADR-067.
- **v6.7:** P-65 resolvida; fatos canônicos estabelecidos por regras, acontecimentos registrados e operações autorizadas e validadas pelo motor, sem conversão automática de hipóteses, evidências ou confiança subjetiva em verdade; critérios e revelações pendentes; ADR-066.
- **v6.6:** P-64 resolvida; Narrador avalia evidências contextualmente e propõe mudanças de confiança, validadas pelo motor segundo proveniência, conhecimento, coerência e permissões; pesos, categorias, escala e fórmulas pendentes; ADR-065.
- **v6.5:** P-63 resolvida; confiança subjetiva estruturada pelo motor e interpretação qualitativa pelo Narrador, sem transformar convicção em verdade canônica; escala, critérios de evidência, atualização e transições pendentes; ADR-064.
- **v6.4:** P-62 resolvida; NPCs interpretados contextualmente pelo Narrador com base em crenças, personalidade e objetivos, sujeitos à validação do motor para conhecimento, permissões e consequências persistentes; critérios específicos pendentes; ADR-063.
- **v6.3:** P-61 resolvida; versões contraditórias preservadas com fontes, evidências e histórico de evolução de crenças por personagem, sem alteração automática do cânone; critérios de confiança e confirmação pendentes; ADR-062.
- **v6.2:** P-60 resolvida; aquisição de conhecimentos proposta pelo Narrador e validada pelo motor, com distinção de fatos confirmados, crenças, suspeitas, rumores e alegações sem promover relatos a verdade canônica; evidências e critérios pendentes; ADR-061.
- **v6.1:** P-59 resolvida; conhecimento e segredos por entidade, distinguindo a verdade canônica dos fatos conhecidos pelo protagonista/NPCs e limitando acesso e revelações do Narrador; esquema de permissões, classificação e filtros pendentes; ADR-060.
- **v6.0:** P-58 resolvida; memórias anteriores ao ponto de divergência herdadas por referência como passado imutável compartilhado, com memórias posteriores isoladas por ramificação; referências, filtros, permissões e índices pendentes; ADR-059.
- **v5.9:** P-57 resolvida; memória geral compartilhada e versionada do Mundo, memória particular isolada por Jornada e ramificação, com escopo obrigatório de recuperação; filtros, herança e organização física de índices pendentes; ADR-058.
- **v5.8:** P-56 resolvida; vetores semânticos e metadados no SQLite com busca vetorial compatível; extensão/biblioteca, esquema, desempenho e reconstrução técnica pendentes; ADR-057.
- **v5.7:** P-55 resolvida; fila de embeddings persistida no SQLite, com recuperação de trabalhos pendentes/interrompidos após reinício e validação de versões; esquema, concorrência, prioridades e vetores pendentes; ADR-056.
- **v5.6:** P-54 resolvida; novas tentativas limitadas com intervalos progressivos e preservação de trabalhos de embeddings não concluídos para recuperação manual; contagens, intervalos, prioridades e implementação da fila pendentes; ADR-055.
- **v5.5:** P-53 resolvida; indexação incremental assíncrona após confirmação canônica no SQLite, por fila sem bloquear a Jornada, com recuperação via SQLite/FTS5 enquanto os vetores são atualizados; fila, prioridades, reintentos e armazenamento pendentes; ADR-054.
- **v5.4:** P-52 resolvida; Narrador continua via SQLite e FTS5 quando embeddings estiverem indisponíveis ou em reindexação, informa a limitação e retoma busca semântica apenas com índice válido; ADR-053.
- **v5.3:** P-51 resolvida; embeddings por modelo local ou API remota selecionáveis pelo jogador, com índice semântico reconstruível ao trocar de modelo e SQLite como fonte canônica; modelo, hardware, armazenamento e reindexação pendentes; ADR-052.
- **v5.2:** P-50 resolvida; recuperação de memória híbrida com SQLite canônico, FTS5 e embeddings semânticos como índices reconstruíveis; modelo, vetores, atualização e ranking pendentes; ADR-051.
- **v5.1:** P-49 resolvida; SQLite como armazenamento principal local com arquivos volumosos externos quando apropriado; esquema, índices, migrações e implementação transacional pendentes; ADR-050.
- **v5.0:** P-48 resolvida; operações atômicas e recuperação transacional após falhas sem depender de novos checkpoints; banco de dados e detalhes da implementação pendentes; ADR-049.
- **v4.9:** P-47 resolvida; autosaves após alterações persistentes de estado e acontecimentos canônicos importantes, separando persistência do histórico de mensagens da criação de checkpoints; gatilhos, intervalos e retenção quantitativa pendentes; ADR-048.\n- **v4.8:** P-46 resolvida; backups portáteis ZIP estruturados e versionados com manifesto, dados da Jornada/Mundo/ramificações e anexos permitidos; esquema, compressão e validações técnicas pendentes; ADR-047.
- **v4.7:** P-45 resolvida; migração controlada de backups legados com validação, confirmação e preservação do original, falha segura e procedimentos concretos pendentes; ADR-046.
- **v4.6:** P-44 resolvida; importação assistida de backups com detecção de conflitos, cópia independente, reutilização de dependências compatíveis e substituição explícita com verificações de segurança; formato e compatibilidade pendentes; ADR-045.
- **v4.5:** P-43 resolvida; backups portáteis exportáveis e importáveis preservando Jornadas, ramificações e dependências necessárias do Mundo, com formato, compatibilidade e conflitos de importação pendentes; ADR-044.
- **v4.4:** P-42 resolvida; arquivamento não destrutivo e exclusão controlada de ramificações com confirmação e proteção de dependências; implementação técnica de armazenamento e recuperação pendente; ADR-043.
- **v4.3:** P-41 resolvida; árvore visual de continuidades para identificar relações, pontos de divergência e progresso das ramificações, com consulta/retomada; armazenamento e exclusão pendentes; ADR-042.
- **v4.2:** P-40 resolvida; ramificação automática e independente ao continuar de um salvamento anterior, preservando a continuidade de origem; interface e armazenamento de ramificações pendentes; ADR-041.
- **v4.1:** P-39 resolvida; retenção híbrida de autosaves recentes e checkpoints de marcos importantes, sem descarte automático de saves manuais; quantidades e intervalos pendentes; ADR-040.
- **v4.0:** P-38 resolvida; autosaves após alterações relevantes, salvamentos manuais identificáveis e restauração integral de estados anteriores consistentes; frequência, retenção, formato e ramificação pendentes; ADR-039.
- **v3.9:** P-37 resolvida; exportação literária local e publicação/compartilhamento externos por iniciativa do jogador, sem integração de plataformas ou biblioteca pública própria no lançamento inicial; ADR-038.
- **v3.8:** P-36 resolvida; metadados editoriais básicos para diário/livro exportável (título, subtítulo, autor, pseudônimo opcional, sinopse, data de exportação, Jornada, Mundo e idioma); ADR-037.
- **v3.7:** P-35 resolvida; sistema híbrido de capas com modelos predefinidos, importação de imagens e geração opcional por IA mediante provedor configurado; publicação e detalhes técnicos de capa permanecem pendentes; ADR-036.
- **v3.6:** P-34 resolvida; modelos editoriais selecionáveis para livros exportados; conjunto de templates, capas, publicação e detalhes técnicos de exportação pendentes; ADR-035.
- **v3.5:** P-33 resolvida; capítulos manuais ou propostos por IA, com rearranjo, fusão, divisão, renomeação, edição e aprovação pelo jogador; ADR-034.
- **v3.4:** P-32 resolvida; exportação inicial de diário e livro em Markdown, PDF e EPUB, mantendo diagramação, modelos editoriais e publicação pendentes; ADR-033.
- **v3.3:** P-31 resolvida; editor literário com edição manual, reescrita de trechos por IA e aprovação de versões sem alterar fatos canônicos; ADR-032.
- **v3.2:** P-30 resolvida; perspectiva literária configurável entre primeira e terceira pessoa, parâmetros de voz definidos pelo jogador e consistência entre capítulos; ADR-031.
- **v3.1:** P-29 resolvida; entradas literárias do diário somente mediante solicitação do jogador, sem geração automática; histórico canônico permanece automático; ADR-030.
- **v3.0:** P-28 resolvida; consequências contextuais de incapacitações sobrevividas propostas pela IA, com validação mecânica determinística e sem penalidades fixas aprovadas; ADR-029.
- **v2.9:** P-27 resolvida; derrota elegível limitada à incapacitação mecânica do protagonista em combate, com validação pelo motor e sem incremento por falhas ou derrotas narrativas; limiar mecânico e quantidade exata pendentes; ADR-028.
- **v2.8:** P-26 resolvida; mortalidade progressiva com contador permanente de derrotas, morte definitiva e encerramento da Jornada na derrota seguinte ao esgotamento do limite; quantidade e critérios de derrota pendentes; ADR-027.
- **v2.7:** P-25 resolvida; conflitos de atualização entre versões de Mundo e Jornadas com alternativas assistidas por IA, aprovação explícita do jogador, validação e proteção do cânone; ADR-026.
- **v2.6:** P-24 resolvida; importação de wikis/documentos assistida por IA, revisão/aprovação do jogador antes de canonização e preservação da proveniência; ADR-025.
- **v2.5:** P-23 resolvida; Mundos versionados com atualizações opcionais e controladas nas Jornadas, detecção de conflitos e proteção do cânone; ADR-024.
- **v2.4:** P-20 resolvida; diário narrativo e geração de livro literário exportável com capítulos e revisão assistida por IA, sem modificar fatos canônicos; ADR-023.
- **v2.3:** P-19 resolvida; Jornada contínua com encerramento opcional; Ambição concluída fecha arco sem impor fim; ADR-022.
- **v2.2:** P-15 resolvida; Mundos reutilizáveis, criados manualmente, por IA ou importados de wikis/documentos, e Jornadas independentes; ADR-021.
- **v2.1:** P-13 resolvida; em situações táticas o mapa é predominante e o chat secundário; detalhes de layout dependem de protótipo; ADR-020.
- **v2.0:** P-12 teve sua escala conceitual aprovada: hexágonos regionais com múltiplos pontos de interesse internos, sem fixar dimensões; ADR-019.
- **v1.9:** P-11 resolvida; estratégia híbrida de geração do mundo, com estrutura geográfica inicial e detalhamento/expansão procedural persistentes; ADR-018.
- **v1.8:** P-18 resolvida; biblioteca reutilizável de UI pixel art baseada em inventário automatizado local do RPG UI Pack da Franuka; ADR-017.
- **v1.7:** P-17 resolvida; reaproveitamento seletivo de componentes independentes do Caliope, condicionado a auditoria de compatibilidade, licença e permissões; ADR-016.
- **v1.6:** P-14 resolvida; moeda concreta e preços inicialmente baseados no Valor do Astra aprovados; ADR-015. Unidade monetária e conversão permanecem pendentes.
- **v1.5:** concessão de XP por marcos narrativos e conquistas significativas aprovada, com valores pendentes de balanceamento; ADR-014.

- **v1.4:** adaptação de Convicções/Pilares aprovada com exceção: retirada do benefício gratuito de rerrolagem por Convicção; ADR-013.
- **v1.3:** efeitos de Vontade de Ambição e Desejo preservados inicialmente e vinculados a acontecimentos relevantes; proibição de recompensa duplicada; ADR-012.

- **v1.2:** P-03 resolvida; mudanças de Ambição/Desejo condicionadas à história; ADR-011. Recompensas e frequência ainda pendentes.
- **v1.1:** P-02 resolvida; marcos narrativos e acontecimentos significativos aprovados, sem sessão artificial universal; ADR-010.
- **v1.0:** P-09 integralmente resolvida em nível de política; retificações pontuais e restauração de salvamentos anteriores aprovadas; ADR-009.

- **v0.9:** P-10 resolvida; memória híbrida aprovada, estado oficial separado de lembranças recuperáveis; ADR-008.
- **v0.8:** P-09 parcialmente resolvida; persistência híbrida aprovada, sem decisão sobre desfazer/rollback; ADR-007.
- **v0.7:** P-07 resolvida; confirmação obrigatória antes de cada teste fora de situações táticas; ADR-006.
- **v0.6:** P-06 resolvida; mapas localizados exclusivos de situações táticas; ADR-005.

- **v0.5:** P-08 resolvida; autonomia controlada do Narrador aprovada; ADR-004. Matriz de permissões individuais continua proposta.
- **v0.4:** P-05 resolvida; orçamento de criação de NPCs confirmado como referência inicial; ADR-003.

- **v0.3:** P-04 resolvida; implementação progressiva do motor de regras aprovada; ADR-002.
- **v0.2:** aprovação explícita de P-01 e P-16; ADR-001; atualização da matriz de tecnologias e registro de decisões.
- **v0.1:** consolidação inicial; matriz de regras de origem/adaptação; separação de confirmado/proposto/pendente; definição de exemplo vertical social; registro de riscos e aceites.

> **Próxima etapa:** executar a preparação técnica e o vertical slice conforme `docs/planejamento/PLANO-DE-DESENVOLVIMENTO.md`, usando `CONSOLIDACAO-DE-ESCOPO.md` como triagem. **P-67 permanece sem decisão**; detalhes de percepção e filtros devem ser especificados na implementação, sem converter a alternativa recomendada em aprovação. Nenhuma proposta é autorização automática de escopo.
