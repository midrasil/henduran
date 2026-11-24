# 10 — Prototipagem de telas

**Data:** 2026-11-23
**Estado:** **processo aprovado pelo responsável em 2026-11-23**, depois da tela da Jornada.

## 1. Regra

**Toda tela nova, ou redesenho grande de uma tela, passa por um protótipo navegável aprovado pelo responsável antes de ir para o dev.** O dev implementa a partir do protótipo aprovado e do documento da tela, não de um esboço estático.

Ajustes pequenos numa tela já aprovada (um botão, um texto, um espaçamento) não precisam de protótipo.

## 2. Como fazemos

1. **Documento da tela** em `docs/ui-ux/` (por exemplo, `09-tela-da-jornada.md`) com regiões, comportamento e estados. Nasce como rascunho e é atualizado a cada rodada.
2. **Protótipo navegável** em HTML único, só visual:
   - usa os **tokens e as fontes do app** (`app/src/styles/tokens.css`, ADR-069) e o visual pixel art aprovado;
   - **dados de exemplo realistas** do Henduran, nunca *lorem ipsum*;
   - **interativo** nos pontos que importam (trocar estado, abrir diálogos, enviar mensagem simulada);
   - um botão **Protótipo**, separado da tela, com os controles para ver cada estado e cada variação;
   - quando houver dúvida de direção, **variações lado a lado** (por exemplo, livro e teatro; cinco posições do céu) para o responsável escolher.
3. **Rodadas de revisão**: o responsável testa, comenta, e o protótipo é refeito no mesmo link até ser aprovado. Cada rodada registra as decisões no documento da tela.
4. **Aprovado**: o HTML final vai para `docs/ui-ux/prototipos/<tela>.html`, o documento da tela muda para "aprovado" e aponta para ele.
5. **Só então** o plano vai para o dev, com o protótipo e o documento como referência. Diferenças necessárias na implementação são reportadas, não decididas em silêncio.

## 3. O que o protótipo não é

- Não é código do app: não é copiado para `app/src/`. O dev reconstrói com os componentes de `app/src/ui/` e a galeria.
- Não decide regra nem dado: se o protótipo mostrar um campo ou mecânica nova (por exemplo, idade na ficha), isso entra como **proposta** marcada e precisa de aprovação própria.

## 4. Protótipos

| Tela | Documento | Protótipo | Estado |
|---|---|---|---|
| Jornada (Cena, Aduran, Log, Arcos, Ficha) | `09-tela-da-jornada.md` | `prototipos/tela-da-jornada.html` | Aprovado em 2026-11-23 |
| Menu inicial (redesenho) | `11-menu-inicial.md` | `prototipos/menu-inicial.html` | Aprovado e implementado em 2026-11-23 |
| Nova Jornada (assistente) | `ANALISE-ESBOCOS.md` | — | Idem |
| Jornadas (lista) | — | — | Idem |
| Modelos (no nível do Caliope) | backlog | — | **A prototipar** antes do redesenho |
| Mundo e registro de lugares | `09`, item 2.1 | — | **A prototipar** quando passar de diálogo simples |
| Configurações | — | — | **A prototipar** |
| Mapa, Inventário, Diário | fora do MVP | — | **A prototipar** quando entrarem |
