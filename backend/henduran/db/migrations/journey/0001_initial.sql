-- 0001: banco de uma Jornada (ADR-075). Só o resumo; o esquema de jogo vem depois.

-- Resumo da Jornada, lido pela lista de Jornadas sem abrir o jogo. Uma única linha
-- (singleton = 1). world_id e world_version fixam a versão do Mundo usada (ADR-021, 024).
CREATE TABLE journey_meta (
    singleton INTEGER NOT NULL DEFAULT 1 UNIQUE CHECK (singleton = 1),
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    character_name TEXT,
    location TEXT,
    day_period TEXT,
    world_id TEXT NOT NULL,
    world_version INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    last_saved_at TEXT
);
