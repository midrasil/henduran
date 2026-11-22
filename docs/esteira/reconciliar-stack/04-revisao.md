# 04 — Revisão — `reconciliar-stack`

## Rodada 1 — 2026-11-22

**Veredito:** MUDANÇAS NECESSÁRIAS

Escopo revisado: diff não commitado da branch `docs/reconciliar-stack` (9 arquivos), confrontado com `docs/main/decisoes/ADR-001-stack-desktop-windows.md`, ADR-016, ADR-049, ADR-050 e `docs/main/design/HENDURAN-GDD.md`. Não há `01`–`03` nesta pasta; a rota registrada no jornal (orquestrador escreve → Revisor) justifica isso.

### Bloqueantes

1. **`docs/main/04-arquitetura.md:3` cria uma contradição nova com o ADR-050.** O status diz que "permanecem propostos/em aberto [...] e demais itens listados como fora do escopo do ADR-001". O ADR-001 lista "escolha de banco de dados" entre os itens fora do seu escopo, mas o ADR-050 (Aprovada) já escolheu o SQLite. Do jeito que está escrito, o banco fica "em aberto", ou seja, a reconciliação reduz o que já foi aprovado.
   *Correção:* trocar a remissão genérica por uma lista explícita: bibliotecas de gerenciamento de modelos, suporte mínimo de hardware e atualização. Acrescentar "banco de dados: SQLite (ADR-050); esquema e transações em aberto".

2. **`docs/main/design/HENDURAN-GDD.md:449` ainda contradiz o ADR-001.** O trecho é "[CONFIRMADO] [...] Nenhuma decisão obriga React, WebView2, Godot ou MonoGame". O ADR-001 obriga React, e as linhas 516 e 929 do próprio GDD dizem o contrário. É exatamente o tipo de contradição que esta tarefa deveria eliminar, e o GDD tem prioridade 1 entre as fontes.
   *Correção (escolher uma e registrar):* (a) ajustar a frase para "o uso de um tileset não exige um motor gráfico específico; a stack é a do ADR-001", sem mudar mais nada; ou (b) se mexer no GDD exigir aprovação do autor, não editar e, em vez disso, listar o conflito no backlog e no handoff como pendente. O AGENTS.md pede que conflitos sejam reportados. Hoje o conflito não foi corrigido nem registrado.

### Sugestões (não bloqueantes)

1. **Lista de itens "em aberto" inconsistente entre os documentos.**
   - AGENTS.md:29 omite "bibliotecas de gerenciamento de modelos", que o ADR-001 deixa em aberto, e também llama.cpp/GGUF.
   - O handoff inclui llama.cpp/GGUF.
   - O 04 omite hardware e atualização de forma explícita.

   Convém usar uma lista única e igual nos três, ou fazer AGENTS e handoff remeterem ao 04.
2. **"A prova de conceito [...] fecha os pontos em aberto" promete demais** (04:67, handoff:15, jornal:20). Hardware mínimo e atualização não são resolvidos pela PoC descrita. O próprio 04:69 já limita a motor, protocolo e empacotamento, e vale usar esse mesmo recorte nos outros pontos.
3. **`ADR-049:28`** diz "SQLite permanece candidato, não decisão", o que foi superado pelo ADR-050. Os ADRs são registros e não devem ser reescritos, mas cabe uma nota "superado por ADR-050" ou um item no backlog.
4. **GDD:516 e GDD:929** apontam para `docs/decisoes/ADR-001-...`, mas o caminho real é `docs/main/decisoes/`. O link está quebrado. Dá para incluir junto com o item do backlog sobre os links do README.
5. **Pendência perdida.** O handoff anterior registrava "Frames e duração dos seis GIFs não foram extraídos". Ela saiu do handoff e não existe no backlog, que é a lista autoritativa. Convém acrescentá-la ao backlog.
6. **Handoff:21, "o catálogo HTML Franuka está parcial no cache".** A frase é ambígua e dá a entender que o catálogo do repositório está incompleto. O jornal esclarece que se refere ao cache do graphify. Vale usar a mesma redação.
7. **Jornal sem validação.** A entrada do jornal ainda não traz o resultado da revisão, e o AGENTS.md pede validações. Atualizar a entrada após a aprovação.
8. **04:17, "Serviço de IA: Python, aproveitando seletivamente [...] Caliope".** Está na lista "Aprovada (ADR-001)", mas o reaproveitamento do Caliope vem do ADR-016 e depende de auditoria. Sugiro citar o ADR-016 nesse ponto.

### Itens conferidos sem problema

