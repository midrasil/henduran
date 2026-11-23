-- 0002: personagem da fatia 1 (rules/09-criacao-de-personagem.md). Só o necessário
-- para criar a ficha; eventos, memória, salvamentos e ramificações vêm depois.

-- Versão das regras aplicada à Jornada (rules/README.md: deve ser identificável).
ALTER TABLE journey_meta ADD COLUMN rules_version TEXT NOT NULL DEFAULT 'fatia-1';

-- O personagem da Jornada. Uma única linha (id = 1). Os contadores de dano das
-- trilhas começam em 0; o tamanho das trilhas é derivado dos Atributos (Vida = 3 + Vigor,
-- Vontade = 3 + Determinação) e não é gravado.
CREATE TABLE character (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
    concept TEXT NOT NULL CHECK (length(concept) BETWEEN 1 AND 300),
    appearance TEXT NOT NULL CHECK (length(appearance) BETWEEN 1 AND 4000),
    history TEXT NOT NULL CHECK (length(history) BETWEEN 1 AND 4000),
    creation_profile TEXT NOT NULL CHECK (creation_profile IN ('generalista', 'equilibrado', 'especialista')),
    vida_superficial INTEGER NOT NULL DEFAULT 0 CHECK (vida_superficial >= 0),
    vida_agravada INTEGER NOT NULL DEFAULT 0 CHECK (vida_agravada >= 0),
    vontade_superficial INTEGER NOT NULL DEFAULT 0 CHECK (vontade_superficial >= 0),
    vontade_agravada INTEGER NOT NULL DEFAULT 0 CHECK (vontade_agravada >= 0),
    created_at TEXT NOT NULL
);

-- Os seis Atributos (ids da fatia 1, sem acento). Escala 1..5; o teto 4 da criação é do motor.
CREATE TABLE character_attributes (
    attribute TEXT PRIMARY KEY CHECK (length(attribute) BETWEEN 1 AND 40),
    character_id INTEGER NOT NULL DEFAULT 1 REFERENCES character (id) ON DELETE CASCADE,
    value INTEGER NOT NULL CHECK (value BETWEEN 1 AND 5)
);

-- As 22 Perícias, inclusive as em 0. Escala 0..5.
CREATE TABLE character_skills (
    skill TEXT PRIMARY KEY CHECK (length(skill) BETWEEN 1 AND 40),
    character_id INTEGER NOT NULL DEFAULT 1 REFERENCES character (id) ON DELETE CASCADE,
    value INTEGER NOT NULL CHECK (value BETWEEN 0 AND 5)
);

-- As 3 Convicções, cada uma com seu Pilar. Fraturas: 0 íntegra, 1, 2 rompida (rules/06).
CREATE TABLE convictions (
    position INTEGER PRIMARY KEY CHECK (position BETWEEN 1 AND 3),
    character_id INTEGER NOT NULL DEFAULT 1 REFERENCES character (id) ON DELETE CASCADE,
    text TEXT NOT NULL CHECK (length(text) BETWEEN 1 AND 300),
    pillar TEXT NOT NULL CHECK (length(pillar) BETWEEN 1 AND 300),
    fractures INTEGER NOT NULL DEFAULT 0 CHECK (fractures BETWEEN 0 AND 2)
);

-- Ambição e Desejo (rules/07). Um objetivo encerrado guarda o motivo (status) e a data;
-- a troca e o histórico virão depois (ADR-073).
CREATE TABLE objectives (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER NOT NULL DEFAULT 1 REFERENCES character (id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('ambicao', 'desejo')),
    text TEXT NOT NULL CHECK (length(text) BETWEEN 1 AND 300),
    status TEXT NOT NULL DEFAULT 'ativo'
        CHECK (status IN ('ativo', 'concluido', 'abandonado', 'impossivel', 'sem_sentido')),
    reason TEXT CHECK (reason IS NULL OR length(reason) <= 1000),
    created_at TEXT NOT NULL,
    closed_at TEXT,
    CHECK ((status = 'ativo') = (closed_at IS NULL))
);

-- No máximo um objetivo ativo de cada tipo (1 Ambição e 1 Desejo por vez).
CREATE UNIQUE INDEX objectives_one_active ON objectives (character_id, kind) WHERE status = 'ativo';
