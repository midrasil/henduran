# Instruções para agentes de desenvolvimento — Henduran

Leia este arquivo antes de implementar, alterar ou sugerir arquitetura.

## Objetivo

Henduran é um RPG solo procedural **centrado em chat e Narrador IA**, com mundo persistente e sistema de regras **próprio, adaptado do Astra**. A aplicação é desktop. Mapas hexagonais, combate em grid e tokens em moeda são funcionalidades auxiliares.

## Fontes de referência, por prioridade

1. Decisões aprovadas do projeto e documentação dentro de `docs/`.
2. Wiki própria de regras em `rules/` (após aprovação de cada seção adaptada).
3. Código e testes implementados, quando coerentes com 1–2.
4. `https://github.com/midrasil/astra-rules` como **referência de origem**, não regra do Henduran sem adaptação.
5. `https://github.com/CODED-Xavier/Caliope` apenas para avaliação de componentes de IA, conforme autorização/licença.

Conflitos entre fontes devem ser **reportados**, não resolvidos por adivinhação.

## Regras obrigatórias

- **Não implementar Competências ou Capacidades** na primeira fase.
- Não inventar mecânicas, valores, gatilhos de XP, recuperação ou limitações não aprovados.
- **Não substituir automaticamente o termo 'sessão' por 'Cena'** nas regras do Astra; efeitos temporais do Henduran aguardam adaptação aprovada.
- A IA propõe ações; **o motor valida e aplica** resultados mecânicos e estado persistente.
- Uma Cena pode iniciar por iniciativa do jogador, de NPCs, de consequência anterior ou de evento procedural. Não presumir que toda Cena é combate ou evento aleatório.
- Toda Cena tem chat contextualizado; mapa localizado e grid são opcionais, segundo a necessidade narrativa ou tática.
- Fora de Cena é diálogo direto com o Narrador e exploração, não uma fala automática do personagem nem uma pausa obrigatória do mundo.
- **A wiki interna `rules/` será a referência do Henduran** quando existir; não publicar cópias indiscriminadas da wiki Astra.
- A **stack não está fechada**. `docs/04-arquitetura.md` é proposta; não iniciar migração ou scaffolding significativo sem instrução explícita.
- Não copiar código do Caliope sem verificar licença/autorização, compatibilidade e fronteiras dos módulos.
- Não incluir assets comprados, segredos ou chaves de API em commits públicos sem validar permissão e segurança.

## Método de trabalho

1. Ler documentos relevantes e inspecionar o estado real do projeto antes de modificar arquivos.
2. Para cada tarefa, expor plano curto, arquivos afetados, critérios de aceite e riscos.
3. Implementar a menor mudança funcional possível, com testes apropriados.
4. Executar os testes disponíveis e registrar resultados reais; não afirmar testes não executados.
5. Se a tarefa exigir decisão de produto/regra ainda em aberto, **não escolher silenciosamente**: registrar alternativas e pedir aprovação.
6. Atualizar documentação quando uma decisão aprovada alterar comportamento ou arquitetura.
7. Preservar assets originais e evitar reestruturações sem necessidade.

## Primeiro caso de uso de referência

Fora de Cena, jogador em uma cidade decide visitar um ferreiro. O sistema inicia uma Cena de diálogo. O Narrador interpreta o ferreiro; o jogador pode examinar uma espada e negociar. Caso confirme uma compra válida, o motor atualiza inventário e dinheiro. A Cena termina e a Jornada preserva os resultados.

## Referências locais

- `docs/01-visao-do-produto.md`
- `docs/02-loop-de-gameplay.md`
- `docs/03-adaptacao-astra.md`
- `docs/04-arquitetura.md`
- `docs/05-narrador-ia.md`
- `docs/06-plano-inicial.md`