- O AGENTS.md não amplia o ADR-001: só Windows, scaffolding/PoC com instrução explícita e motor/protocolo/empacotamento em aberto.
- A frase sobre Godot/MonoGame no 04 está coerente com o ADR-001 ("não selecionadas; referência até nova decisão formal").
- O aceite técnico do 04 §7 cobre o aceite do ADR-001: instalação sem Python de desenvolvimento, streaming e encerramento limpo (este último em §6).
- O 06-plano-inicial e os três docs de UI/UX estão coerentes, e o 02-design-system separa corretamente o que foi CONFIRMADO (ADR-001) do que é PROPOSTO (DOM, tokens, grade).
- Backlog, handoff e jornal concordam entre si: o próximo passo recomendado é o primeiro item do backlog, marcado com ⭐, e o item de PoC está condicionado a instrução explícita.
- Os registros históricos em `docs/esteira/mapeamento-ui-ux/` não foram alterados.
- Nenhuma decisão de produto nova foi introduzida. A reordenação do backlog é priorização e não regra.

### Pontos positivos

- A separação "Aprovada / Proposto–em aberto" no 04 está clara e fácil de verificar contra o ADR.
- A regra de que a PoC valida, mas não é pré-condição da aprovação, está explícita e coerente com o ADR-001 e com o GDD:524.
- O diff é mínimo e não sai do escopo.

## Rodada 2 — 2026-11-22

**Veredito:** APROVADO

Escopo: diff não commitado da branch `docs/reconciliar-stack` (10 arquivos, agora com o GDD), conferido contra o ADR-001 (limites da decisão), o ADR-049 e o ADR-050. Busquei `candidat`, `não está fechada`, `não está consolidada` e `fecha os pontos` em `docs/`, `AGENTS.md` e `README.md`, fora de `docs/esteira/`.

### Bloqueantes da Rodada 1

1. **Resolvido.** `04-arquitetura.md:3` agora lista explicitamente os 7 itens em aberto: llama.cpp/GGUF, motor, protocolo, empacotamento, bibliotecas de modelos, hardware e atualização. Também registra "SQLite já aprovado no ADR-050; esquema e transações seguem em aberto". Os itens batem com os limites do ADR-001, e o banco aparece corretamente como decidido.
2. **Resolvido.** `HENDURAN-GDD.md:449` remete à stack do ADR-001 e mantém a ressalva sobre o tileset. Não sobra contradição com as linhas 516 e 929, cujos links agora apontam para `docs/main/decisoes/`, caminho que existe.

### Novos bloqueantes

Nenhum.

### Resultado do grep

- Nenhuma ocorrência de "stack candidata", "não está fechada" ou "não está consolidada" ficou fora de `docs/esteira/`.
- As ocorrências restantes de `candidat` são de outros assuntos: componentes Caliope, sequência do ADR-002, Cena candidata, regras Astra, 9-slice. A exceção é `ADR-049:28` (SQLite), que já está registrado no backlog (linha 14) e no handoff (linha 28) como superado pelo ADR-050.
- As menções em `jornal.md:11/19` e `handoff.md:7` são históricas ou descritivas, então estão corretas.

### Sugestões (não bloqueantes)

1. **`docs/ui-ux/06-guia-implementacao.md:5`, "valida e fecha os pontos em aberto".** É a mesma promessa exagerada da sugestão 2 da Rodada 1, só que num arquivo que não estava listado. A PoC não fecha hardware nem atualização. Sugiro usar o recorte do 04: "valida a aprovação e resolve motor, protocolo e empacotamento".
2. **`README.md:25`, "[Arquitetura proposta](docs/04-arquitetura.md)".** O rótulo ficou desatualizado e o link está quebrado, porque o caminho real é `docs/main/`. Cabe no item já existente do backlog sobre os links do README, mas vale anotar lá que o rótulo também precisa mudar.
3. **`docs/main/planejamento/BRIEFING-PARA-AGENTES.md:14`** aponta para `docs/decisoes/`, que é o mesmo caminho quebrado já corrigido no GDD. O problema já existia antes da tarefa. Sugiro incluí-lo no mesmo item do backlog.
4. **`jornal.md:20`.** A lista de itens em aberto omite bibliotecas de modelos e llama.cpp/GGUF. O jornal é resumo, então não é grave, mas daria para remeter ao 04. Lembrete: acrescentar ao jornal o resultado da revisão antes do fechamento, como já apontado na sugestão 7 da Rodada 1.

### Pontos positivos

- AGENTS.md, 04 e handoff passaram a ter a mesma lista de itens em aberto, e AGENTS e handoff remetem ao 04 como fonte.
- Os ADRs, registros históricos, não foram reescritos. A superação do ADR-049 ficou rastreada no backlog.
- A pendência dos GIFs foi recuperada no backlog.
