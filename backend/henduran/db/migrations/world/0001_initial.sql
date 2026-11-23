-- 0001: banco de um Mundo (ADR-075). Só metadados e versões; o esquema do conteúdo vem depois.

-- Metadados do Mundo. Uma única linha (singleton = 1).
CREATE TABLE world_meta (
    singleton INTEGER NOT NULL DEFAULT 1 UNIQUE CHECK (singleton = 1),
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
);

-- Versões do Mundo (ADR-024). content guarda o conteúdo em JSON, ainda sem esquema definido.
CREATE TABLE world_versions (
    version INTEGER PRIMARY KEY CHECK (version >= 1),
    label TEXT,
    created_at TEXT NOT NULL,
    content TEXT NOT NULL CHECK (json_valid(content))
);
