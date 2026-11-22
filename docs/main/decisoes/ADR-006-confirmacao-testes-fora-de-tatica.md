# ADR-006 — Confirmação obrigatória dos testes fora de situações táticas

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Referência:** P-07 do GDD
- **Origem:** decisão explícita do responsável pelo Henduran

## Contexto

O Narrador IA do Henduran possui autonomia narrativa, mas não decide ações do protagonista nem executa livremente mecânicas. Fora das situações táticas, testes de Atributo e Perícia podem ser solicitados pelo Narrador em situações sociais, investigativas, exploratórias e outras.

## Decisão

**Todos os testes fora de situações táticas exigem confirmação explícita do jogador antes da rolagem.** A IA pode propor o teste; o motor apenas o executa após a confirmação correspondente.

Esta decisão não determina como funcionará a confirmação das rolagens **durante** situações táticas. Também não autoriza rolagens inventadas pelo modelo ou resultados mecânicos definidos por texto.

## Fluxo operacional de referência

1. Jogador descreve sua ação ou a situação exige que o Narrador proponha um teste.
2. Narrador solicita um teste com seus parâmetros: Atributo, Perícia quando aplicável, dificuldade e modificadores conhecidos.
3. Interface mostra a proposta ao jogador, **sem rolar dados**.
4. Jogador confirma ou recusa/cancela.
5. Após confirmação, o motor verifica regras e parâmetros e executa a rolagem; o resultado mecânico torna-se disponível para o Narrador narrar.
6. Em caso de recusa, não há rolagem nem efeitos mecânicos produzidos por esse teste. A continuação narrativa é tratada no fluxo de Cena, sem presumir automaticamente sucesso ou fracasso.

Os campos exatos da solicitação, regras para alteração de parâmetros, Vontade e a interface visual serão especificados em implementação posterior, sem alterar a exigência de confirmação.

## Consequências e testes de conformidade

- Não há rolagens narrativas ocultas executadas sem confirmação.
- A confirmação deve se referir a uma proposta de teste específica; propostas alteradas precisam de nova confirmação.
- O motor é a autoridade sobre resultados; a IA não decide números de dados ou sucessos arbitrariamente.
- Cancelar, rejeitar ou expirar uma solicitação **não** pode gerar consumo mecânico, resultado persistido ou consequência de rolagem.
- Os testes em modo tático conservam suas regras próprias, a serem detalhadas separadamente.

## Questões não decididas por esta ADR

- Política de confirmações e respostas dentro das situações táticas.
- Escolha visual entre modal, cartão inline, botão no chat ou outro formato.
- Comportamento de reabertura de uma solicitação após salvar/retomar a Jornada.
- Quando e como o jogador pode revisar uma proposta de teste apresentada pelo Narrador.
