# ADR-075 — Um banco por Jornada, um banco por Mundo e o banco do app

- **Estado:** Aprovada em 2026-11-23, com a opção de ter o banco do Mundo separado já no MVP
- **Data:** 2026-11-23
- **Origem:** Decisão explícita do responsável pelo Henduran
- **Complementa:** ADR-050 e ADR-074 (fundação SQLite); resolve o ponto em aberto "um banco por Jornada ou um banco único"
- **Relaciona-se com:** ADR-007, ADR-021, ADR-024, ADR-039, ADR-041, ADR-043, ADR-044, ADR-047, ADR-049, ADR-056, ADR-057, ADR-058, ADR-059

## Contexto

O ADR-050 escolheu o SQLite e o ADR-074 criou a fundação (o banco do app, com preferências). Antes de guardar mundo, personagem e Jornada, falta decidir **onde os dados de jogo moram**: tudo num banco único ou um arquivo por entidade. As decisões já aprovadas impõem estas exigências:

- Uma **Jornada tem estado próprio**; o que acontece nela não altera o Mundo-base nem outras Jornadas (ADR-021).
- **Ramificações** são independentes e **compartilham por referência o passado comum imutável**, sem cópia lógica de todos os registros (ADR-041, 042 e 059).
- **Excluir uma ramificação** exige verificar dependências e proteger as outras linhas (ADR-043).
- **Backup portátil** de uma Jornada leva as ramificações e as **versões do Mundo** de que ela depende, em um ZIP estruturado (ADR-044 e 047).
- Uma alteração validada é gravada **inteira ou nunca** (ADR-049).
- Mundos são **reutilizáveis e versionados**, e cada Jornada se vincula a uma versão (ADR-021 e 024). A memória do Mundo é compartilhada e versionada; a da Jornada é particular e isolada por ramificação (ADR-058).

## Alternativas

| | A. Banco único | B. Um banco por Jornada (e por Mundo) |
| --- | --- | --- |
| Backup ou exportação de uma Jornada | extrair linhas de dezenas de tabelas, com código específico e risco de omissão | **copiar um arquivo** (API de backup do SQLite) mais o Mundo usado |
| Excluir uma Jornada | muitos `DELETE` encadeados | **remover a pasta**, depois de confirmar |
| Corrupção | afeta todas as Jornadas e o catálogo | **fica restrita a uma Jornada**; as outras e o app seguem |
| Migração de esquema | tudo de uma vez, com backup do banco inteiro | **por arquivo, ao abrir**, com backup só daquele banco |
| Lista de Jornadas e cartão "Última Jornada" | uma consulta | abrir o resumo (`journey_meta`) de cada arquivo, ou da última |
| Operação atômica (ADR-049) | uma transação | uma transação **dentro do banco da Jornada**; o Mundo é só leitura |
| Tamanho e manutenção | um arquivo cresce com vetores de todas as Jornadas | cada arquivo é pequeno; `VACUUM` e índices por Jornada |
| Portabilidade (ADR-044) | ruim | **natural** |

## Decisão proposta

1. **Três tipos de banco**, em `%LOCALAPPDATA%\Henduran`:
   - **Banco do app** (`henduran.db`): preferências e metadados do app, como hoje (ADR-074).
   - **Um banco por Jornada**: `journeys\<id>\journey.db`, com uma pasta própria para anexos grandes (ADR-050) ao lado.
   - **Um banco por Mundo**: `worlds\<id>\world.db`, com as versões do Mundo.
