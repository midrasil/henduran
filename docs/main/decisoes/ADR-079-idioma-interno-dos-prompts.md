# ADR-079 — Idioma interno dos prompts: instruções em inglês, resposta em português

- **Estado:** **Aprovada pelo responsável** (2026-11-24), com **medição obrigatória** antes de fixar (ver "Verificação").
- **Data:** 2026-11-24
- **Complementa:** ADR-071 (`NarratorProvider`), ADR-078 (orçamento de tokens e contexto) e `05-narrador-ia.md`
- **Origem:** o responsável perguntou se o envio à IA deveria ser sempre em inglês, por gastar menos tokens, com tradução da resposta (talvez com um motor open source, como alternativa ao DeepL).

## Contexto

Em geral o português gasta mais tokens que o inglês (a diferença varia por modelo e por tokenizador). Em modelos locais, com janela de 4 mil a 32 mil tokens, a parte fixa do prompt (regras, instruções do Narrador, skills, esquemas do extrator) se repete a cada turno e é a maior fonte de custo. Além disso, as skills do acervo e do skills.sh são, em boa parte, em inglês.

## Decisão

1. **As instruções internas ficam em inglês**: regras do Narrador, esquemas e instruções do extrator do Quadro da Cena, instruções do Aduran, do "preencher dados" e do "melhorar texto", e o texto das skills como vêm. O jogador não vê esses textos.
2. **A resposta ao jogador é gerada diretamente em português do Brasil**, por uma instrução explícita no fim do prompt ("Always reply in Brazilian Portuguese"). **Não há camada de tradução** da entrada nem da saída.
3. **O que é do jogo continua em português**: as falas e mensagens do jogador, o histórico (foi o modelo que escreveu), nomes, o Cânone e os textos do Mundo e da ficha. As etiquetas que o extrator devolve **só para casar com skills** podem ser em inglês.
4. **As marcas de formatação** (`"fala"`, `*ação*`, `Nome: "fala"`) não mudam (`09-tela-da-jornada.md`, item 2.10).

## Alternativas descartadas

- **Tradução completa (entrada e saída) com motor open source** (Argos Translate, Opus-MT, NLLB, LibreTranslate): um segundo modelo para instalar e rodar a cada turno, mais latência, streaming só por frase, e perda de tom, de nomes próprios e das marcas de fala e ação; a fala do jogador seria traduzida duas vezes (ida e volta). Qualidade abaixo do DeepL.
- **Tudo em português:** o mais simples e o mais caro em tokens.

## Verificação (antes de fixar)

- **Medir** o tamanho real dos prompts do Narrador nos dois idiomas, com o tokenizador do modelo em uso (o `llama-server` conta tokens), e registrar os números neste ADR.
- **Teste de idioma** na suíte de continuidade: a resposta do modelo, em turnos longos, não escorrega para o inglês nem mistura idiomas, com os modelos pequenos recomendados.
- Se algum modelo falhar de forma recorrente, reforçar a instrução de idioma ou reavaliar para esse modelo.

## Consequências

- Economia de tokens nas partes fixas, sem custo de tradução.
- Os textos do prompt passam a viver em inglês no código; a documentação em português descreve o que cada um faz.
- Risco: o modelo pequeno responder em inglês; coberto pelo teste e pela instrução.
