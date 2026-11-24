-- 0005: descrição da Jornada e História formatada (ADR-077, itens 2 e 4).

-- Descrição da Jornada, escrita pelo jogador (opcional, 1 a 2.000 caracteres; nula = sem descrição).
-- O Narrador a recebe no contexto geral da Jornada.
ALTER TABLE journey_meta ADD COLUMN description TEXT
    CHECK (description IS NULL OR length(description) BETWEEN 1 AND 2000);

-- História formatada: HTML saneado pelo serviço (lista permitida de henduran/richtext.py). A coluna
-- history continua com o texto puro derivado (o limite de 4.000 conta o texto puro, e é ele que o
-- Narrador lê). Nula nas Histórias gravadas antes, em texto simples: a API as entrega como parágrafos.
ALTER TABLE character ADD COLUMN history_html TEXT
    CHECK (history_html IS NULL OR length(history_html) BETWEEN 1 AND 40000);
