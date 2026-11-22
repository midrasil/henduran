# Henduran — Plano incremental de desenvolvimento

**Versão:** 1.0 — 2026-11-22  
**Status:** proposta operacional derivada do GDD; nenhuma estimativa de prazo ou promessa de conclusão automática.  
**Meta inicial:** validar a experiência central de uma Jornada conduzida por IA, com motor determinístico e persistência consistente; depois expandir exploração e combate.

## Diretrizes para todos os marcos

- Consultar ADRs e fonte Astra antes de implementar regras. Não inferir números não especificados.
- Uma resposta da IA **não** altera o estado por si; somente comandos validados pelo motor podem fazê-lo.
- Manter Windows como plataforma-alvo de instalação e teste.
- Registrar diferenças entre **confirmado / adaptado / proposto / pendente**.
- Testes automáticos e demonstração reproduzível em cada marco; preservar saves em migrações.
- Licenças de código e sprites precisam ser verificadas antes de qualquer cópia/publicação.

## M0 — Auditoria, contratos e esqueleto

**Construir:** inventário dos repositórios e licenças; projeto Tauri + React + TS + PixiJS + sidecar Python; convenções de módulos; contratos mínimos de mensagens IA/motor, estado e eventos; setup de testes e empacotamento.

**Aceite:** app abre no Windows; os processos se comunicam por bridge com tratamento de falhas; arquivo `.env`/segredos não entram em artefatos; decisões confirmadas referenciadas no repositório.

**Não precisa:** mapa, combate ou memória vetorial completos.

## M1 — Regras Astra mínimas e persistência segura

**Construir:** criação/carregamento de personagem e Jornada; atributos, perícias, d10 e recursos estritamente necessários ao slice; SQLite; registro de eventos e transações atômicas; estado restaurável; saves mínimos.

**Aceite:** testes de regras reproduzíveis; operações inválidas não persistem; reinício preserva personagem/recursos; rolagem fora do tático depende de confirmação do jogador.

**Dependência:** mapear trechos reais da wiki Astra para cada regra usada.

## M2 — Narrador IA + ciclo de Cena

**Construir:** chat com streaming e cancelamento; adaptação de provedor local e remoto quando disponíveis; carregamento do contexto canônico; Cena social e fluxo Fora de Cena ↔ Cena; ferramentas autorizadas para o Narrador.

**Aceite:** diálogo com NPC; Narrador tenta registrar evento mas só o motor valida; personagem pode rejeitar teste fora do tático; cena encerra com efeitos persistidos; provedor de IA não muda resultados mecânicos determinados pelo motor.

## M3 — Vertical slice social integrado

**Cenário de teste:** protagonista entra em uma cena com ferreiro, conversa, recebe informação, compra um item, realiza um teste confirmado, deixa a cena e reinicia a aplicação.

**Aceite:** dinheiro, inventário e estoque coerentes após compra; estado e histórico compatíveis; nenhuma alegação de NPC altera cânone automaticamente; falha simulada no meio da compra não confirma efeitos parciais; histórico de chat persistido independentemente de checkpoint.

**Entrega do marco:** pequeno vídeo ou roteiro de reprodução manual e testes automatizados relevantes.

## M4 — Memória operacional e continuidade

**Construir:** fatos canônicos e resumos, recuperação estruturada/FTS5; conhecimento por entidade; perfis e índice de embeddings (local/remoto) sob demanda; fila persistente; fallback de busca; saves manuais, autosaves e ramificação básica.

**Aceite:** NPC lembra evento registrado; ramificação nova não acessa informação posterior de outra; falha na API de embeddings não bloqueia jogo; reindexação não altera cânone; recuperação após reinício da fila.

**Fatiamento:** o protótipo do slice pode começar apenas com fatos e FTS5; os embeddings são integração posterior dentro deste marco.

## M5 — Mundo, exploração hexagonal e cenas táticas

**Construir:** biblioteca inicial de Mundos; geração e expansão persistente em escala regional; mapa-múndi hexagonal, pontos de interesse e deslocamento; mapa localizado PixiJS com tokens; transições de chat para interface tática.

**Aceite:** explorar, salvar e retomar região persistente; alternar Cena narrativa e tática sem perder estado; tokens e mapa predominam em situação tática; um POI gerado mantém identidade após reinício.

**Observação:** valores exatos de deslocamento/visibilidade regional não estão aprovados.

## M6 — Confronto Astra e NPCs

**Construir:** iniciativa, ações, movimento, ataques, dano e condições relevantes segundo a adaptação Astra; NPCs e criaturas selecionados; sobrevivência à derrota conforme decisões já aprovadas; testes de equilíbrio.

**Aceite:** confronto reproduzível; motor valida turnos, custo e dano; derrota elegível contabilizada somente por incapacitação mecânica em combate (ADR-028); consequências de derrota validadas; nenhum uso inadvertido de Competências/Capacidades.

**Observação:** limiar numérico de mortalidade e parâmetros de balanceamento seguem em aberto.

## M7 — Continuidade avançada e autoria literária

**Construir:** árvore de ramificações, arquivamento/exclusão controlada, backups ZIP e migração, Mundos versionados, importação assistida; geração de diário sob demanda, editor e exportação de livros Markdown/PDF/EPUB.

**Aceite:** restaurar e ramificar sem misturar estados; importar backup sem sobrescrever silenciosamente Jornada existente; exportar livro sem alterar fatos canônicos; arquivar ramificação sem perda.

**Sequenciamento:** dividir em entregas menores quando houver dependências do MVP.

## M8 — Estabilização para distribuição

**Construir:** integração dos assets Franuka licenciados, acessibilidade, empacotamento Windows, testes de migração e falhas, segurança local, benchmarks de modelos e proteção de credenciais; ajustes de UX.

**Aceite:** instalação limpa; testes básicos sem internet nas funções locais suportadas; recuperação coerente de uma queda; licenças conferidas; pacote de distribuição sem assets/código de terceiros não autorizados.

## Primeira tarefa concreta para o agente

**Auditar e mapear antes de criar novas regras.** Relatar árvore dos projetos, tecnologias já presentes, artefatos licenciados acessíveis, conflitos com ADRs e um plano de PRs pequenas para M0-M3. Em seguida implementar o esqueleto M0 e um teste ponta a ponta de transação sem pedir decisão sobre cada detalhe de engenharia.

## Regras para bloquear/desbloquear o avanço

- **Pode avançar sem perguntar:** decisões de engenharia reversíveis, esquema/índices, bibliotecas compatíveis, prioridades de implementação, testes e estrutura interna.
- **Deve consultar:** mudanças de gameplay relevantes não aprovadas, incompatibilidade de licenças, contradição material nas ADRs, risco de perda irreversível ou mudança no produto.
- **Deve registrar como pendente:** limite de derrotas, economia exata, escalas de confiança e evidência, critérios detalhados de percepção, valores de testes/recompensas ainda sem fonte aprovada.
