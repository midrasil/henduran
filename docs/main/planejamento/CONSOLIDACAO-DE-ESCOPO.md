# Henduran — Consolidação do escopo e triagem de pendências

**Versão:** 1.0 — 2026-11-22  
**Base documental:** GDD v6.8 e ADR-001 a ADR-067  
**Natureza:** documento de triagem; não cria ou revoga decisões técnicas sem aprovação do autor.

## 1. Encerramento

- O planejamento começou com 22 perguntas críticas e evoluiu até **P-66 aprovada**.
- **ADR-001 até ADR-067** constituem a base de decisões confirmadas. A contagem de ADRs não deve ser confundida com a numeração das perguntas.
- **P-67 sobre percepção de revelações foi apenas apresentada**, sem resposta do autor. Portanto, nenhuma das opções A/B/C é requisito.
- Encerra-se o questionário sequencial. Novas consultas ao autor devem ser raras e restritas a bloqueios ou mudanças de produto relevantes.

## 2. Requisitos já confirmados — síntese por subsistema

| Subsistema | Base aprovada | Consequência para a implementação |
|---|---|---|
| Plataforma | ADR-001 | Windows desktop inicial; Tauri, React, TypeScript, PixiJS e Python |
| Regras | ADR-002, 003, 006, 010-014 | Adaptar Astra progressivamente; sem Competências/Capacidades no primeiro escopo; testes fora de tático exigem confirmação prévia; marcos narrativos específicos |
| Narrador | ADR-004, 008, 063, 065-067 | IA narra e propõe; motor autoriza alterações; crenças/evidências/comunicações não são automaticamente fatos |
| Experiência | ADR-005, 018-023 | Chat nas cenas narrativas, mapas localizados nas táticas, mapa-múndi hexagonal separado; Jornadas em Mundos independentes e contínuas |
| Persistência | ADR-007, 009, 039-050 | Estado + histórico, autosaves/manuais, ramificações e backups ZIP; transações atômicas; SQLite principal |
| Memória | ADR-008, 051-062 | Fatos canônicos SQLite, FTS5, embeddings opcionais local/remoto, indexação assíncrona no SQLite; Memória do Mundo versionada e conhecimento por continuidade/entidade |
| UI e arte | ADR-017, 020 | Biblioteca pixel art reutilizável; mapa predominante em situações táticas |
| Livros e diário | ADR-023, 030-038 | Diário sob demanda e livro com editor, capas e exportação Markdown/PDF/EPUB; sem plataforma interna de publicação |
| Arquivamento e distribuição | ADR-041-047 | Árvore de continuidades, arquivamento/exclusão controlada e backups portáteis versionados |

**Nota:** esta tabela resume decisões; as ADRs e o GDD integral prevalecem em caso de dúvida. **Regras exatas da wiki Astra ainda precisam ser consultadas e adaptadas**, não inferidas a partir desta síntese.

## 3. Bloqueios reais para começar a codificar

Os pontos abaixo são **tarefas de preparação**, não necessariamente novas perguntas ao autor.

1. **Inventário do repositório e assets:** inspecionar estado real de `midrasil/henduran`, wiki `midrasil/astra-rules`, código de referência Caliope e pacote Franuka; verificar licença e fronteiras de redistribuição. O GDD não comprova acesso atual aos arquivos.
2. **Matriz de regras para o slice:** ler a fonte Astra dos testes, criação, Vida/Vontade e operações básicas; mapear o que será usado, adaptado ou adiado. Não inventar números ausentes.
3. **Contrato IA ↔ motor:** definir schema de comandos, validação, idempotência, erros e quem pode atualizar cada entidade. Testar que uma resposta textual da IA não altera estado por si.
4. **Base técnica executável:** protótipo Tauri/React/TS/Python, bridge segura e SQLite com transações/recuperação; validar empacotamento em Windows.
5. **Contrato mínimo de Jornada e Cena:** modelo de estado, eventos canônicos e persistência suficiente para atravessar reinicializações.

**Escalonar ao autor somente** caso a fonte das regras seja ambígua a ponto de mudar a experiência do jogador, falte autorização/licença, haja conflito entre ADRs ou uma escolha altere substancialmente o produto aprovado.

## 4. Detalhes delegáveis aos agentes

Estes itens podem ser decididos por engenharia, com proposta curta, testes e registro no repositório, sem criar uma nova pergunta crítica para cada item:

- Tabelas, índices, migrações e WAL/estratégia transacional do SQLite; transações de arquivos externos.
- Implementação do FTS5, biblioteca de consulta vetorial compatível, metadados, dimensões e mecanismo de reindexação.
- Estrutura da fila de embeddings, concorrência, reintentos, pausas e critérios para trabalhos obsoletos.
- Manifesto ZIP, validação de arquivos, segurança na extração, checksums, estrutura de backup e migradores.
- Layout da árvore de ramificações, identificadores técnicos, ícones, filtros e organização da UI.
- Testes automatizados, logs, instrumentação, tratamento de falhas e critérios de desempenho.
- Regras precisas de percepção indireta e transmissão de informações **somente como proposta de implementação**: P-67 não foi aprovada; não presumir testes automáticos fora do tático.

**Atenção:** alguns parâmetros de gameplay *não são detalhes puramente técnicos* (por exemplo: limite de derrotas, conversão de economia, recompensa de Vontade, escalas relevantes ou alterações substanciais no combate). Podem ser prototipados para teste, mas sua adoção como regra definitiva deve ser distinguida de decisão previamente aprovada.

## 5. Não implementar automaticamente

- Qualquer item marcado `[PROPOSTO]`, `[PENDENTE]` ou questão sem resposta como se estivesse aprovado.
- Competências e Capacidades no escopo inicial.
- Publicação social integrada ou nuvem compulsória para saves.
- Mudanças no cânone vindas diretamente de texto livre do Narrador.
- Exposição de chaves de API e redistribuição não autorizada dos assets Franuka.
- Mecânicas de sessão artificial universal, ou rolagens fora do tático sem confirmação do jogador.

## 6. Governança daqui em diante

Cada marco deve produzir código executável, testes, breve registro das decisões locais e demonstração do fluxo. Quando uma dúvida impedir o avanço, encaminhar **uma decisão agrupada, com alternativas e impacto concreto**, em vez de reabrir uma lista indefinida de perguntas.
