# ADR-074 — Fundação SQLite do app: migrações, backup e banco corrompido

- **Estado:** Proposta (implementada na branch `feat/persistencia-sqlite`; aguarda aprovação do responsável)
- **Data:** 2026-11-23
- **Complementa:** ADR-050 (SQLite como banco local principal), ADR-007 e ADR-009
- **Origem:** Execução do passo de persistência do `ESCOPO-MVP.md`

## Contexto

O ADR-050 escolheu o SQLite e deixou em aberto o esquema, as migrações, as transações e a recuperação diante de falhas. O serviço precisava de uma base segura antes de guardar mundo, personagem e Jornada, e substituiu o `settings.json` provisório por uma tabela. Este ADR registra as decisões da **fundação**; não decide o desenho dos dados de jogo.

## Decisão proposta

1. **Biblioteca padrão `sqlite3`**, sem ORM e sem dependências novas. SQL sempre parametrizado.
2. **Banco do app:** `<pasta de dados>/henduran.db`, em `%LOCALAPPDATA%\Henduran`, com as tabelas `settings` (preferências em JSON) e `app_meta`. **Sem tabelas de jogo ainda.**
3. **PRAGMAs:** `journal_mode=WAL`, `foreign_keys=ON`, `busy_timeout=5000`, `synchronous=NORMAL` e leituras em conexões `query_only`.
4. **Concorrência:** um único escritor serializado por lock, com `BEGIN IMMEDIATE`; leituras em um pequeno conjunto de conexões; fachada assíncrona por `asyncio.to_thread`.
5. **Migrações** em arquivos SQL numerados, **só para frente**, cada uma numa transação junto do seu registro em `schema_migrations`, com **checksum SHA-256**. Migração aplicada e depois alterada é erro. Comandos que controlam a transação são recusados.
6. **Proteção contra downgrade:** um banco de versão **mais nova** que a conhecida pelo app é recusado com erro claro, e o serviço sai com código 4.
7. **Backup antes de migrar:** só quando há migração pendente e o banco já tem tabelas. Usa a API de backup do SQLite, em `backups/henduran-v<versão>-<data>.db`, e guarda os **5 mais recentes**.
8. **Banco corrompido:** só os erros de corrupção reais disparam o recuo. O arquivo (com `-wal` e `-shm`) é **renomeado**, nunca apagado, para `henduran.db.corrompido-<data>`, e cria-se um banco novo, com aviso no log e em `/health` (`database.recovered`). Outros erros (bloqueio, permissão) deixam o arquivo intacto e o serviço sai com código 4. A checagem de arquivo existente usa conexão **somente leitura**, porque fechar uma conexão de escrita sobre um arquivo inválido faz o SQLite apagar o `-wal`.
9. **Importação única do `settings.json` legado** para a tabela, numa transação, com o arquivo renomeado para `.migrado` (nunca apagado).

## Consequências

- A API do serviço não mudou; `/health` ganhou `database: {schema_version, recovered}`.
- Com `synchronous=NORMAL`, uma queda de energia pode perder as últimas transações antes do checkpoint.
- Matar o processo à força deixa `-wal` e `-shm`; o reinício recupera os dados.
- O recuo automático para um banco novo descarta as preferências na prática, e os dados ficam no `.corrompido-*`. **Isso só é aceitável enquanto o banco guarda preferências.**

## Em aberto

- ~~Um banco por Jornada ou um banco único~~: **resolvido pelo ADR-075** (um banco por Jornada e um por Mundo, além do banco do app).
- ~~Política de corrupção e durabilidade com dados de jogo~~: **definida para os bancos de jogo no ADR-075** (`synchronous=FULL` e nunca recriar um banco de Jornada em silêncio). Para o banco do app vale o que está aqui.
- Transações canônicas de estado e eventos (ADR-049) e anexos fora do banco.
- Custo do `quick_check` a cada início com bancos grandes.