2. **Identificadores** em UUID, usados nos nomes de pasta e de arquivo. Nomes de exibição ficam dentro dos bancos, para poderem mudar e conter qualquer caractere.
3. **A Jornada é uma árvore de continuidades dentro do mesmo arquivo.** Todas as ramificações moram no `journey.db`, com ligação à ramificação-pai e ao ponto de divergência, de modo que o **passado comum seja lido por referência** (ADR-059) e a exclusão de uma ramificação possa conferir dependências com chaves estrangeiras (ADR-043). **Rejeitada** a alternativa de um arquivo por ramificação, porque copiaria o passado comum e tornaria a verificação de dependências entre arquivos.
4. **O Mundo é somente leitura para a Jornada** (ADR-021). A Jornada guarda o par **(mundo, versão)** que usa. Ao jogar, o serviço abre o `journey.db` e **anexa o `world.db` em modo leitura**, para consultas conjuntas. Como só o banco da Jornada recebe escrita, a atomicidade do ADR-049 vale sem transação entre bancos. Incorporar uma versão nova do Mundo (ADR-024) é uma operação explícita, gravada numa transação do `journey.db`.
5. **O banco do app não guarda catálogo de Jornadas.** O sistema de arquivos é o catálogo; cada `journey.db` tem uma tabela `journey_meta` com nome, personagem, local, período do dia, data de criação e último salvamento. O app grava só o identificador da **última Jornada jogada** (para "Continuar" e para o céu do menu). Um cache do catálogo pode vir depois, se a lista ficar lenta, e será reconstruível a partir dos arquivos.
6. **Migrações por banco:** o motor do ADR-074 passa a aceitar **conjuntos de migrações separados** (`app`, `journey`, `world`). Um `journey.db` é migrado **ao ser aberto**, com backup só daquele arquivo (por Jornada, na pasta dela) e a recusa de bancos mais novos que o app. Backups ZIP de outra versão seguem o ADR-046 na importação.
7. **Durabilidade e corrupção nos bancos de jogo:**
   - `synchronous=FULL` no `journey.db` (uma gravação confirmada sobrevive a uma queda de energia), em vez do `NORMAL` do banco do app. Revisão do ponto em aberto do ADR-074.
   - **Nunca recriar silenciosamente** um banco de Jornada ou de Mundo. Se a abertura falhar por corrupção, a Jornada fica marcada como danificada, o arquivo é preservado e o app oferece restaurar do último backup ou salvamento. O recuo automático do ADR-074 vale **somente para o banco do app**.
8. **Uma Jornada aberta por vez**, com bloqueio do arquivo contra uma segunda instância do app.
9. **Backup ZIP** (ADR-047): o manifesto lista a Jornada, o esquema, e o Mundo na versão usada, com uma cópia do `world.db` (ou dos dados da versão) dentro do pacote. Ao importar numa instalação que já tenha o Mundo, a regra de conflitos é a do ADR-045.
10. **No MVP, o Mundo gerado também mora num `world.db` separado**, mesmo que seja privado de uma Jornada, para evitar migrar dados depois. A biblioteca de Mundos (ADR-021) reutiliza o mesmo formato.

## Consequências

- Exportar, importar, duplicar e excluir uma Jornada ficam operações sobre **uma pasta**, e a corrupção de uma Jornada não contamina as demais.
- O banco do app permanece pequeno e sem dados de jogo.
- Mais arquivos para gerenciar e para migrar, e a lista de Jornadas depende de abrir o resumo de cada arquivo.
- O código de migração precisa suportar vários conjuntos de migrações e vários arquivos.
- O `ATTACH` do Mundo em WAL dá atomicidade por banco, e não entre bancos. Isso é aceitável porque o Mundo é só leitura; **nunca** gravar nos dois bancos na mesma operação.
- Esta decisão **não define o esquema interno** (eventos, estado, memória, salvamentos): isso vem nos ADRs e migrações de cada funcionalidade.

## Em aberto

1. Política de retenção dos backups automáticos por Jornada (ADR-040).
2. Se a lista de Jornadas precisa de um cache de catálogo no banco do app.
3. Estratégia para anexos grandes e a consistência entre arquivos e banco (ADR-050).
4. Detalhe do `ATTACH` do Mundo com FTS5 e vetores (ADR-056 e 057), a validar na prova de conceito da memória.
