-- 0006: aparência do personagem opcional (12-nova-jornada.md, seção 4; aprovado em 2026-11-24).
-- O SQLite não altera um CHECK existente: a tabela character é reconstruída com
-- appearance TEXT NOT NULL DEFAULT '' (vazio = não informada, até 4.000 caracteres) e as
-- demais colunas iguais. Nada é perdido:
--
-- - A migração roda numa só transação (o runner faz backup do banco antes) e as chaves
--   estrangeiras estão ligadas. DROP TABLE character apagaria em cascata Atributos,
--   Perícias, Convicções e objetivos (ON DELETE CASCADE), por isso essas linhas são
--   copiadas antes para tabelas temporárias e devolvidas com os mesmos ids depois.
-- - defer_foreign_keys adia a conferência das chaves (scenes.objective_id aponta para
--   objectives) para o COMMIT, quando tudo já voltou ao lugar; se algo faltar, o COMMIT
--   falha e a transação inteira é desfeita.
PRAGMA defer_foreign_keys = ON;

CREATE TEMP TABLE m0006_attributes AS SELECT * FROM character_attributes;
CREATE TEMP TABLE m0006_skills AS SELECT * FROM character_skills;
CREATE TEMP TABLE m0006_convictions AS SELECT * FROM convictions;
CREATE TEMP TABLE m0006_objectives AS SELECT * FROM objectives;

CREATE TABLE character_new (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
    concept TEXT NOT NULL CHECK (length(concept) BETWEEN 1 AND 300),
    appearance TEXT NOT NULL DEFAULT '' CHECK (length(appearance) <= 4000),
    history TEXT NOT NULL CHECK (length(history) BETWEEN 1 AND 4000),
    creation_profile TEXT NOT NULL CHECK (creation_profile IN ('generalista', 'equilibrado', 'especialista')),
    vida_superficial INTEGER NOT NULL DEFAULT 0 CHECK (vida_superficial >= 0),
    vida_agravada INTEGER NOT NULL DEFAULT 0 CHECK (vida_agravada >= 0),
    vontade_superficial INTEGER NOT NULL DEFAULT 0 CHECK (vontade_superficial >= 0),
    vontade_agravada INTEGER NOT NULL DEFAULT 0 CHECK (vontade_agravada >= 0),
    created_at TEXT NOT NULL,
    age TEXT CHECK (age IS NULL OR length(age) BETWEEN 1 AND 100),
    height TEXT CHECK (height IS NULL OR length(height) BETWEEN 1 AND 100),
    origin TEXT CHECK (origin IS NULL OR length(origin) BETWEEN 1 AND 200),
    personality TEXT CHECK (personality IS NULL OR length(personality) BETWEEN 1 AND 1000),
    portrait_file TEXT
        CHECK (portrait_file IS NULL OR portrait_file IN ('portrait.png', 'portrait.jpg', 'portrait.webp')),
    portrait_crop TEXT CHECK (
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
    ),
    history_html TEXT CHECK (history_html IS NULL OR length(history_html) BETWEEN 1 AND 40000)
);

INSERT INTO character_new (
    id, name, concept, appearance, history, creation_profile, vida_superficial, vida_agravada,
    vontade_superficial, vontade_agravada, created_at, age, height, origin, personality,
    portrait_file, portrait_crop, history_html
)
SELECT
    id, name, concept, appearance, history, creation_profile, vida_superficial, vida_agravada,
    vontade_superficial, vontade_agravada, created_at, age, height, origin, personality,
    portrait_file, portrait_crop, history_html
FROM character;

DROP TABLE character;
ALTER TABLE character_new RENAME TO character;

-- As linhas apagadas em cascata voltam com os mesmos valores (e os mesmos ids dos objetivos).
DELETE FROM character_attributes;
DELETE FROM character_skills;
DELETE FROM convictions;
DELETE FROM objectives;
INSERT INTO character_attributes SELECT * FROM m0006_attributes;
INSERT INTO character_skills SELECT * FROM m0006_skills;
INSERT INTO convictions SELECT * FROM m0006_convictions;
INSERT INTO objectives SELECT * FROM m0006_objectives;

DROP TABLE m0006_attributes;
DROP TABLE m0006_skills;
DROP TABLE m0006_convictions;
DROP TABLE m0006_objectives;
