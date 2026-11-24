# 11 — Menu inicial (redesenho)

**Data:** 2026-11-23
**Estado:** **aprovado pelo responsável em 2026-11-23** na primeira rodada do protótipo e **implementado em 2026-11-23** (`app/src/screens/MainMenu.tsx` e `app/src/screens/menu/`). Diferenças e decisões da implementação na seção 5.
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

O cartão precisa, no resumo da Jornada (`GET /journeys`), de: **retrato** (para mostrar sem abrir a Jornada), **data no calendário do Mundo** e **título da Cena em andamento**. **Feito:** cada item da lista traz `calendar` (o mesmo formato de `GET /journeys/current`), `current_scene_title` ("Cena N" sem título; `null` Fora de Cena) e `portrait` (`{crop, url_path}`), lidos em modo somente leitura e só para Jornadas com `status` `ok`; a imagem vem de `GET /journeys/{id}/portrait`, sem abrir a Jornada (contrato em `backend/README.md`). Campos novos e opcionais: clientes antigos continuam funcionando.

## 4. Fora deste desenho

- **Configurações** e **Créditos** (do esboço) entram quando essas telas existirem.
- Ilustrações desenhadas à mão continuam fora do MVP (ADR-069): tudo é desenhado em código.

## 5. Implementação (2026-11-23): diferenças e decisões

- **Paisagem** (`screens/menu/landscape.ts`, `MenuLandscape.tsx`): as cores do céu vêm de `sky.ts` (bandas, astro, estrelas, nuvens, relevo); o astro é menor e mais alto que na faixa do céu, como no protótipo, e as colinas do meio, as janelas acesas, os pássaros e os vaga-lumes são próprios do menu. As janelas dos castelos acendem na madrugada, no amanhecer, no entardecer e à noite, **como no protótipo** (o texto da seção 2 cita só noite e entardecer). A animação roda a 10 quadros por segundo só com a janela visível e fica parada com `prefers-reduced-motion` (estrelas e vaga-lumes acesos, nuvens e pássaros parados).
- **Castelos e astros** (ajuste depois da inspeção visual): no protótipo, o castelo da direita ficava atrás do cartão, a lua e o sol da tarde encostavam no título e o sol do entardecer se escondia atrás do cartão. Na implementação, em telas largas os castelos vão para fora do cartão (simétricos; entre 1180 e cerca de 1330 px encostam na borda com a torre virada para fora), a base de cada castelo desce até o chão da colina (nada flutua em encosta) e os astros ficam nas laterais: lua da noite e sol da tarde a 84% da largura, sol da manhã a 16%, sol do amanhecer e do entardecer se pondo à esquerda, atrás das colinas.
- **Botões**: o componente `Button` do app (foco, desativado e carregando), com o desenho do protótipo por cima (degradê, ícone à esquerda, texto centralizado, losangos nas pontas). **Sair** só aparece dentro do Tauri (no navegador não há como fechar), como antes.
- **Cartão**: `Panel` de pergaminho com o retrato (`Portrait` pequeno, 64 px, no lugar de 88 px) ou as iniciais; a data usa o mesmo texto da barra da Jornada ("12 de Alvorim, Solário · Ano 476"). "Salvo há…" mostra minutos, horas ou dias (até 30 dias; depois, a data), com a data completa no `title`. Sem Jornada, o título é "Sua primeira Jornada" (texto do protótipo, sem botão extra: **Nova Jornada** está ao lado). Jornada não utilizável: o aviso da lista de Jornadas e o caminho para **Jornadas**. Serviço iniciando: "Preparando o serviço local…"; erro do serviço: aviso curto (o detalhe fica no rodapé).
- **Rodapé**: à esquerda "Henduran · v<versão>" (a versão do app, não "Alpha 0.4"); o indicador é um botão que abre Modelos, com luz e texto: verde "<modelo> pronto" (com o provedor de teste, "provedor fake pronto", como na barra da Jornada), amarela piscando "Iniciando o serviço", "carregando o modelo…" ou "baixando o motor de IA…", vermelha "nenhum modelo carregado" ou erro do serviço. A barra de status antiga não aparece mais no menu.
- **Telas baixas** (até 820 px de altura): título menor e menos espaço em cima; se ainda faltar altura, a área central rola e o rodapé fica fixo.
