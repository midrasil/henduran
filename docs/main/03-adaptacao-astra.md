# 03 — Adaptação do Astra para o Henduran

**Status:** política de adaptação e inventário inicial; **não** é a wiki final de regras.

## 1. Relação entre os projetos

As regras de [astra-rules](https://github.com/midrasil/astra-rules) são a **base de referência**. O Henduran manterá uma **versão própria, adaptada e documentada** das regras, que será a fonte de verdade para o jogo e para a wiki integrada (`rules/`). Mudanças no Astra original não devem alterar automaticamente uma Jornada existente.

A adaptação deve ser rastreável: para cada regra adaptada, registrar regra de origem, modificação, justificativa, comportamento esperado e testes relevantes.

## 2. Exclusões decididas

**Competências e Capacidades não serão implementadas na versão inicial.** Essa exclusão é uma decisão de escopo do Henduran. Não criar telas, progressões, custos ou mecânicas fictícias para compensá-las. Ao transpor textos originais, eliminar referências inoperantes e verificar o impacto local com testes, sem presumir que a regra-base foi alterada.

As demais áreas precisam ser revisadas antes de codificação.

## 3. Regras-base identificadas no repositório

| Área | Referência de origem | Estado no Henduran |
| --- | --- | --- |
| Reserva de dados d10, sucessos e dificuldades | `Regras/Mecânica Básica/Reserva de Dados.md` | Base a adaptar / validar |
| Atributos e Perícias | `Regras/Personagens/` | Escopo inicial previsto |
| Vida, Vontade e condições | `Regras/Personagens/`, `Regras/Condições/` | Escopo inicial previsto |
| Ambição, Desejo, Convicções e Pilares | `Regras/Personagens/` | Exigem adaptação temporal |
| XP e progressão | `Regras/Personagens/Progressão.md` | Exige adaptação dos marcos de concessão |
| Cenas Táticas, confrontos e movimento | `Regras/Cenas e Conflitos/`, `Regras/Movimento/` | Integrar ao chat e grid |
| Equipamentos e comércio | `Regras/Equipamentos/` | Implementar regras e persistência |
| NPCs e criaturas | `Regras/Criaturas/` | Adaptar ao mundo procedural |
| Competências e Capacidades | `Regras/Competências/`, `Regras/Capacidades/` | **Fora do escopo inicial** |

### Mecânica de dados — referência verificada

A regra-base usa uma reserva de **d10**; cada dado com valor de **6 a 10** gera um sucesso; cada **par de resultados 10** acrescenta um sucesso extra. A dificuldade indica quantos sucessos são necessários. Normalmente a reserva combina Atributo + Perícia. Estes valores são uma leitura da fonte, **não uma aprovação automática para imutabilidade em Henduran**.

### Criação de personagem — referência verificada

A fonte distribui seis Atributos entre Força, Agilidade, Vigor, Carisma, Determinação e Astúcia. A criação prevê também Perícias e uma etapa de Competências; esta última será removida no Henduran. Fórmulas derivadas da fonte incluem Vida = 3 + Vigor, Vontade = 3 + Determinação e Carga máxima = 5 + Força, sujeitas à validação da versão adaptada.

## 4. Sessões, Cenas e tempo de jogo

O Astra original usa 'sessão' em efeitos como recuperação de Vontade por Ambição/Desejo, uso de Convicções e concessão sugerida de XP. **Não trocar automaticamente 'sessão' por 'Cena'.** Uma Cena pode ser breve e puramente social; isso criaria incentivos e frequências diferentes.

O Henduran definirá gatilhos próprios com limites e critérios explícitos, integrados ao ritmo da Jornada. Até essa definição, esses efeitos são **pendências de design** e não devem ser implementados de maneira ad hoc.

O termo **Cena** também tem dois usos que exigem clareza:

- **Cena da Jornada:** unidade contextualizada de chat/narrativa, que pode conter interação social, exploração localizada ou outro acontecimento.
- **Resolução Tática:** modo de uma Cena no qual valem regras de rodada, turno, iniciativa, posição e movimentação quando necessários.

## 5. Wiki própria do Henduran

Os textos em `rules/` representarão **somente as regras efetivamente usadas** no jogo. A wiki deve oferecer navegação dentro do desktop e servir como fonte consultável pelo Narrador, sem dar ao modelo autoridade para aplicar resultados arbitrários.

A versão da regra aplicada a um salvamento deve ser identificável. A interface pode consultar uma mesma base textual; a aplicação das regras precisa corresponder aos comportamentos do motor e aos testes automatizados.

## 6. Processo de adaptação

Para cada área: (1) ler a regra original; (2) identificar dependências e referências a sessão, Competência ou Capacidade; (3) propor versão Henduran; (4) obter aprovação do autor; (5) publicar na wiki; (6) implementar no motor; (7) testar exemplos, limites e regressões.

## 7. Decisões ainda necessárias

- Gatilhos, limites e efeitos de Ambição e Desejo na Jornada.
- Concessão de XP sem sessões de mesa.
- Frequência e momento de benefícios ligados a Convicções e Pilares.
- Fluxo de confirmação de testes, especialmente fora de combate.
- Representação e regras do combate tático no aplicativo.
- Política para atualizar regras já utilizadas por salvamentos existentes.

**Importante:** `astra-rules` é material autoral protegido por licença própria. O Henduran deve preservar a atribuição apropriada e observar as permissões correspondentes ao incorporar textos e recursos.
