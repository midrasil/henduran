-- 0001: banco do app (preferências e metadados). Nenhuma tabela de jogo aqui.

-- Preferências do serviço; value guarda o valor em JSON.
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Metadados do próprio banco (por exemplo, created_at).
CREATE TABLE app_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

INSERT INTO app_meta (key, value) VALUES ('created_at', strftime('%Y-%m-%dT%H:%M:%SZ', 'now'));
