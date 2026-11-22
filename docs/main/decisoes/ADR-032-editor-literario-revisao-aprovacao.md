# ADR-032 — Editor literário com revisão assistida por IA e aprovação de versões

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Questão:** P-31
- **Origem:** Aprovação explícita do responsável pelo Henduran

## Contexto

As ADR-023, ADR-030 e ADR-031 estabelecem que o Henduran produzirá diário e livro literário exportável, somente mediante solicitação do jogador, com perspectiva e voz configuráveis. Restava decidir como revisar e editar o material produzido pela IA.

## Decisão aprovada

O Henduran oferecerá **editor literário** que permita:
- **Edição manual direta** do texto produzido.
- **Seleção de trechos** e solicitação de reescritas ou melhorias com auxílio da IA.
- **Revisão e aprovação de versões** antes de incorporar as alterações ao diário ou ao livro.

A IA poderá sugerir mudanças, mas não deverá substituir automaticamente trechos já aprovados sem a ação correspondente do jogador.

O conteúdo literário é uma **representação derivada** dos acontecimentos registrados, separada do histórico e do estado canônicos. Alterações no editor não modificarão eventos, fichas, inventários, personagens ou regras do jogo. A elaboração literária continuará respeitando as decisões já aprovadas sobre perspectiva/voz e geração sob demanda.

## Consequências

- Separar modelo de dados do editor e registro canônico.
- Proporcionar ferramentas de revisão assistida por IA aplicadas a trechos selecionados.
- Definir no fluxo de UI uma etapa de aprovação antes da incorporação de revisões.
- Preservar a possibilidade de realizar correções manuais independentemente da disponibilidade de um modelo de IA.

## Pendências não aprovadas

- Componentes concretos da interface e atalhos do editor.
- Granularidade, armazenamento, comparação, desfazer/refazer e histórico das versões.
- Formatos de exportação e processamento de saída.
- Estrutura de capítulos, estilos literários específicos e políticas para revisões retroativas.
- Política de detecção automática de divergências entre texto literário e fatos canônicos.

## Relação com decisões anteriores

- **ADR-023:** diário e livro com revisão literária assistida.
- **ADR-030:** geração literária somente por solicitação explícita.
- **ADR-031:** perspectivas em primeira ou terceira pessoa, com voz consistente.
- **ADR-032:** edição manual, reescrita seletiva e aprovação de versões.
