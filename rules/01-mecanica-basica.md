# Mecânica Básica

**Status:** aprovada para a fatia 1 em 2026-11-22. Versão das regras: `fatia-1`.

**Origem:** `Regras/Mecânica Básica/Reserva de Dados.md`.

## Reserva de Dados **[ASTRA]**

- O jogo usa **d10**. Cada ponto da Reserva é um dado rolado.
- A Reserva é **Atributo + Perícia**. Sem Perícia aplicável, é só o Atributo. Uma Perícia em 0 não soma dados.
- Toda Reserva tem pelo menos um Atributo. A segunda parcela é uma Perícia ou outro Atributo, **nunca o mesmo Atributo duas vezes**.
- O Atributo ligado a uma Perícia só muda por regra expressa. Na fatia 1 nenhuma regra o troca (Capacidades estão fora).

## Sucessos **[ASTRA]**

- Dado de **6 a 10** é 1 Sucesso. Dado de 1 a 5 não conta.
- Um **par de 10** dá **1 Sucesso extra**: 10 + 10 = 3 Sucessos. Cada par conta separadamente. Exemplo: 10, 10, 10, 7, 3 = 5 Sucessos.

## Dificuldade **[ASTRA]**

- A **Dificuldade** é o número de Sucessos necessários. Passa quem igualar ou superar.
- Escala sugerida, sem força de regra: 1 rotina, 2 básico (ponto de partida), 3 desafiador, 4 difícil, 5 muito difícil, 6 ou mais proeza.
- Sucessos acima da Dificuldade merecem um resultado melhor (mais rápido, elegante ou com informação extra), apenas como **efeito narrativo**.

## Testes opostos **[ASTRA]**

Cada lado rola sua Reserva e vence quem tiver mais Sucessos. No **empate prevalece a situação atual**: quem tenta mudar algo não consegue.

## Penalidades **[ASTRA]**

- Penalidades em dados **se somam**.
- Podem ser **Físicas** ou **Espirituais**, conforme o Atributo efetivamente usado. Se a Reserva mistura categorias, valem as penalidades das duas.
- Nenhuma penalidade reduz a Reserva abaixo de **1 dado**, salvo regra que proíba a ação.

## Arredondamento **[ASTRA]**

Divisões arredondam para baixo.

## Como um teste acontece no Henduran **[ADAPTAÇÃO — ADR-006]**

1. O jogador descreve uma ação, ou a situação pede um teste. O Narrador **propõe** o teste: Atributo, Perícia, Dificuldade e modificadores conhecidos.
2. A interface mostra a proposta **sem rolar**.
3. O jogador **confirma ou recusa**. Uma proposta alterada exige nova confirmação.
4. Confirmado, o **motor** verifica e rola os dados. O resultado vai ao Narrador para narrar.
5. Recusar não rola dados, não consome nada e não presume sucesso nem fracasso.
6. A IA nunca rola dados nem define Sucessos. Em testes opostos contra NPCs, o motor rola os dois lados.
7. Depois de ver o resultado, o jogador pode gastar Vontade para rerrolar (ver `05-vontade.md`).

## Fora da fatia 1 e pendências

- **Ajuda (+1 dado, sem acúmulo):** fora, pois o MVP é solo. **[FATIAS 2 E 3]** se houver companheiros.
- **[PENDENTE]** Faixa permitida de Dificuldade que o Narrador pode propor e quem valida o excesso.
- **[PENDENTE]** Formato do registro de cada rolagem (dados, Sucessos, quem confirmou).
