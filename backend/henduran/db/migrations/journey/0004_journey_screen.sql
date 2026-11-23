-- 0004: o que a tela da Jornada precisa (ADR-076, itens 13 a 18). Título e arco das Cenas,
-- lugares descobertos na Jornada, lugar atual, data no calendário do Mundo, propostas de
-- Cena do Aduran, eventos do Log e campos opcionais e retrato do personagem.
-- O texto do Narrador não altera estado: só as operações validadas do motor gravam aqui.

-- Título da Cena (1 a 80). Nulo nas Cenas criadas antes: a API mostra "Cena N" (N = ordem).
ALTER TABLE scenes ADD COLUMN title TEXT CHECK (title IS NULL OR length(title) BETWEEN 1 AND 80);
-- Ambição ativa quando a Cena abriu (o arco). Nula nas Cenas criadas antes: vale a ativa atual.
ALTER TABLE scenes ADD COLUMN objective_id INTEGER REFERENCES objectives (id);

-- Lugares descobertos na Jornada (o world.db é só leitura para a Jornada, ADR-075). O id tem o
-- formato dos ids do Mundo e começa com "j-"; o motor confere que não colide com o Mundo fixado.
-- Os nomes são únicos entre Mundo e Jornada (o motor confere sem diferenciar maiúsculas).
CREATE TABLE places (
    id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 3 AND 40 AND substr(id, 1, 2) = 'j-'),
    name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
    type TEXT NOT NULL CHECK (length(type) BETWEEN 1 AND 40),
    description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 1000),
    scene_id INTEGER REFERENCES scenes (id),
    created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX places_unique_name ON places (lower(name));

-- Lugar atual (id do Mundo ou da Jornada). Jornadas existentes começam no lugar inicial.
ALTER TABLE journey_meta ADD COLUMN current_place_id TEXT
    CHECK (current_place_id IS NULL OR length(current_place_id) BETWEEN 1 AND 40);
UPDATE journey_meta SET current_place_id = start_place_id;

-- Data atual no calendário do Mundo (ADR-076, item 16): ano, mês (1..N) e dia (1..dias do mês).
-- O dia da semana é calculado, nunca gravado. Jornadas existentes recebem, ao abrir (quando o
-- Mundo está anexado), o dia 1 do mês 1 do ano do calendário.
ALTER TABLE journey_meta ADD COLUMN calendar_year INTEGER CHECK (calendar_year IS NULL OR calendar_year >= 1);
ALTER TABLE journey_meta ADD COLUMN calendar_month INTEGER CHECK (calendar_month IS NULL OR calendar_month BETWEEN 1 AND 14);
ALTER TABLE journey_meta ADD COLUMN calendar_day INTEGER CHECK (calendar_day IS NULL OR calendar_day BETWEEN 1 AND 40);

-- Propostas de Cena do Aduran (ADR-076, itens 12 e 17). Lugar conhecido (place_id) OU lugar
-- novo (new_place_*). No máximo uma pendente; aceitar grava a Cena (scene_id).
CREATE TABLE scene_proposals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status TEXT NOT NULL DEFAULT 'pendente'
        CHECK (status IN ('pendente', 'aceita', 'recusada', 'substituida')),
    title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 80),
    place_id TEXT CHECK (place_id IS NULL OR length(place_id) BETWEEN 1 AND 40),
    new_place_name TEXT CHECK (new_place_name IS NULL OR length(new_place_name) BETWEEN 1 AND 100),
    new_place_type TEXT CHECK (new_place_type IS NULL OR length(new_place_type) BETWEEN 1 AND 40),
    new_place_description TEXT CHECK (new_place_description IS NULL OR length(new_place_description) <= 1000),
    motive TEXT NOT NULL CHECK (length(motive) BETWEEN 1 AND 300),
    participants TEXT NOT NULL DEFAULT '[]'
        CHECK (json_valid(participants) AND json_type(participants) = 'array'),
    scene_id INTEGER REFERENCES scenes (id),
    created_at TEXT NOT NULL,
    decided_at TEXT,
    CHECK ((place_id IS NULL) = (new_place_name IS NOT NULL)),
    CHECK ((new_place_name IS NULL) = (new_place_type IS NULL)),
    CHECK ((new_place_name IS NULL) = (new_place_description IS NULL)),
    CHECK ((status = 'pendente') = (decided_at IS NULL)),
    CHECK (status = 'aceita' OR scene_id IS NULL)
);

