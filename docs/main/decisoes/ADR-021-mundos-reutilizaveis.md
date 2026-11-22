# ADR-021 — Biblioteca de Mundos independentes e reutilizáveis

- **Estado:** Aprovada
- **Data:** 2026-11-22
- **Questão:** P-15 do GDD
- **Origem:** Aprovação explícita do responsável pelo Henduran

## Contexto

Henduran não ficará limitado a um único universo fixo nem apenas à criação procedural irrestrita de ambientações. O jogador deverá poder montar Mundos com conhecimento próprio ou obtido de outras fontes e utilizar esses Mundos como base para o jogo. O Caliope possui componentes relevantes de cenários, lorebooks e pesquisa em wikis, mas seu funcionamento não será transplantado automaticamente.

## Decisão aprovada

O Henduran terá **Mundos independentes e reutilizáveis**, com três formas de criação:

1. **Manual:** usuário cria e edita a definição de um Mundo.
2. **Assistida por IA:** usuário utiliza IA para ajudar a elaborar um Mundo.
3. **Importação:** usuário utiliza wikis e/ou documentos como fontes para construir um Mundo.

Uma **Jornada** é iniciada a partir de um Mundo escolhido e tem **estado próprio**. Acontecimentos de uma Jornada não alteram automaticamente o Mundo-base nem outras Jornadas que utilizem o mesmo Mundo.

O modelo híbrido de geração geográfica e detalhamento procedural da ADR-018 continua em vigor, subordinado às informações do Mundo escolhido. A memória do Narrador não substitui os dados oficiais de Mundo nem o estado da Jornada.

## Implicações

- A aplicação deverá distinguir conceitualmente **Mundo**, **Jornada**, **Narrador** e **Wiki de Regras do Henduran**.
- A biblioteca de Mundos não é a mesma coisa que a memória narrativa das Jornadas.
- O mesmo Mundo poderá ser reutilizado em várias Jornadas independentes.
- A importação de material externo exige atenção a proveniência, direitos de uso e permissões de redistribuição.
- A pesquisa do Caliope em MediaWiki/Fandom, os lorebooks e os cenários são referências técnicas a serem auditadas conforme ADR-016, não implementação automaticamente aprovada.

## Recomendações ainda não aprovadas

- Versionar definições de Mundos e associar cada Jornada a uma versão estável.
- Manter referências às páginas e documentos importados e permitir revisão do conteúdo antes de aprová-lo.
- Separar informação confirmada pelas fontes, interpretação da IA e adições originais do jogador.
- Indexar fontes textuais de Mundo para pesquisa durante a narração, respeitando orçamento de contexto.

## Pendências

- Escopo e interface do editor de Mundos.
- Formatos iniciais de importação; suporte exato a MediaWiki/Fandom e arquivos locais.
- Critérios de canonização, deduplicação e resolução de contradições de fontes.
- Versionamento, edição e atualização de Mundos com Jornadas existentes.
- Geração geográfica a partir de enciclopédias incompletas.
- Políticas de compartilhamento de conteúdo externo protegido.
- Identidade e destino de uma Jornada ao concluir sua narrativa (P-19).

## Critérios de aceite propostos

- É possível selecionar o mesmo Mundo para duas Jornadas; alterações de estado em uma não afetam a outra.
- É possível iniciar a construção de Mundo pelas três modalidades aprovadas, respeitando o escopo do marco em implementação.
- O Narrador recebe contexto coerente com o Mundo selecionado sem transformar trechos recuperados em alterações mecânicas.
