# 11 — Menu inicial (redesenho)

**Data:** 2026-11-23
**Estado:** **aprovado pelo responsável em 2026-11-23** na primeira rodada do protótipo. Ainda **não implementado**: o app continua com o menu anterior até a tarefa de implementação (backlog).
**Protótipo de referência:** [`prototipos/menu-inicial.html`](prototipos/menu-inicial.html) (botão **Protótipo**: período, situação, serviço e modelo, animação). Processo em [`10-prototipagem.md`](10-prototipagem.md).
**Substitui:** a parte do menu em `esbocos/ANALISE-ESBOCOS.md` (seção 2.1) e o layout atual de `app/src/screens/MainMenu.tsx`.
**Relacionados:** `07-ambiente-dia-noite.md` (céu), `09-tela-da-jornada.md` (mesma linguagem visual), `ESCOPO-MVP.md` (item 1).

## 1. Princípios

- **Simetria e eixo central**: título e botões centralizados; nada empurra os botões para fora do centro.
- A tela é uma **paisagem viva** em pixel art, com o período do dia da última Jornada jogada (como hoje, `07-ambiente-dia-noite.md`).
- **Modelos não é um botão do menu**: o acesso fica no indicador do rodapé.

## 2. Regiões

```
┌⌐ estandarte                                             estandarte ¬┐
│          ✦  H E N D U R A N  ✦                                      │
│          ── ◆ ──  Jornada solo de fantasia com Narrador IA          │
│                 [★ Continuar Jornada ]   ┌ Última Jornada ───────┐  │
│                 [⚔ Nova Jornada      ]   │ (retrato) nome, lugar │  │
│                 [▤ Jornadas          ]   │ período e data, Cena  │  │
│                 [⇥ Sair              ]   └ salvo há 2 h  Ver todas┘  │
│  castelo  ~~~ paisagem animada ~~~                         castelo  │
└ ✦ Henduran · Alpha 0.4          ◆           ● Conectado · modelo · Modelos ▸ ┘
```

1. **Fundo**: céu do período em tela cheia (o mesmo desenho de `sky.ts`), relevo distante, colinas, árvores no primeiro plano e **um castelo em silhueta de cada lado** (simetria), com janelas acesas à noite e no entardecer. Uma vinheta escura nas bordas dá foco ao centro.
2. **Animação** por período, em passos de pixel (cerca de 10 quadros por segundo): nuvens passando (dia), estrelas piscando (noite, madrugada), pássaros (manhã, tarde), vaga-lumes (entardecer, noite). Tudo **parado com `prefers-reduced-motion`** (ADR-068).
3. **Decoração**: cantos dourados em pixel na moldura da tela; **dois estandartes** pendurados nas laterais, balançando de leve (somem em telas estreitas); brilho ocasional na marca do título.
4. **Título**: "Henduran" grande em serifa dourada com sombra em degraus, **rosa dos ventos em pixel dos dois lados**, filete pontilhado com losango e o subtítulo.
5. **Botões no eixo central** (coluna fixa de cerca de 320 px): **Continuar Jornada** (destaque roxo), **Nova Jornada**, **Jornadas**, **Sair**; ícone em pixel à esquerda, texto centralizado, losangos dourados nas duas pontas ao passar o mouse ou com foco. Continuar fica desabilitado sem Jornada utilizável; os três primeiros, enquanto o serviço inicia.
6. **Cartão "Última Jornada"** preso **à direita da coluna**, sem deslocar o eixo: pergaminho com moldura dourada; retrato recortado (ou iniciais), nome da Jornada, personagem, lugar atual e Mundo, **período e data no calendário do Mundo**, a **Cena em andamento** (se houver) e "salvo há…", com "Ver todas" (abre Jornadas). Estados: primeira vez (texto convidando a criar), Jornada danificada (aviso com o caminho para Jornadas), serviço iniciando.
7. **Rodapé**: à esquerda a versão; no centro um losango; à direita o **indicador do serviço e do modelo**, clicável, que **abre Modelos**: luz verde "Conectado · <modelo> pronto", vermelha "Conectado · nenhum modelo carregado", amarela piscando "Iniciando o serviço".
8. **Telas estreitas** (abaixo de 1180 px): o cartão desce para baixo dos botões, centralizado; estandartes somem.

## 3. Dados que faltam no serviço

O cartão precisa, no resumo da Jornada (`GET /journeys`), de: **retrato** (para mostrar sem abrir a Jornada), **data no calendário do Mundo** e **título da Cena em andamento**. Hoje o resumo traz nome, personagem, lugar, Mundo, período e data de gravação. Entra na tarefa de implementação.

## 4. Fora deste desenho

- **Configurações** e **Créditos** (do esboço) entram quando essas telas existirem.
- Ilustrações desenhadas à mão continuam fora do MVP (ADR-069): tudo é desenhado em código.