CREATE UNIQUE INDEX scene_proposals_one_pending ON scene_proposals (status) WHERE status = 'pendente';

-- Eventos do motor para o Log (ADR-076, item 14), ligados à Cena quando houver. data: objeto
-- JSON com o texto necessário para exibir (título, nome do lugar, resumo). O momento (período e
-- data) é o da Jornada quando o evento aconteceu.
CREATE TABLE events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL CHECK (kind IN ('cena_aberta', 'cena_encerrada', 'lugar', 'cena_renomeada')),
    scene_id INTEGER REFERENCES scenes (id),
    data TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(data) AND json_type(data) = 'object'),
    day_period TEXT CHECK (day_period IS NULL OR length(day_period) BETWEEN 1 AND 40),
    calendar_year INTEGER CHECK (calendar_year IS NULL OR calendar_year >= 1),
    calendar_month INTEGER CHECK (calendar_month IS NULL OR calendar_month BETWEEN 1 AND 14),
    calendar_day INTEGER CHECK (calendar_day IS NULL OR calendar_day BETWEEN 1 AND 40),
    created_at TEXT NOT NULL
);

CREATE INDEX events_by_scene ON events (scene_id, id);

-- Eventos retroativos das Cenas que já existiam (aberta e, se for o caso, encerrada), na ordem.
-- A data fica nula aqui e é preenchida ao abrir, junto com a da Jornada.
INSERT INTO events (kind, scene_id, data, day_period, created_at)
SELECT kind, scene_id, data, day_period, at FROM (
    SELECT 'cena_aberta' AS kind, s.id AS scene_id, 0 AS ord,
           json_object('title', 'Cena ' || (SELECT COUNT(*) FROM scenes s2 WHERE s2.id <= s.id)) AS data,
           s.day_period AS day_period, s.opened_at AS at
    FROM scenes s
    UNION ALL
    SELECT 'cena_encerrada', s.id, 1,
           json_object('title', 'Cena ' || (SELECT COUNT(*) FROM scenes s2 WHERE s2.id <= s.id), 'summary', s.summary),
           s.day_period, s.closed_at
    FROM scenes s WHERE s.status = 'encerrada'
)
ORDER BY scene_id, ord;

-- Campos opcionais da descrição do personagem (sem efeito de regra; nulo = ausente) e o retrato:
-- portrait_file é o nome do arquivo em assets\ e portrait_crop o enquadramento {x, y, zoom}
-- (x e y de 0 a 1, zoom de 1 a 8). Os dois existem juntos ou nenhum.
ALTER TABLE character ADD COLUMN age TEXT CHECK (age IS NULL OR length(age) BETWEEN 1 AND 100);
ALTER TABLE character ADD COLUMN height TEXT CHECK (height IS NULL OR length(height) BETWEEN 1 AND 100);
ALTER TABLE character ADD COLUMN origin TEXT CHECK (origin IS NULL OR length(origin) BETWEEN 1 AND 200);
ALTER TABLE character ADD COLUMN personality TEXT CHECK (personality IS NULL OR length(personality) BETWEEN 1 AND 1000);
ALTER TABLE character ADD COLUMN portrait_file TEXT
    CHECK (portrait_file IS NULL OR portrait_file IN ('portrait.png', 'portrait.jpg', 'portrait.webp'));
ALTER TABLE character ADD COLUMN portrait_crop TEXT CHECK (
    (portrait_crop IS NULL) = (portrait_file IS NULL)
    AND (
        portrait_crop IS NULL
        OR (
            json_valid(portrait_crop) AND json_type(portrait_crop) = 'object'
            AND json_type(portrait_crop, '$.x') IN ('integer', 'real')
            AND json_type(portrait_crop, '$.y') IN ('integer', 'real')
            AND json_type(portrait_crop, '$.zoom') IN ('integer', 'real')
            AND json_extract(portrait_crop, '$.x') BETWEEN 0 AND 1
            AND json_extract(portrait_crop, '$.y') BETWEEN 0 AND 1
            AND json_extract(portrait_crop, '$.zoom') BETWEEN 1 AND 8
        )
    )
);
