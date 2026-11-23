-- 0003: Cenas e histórico do chat (ADR-076). Lugar inicial da Jornada, Cenas (no máximo
-- uma aberta) e mensagens nos canais Fora de Cena e Cena. O texto do Narrador não altera
-- estado: só as operações validadas pelo motor gravam Cenas e resumos.

-- Id do lugar inicial no conteúdo do Mundo (places[].id). Nulo em Jornadas criadas antes.
ALTER TABLE journey_meta ADD COLUMN start_place_id TEXT
    CHECK (start_place_id IS NULL OR length(start_place_id) BETWEEN 1 AND 40);

-- Cenas. opening_tone só existe nas Cenas abertas por tom de partida (a Cena inicial).
-- O lugar e o período vêm do motor; o motivo e os participantes, da proposta validada.
-- participants: array JSON de textos. Uma Cena encerrada sempre tem resumo e data.
CREATE TABLE scenes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'encerrada')),
    opening_tone TEXT CHECK (opening_tone IS NULL OR length(opening_tone) BETWEEN 1 AND 40),
    place_id TEXT NOT NULL CHECK (length(place_id) BETWEEN 1 AND 40),
    day_period TEXT NOT NULL CHECK (length(day_period) BETWEEN 1 AND 40),
    motive TEXT NOT NULL CHECK (length(motive) BETWEEN 1 AND 300),
    participants TEXT NOT NULL DEFAULT '[]'
        CHECK (json_valid(participants) AND json_type(participants) = 'array'),
    summary TEXT CHECK (summary IS NULL OR length(summary) BETWEEN 1 AND 2000),
    opened_at TEXT NOT NULL,
    closed_at TEXT,
    CHECK ((status = 'aberta') = (closed_at IS NULL)),
    CHECK (status = 'aberta' OR summary IS NOT NULL)
);

-- No máximo uma Cena aberta por Jornada (MVP).
CREATE UNIQUE INDEX scenes_one_open ON scenes (status) WHERE status = 'aberta';

-- Mensagens do chat, na ordem do id. Canal 'cena' exige a Cena de origem; 'fora_de_cena'
-- não tem Cena. status 'cancelada': resposta interrompida, guardada com o texto parcial
-- e nunca enviada de volta ao modelo como contexto.
CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel TEXT NOT NULL CHECK (channel IN ('fora_de_cena', 'cena')),
    scene_id INTEGER REFERENCES scenes (id),
    role TEXT NOT NULL CHECK (role IN ('narrador', 'jogador')),
    content TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 20000),
    status TEXT NOT NULL DEFAULT 'concluida' CHECK (status IN ('concluida', 'cancelada')),
    created_at TEXT NOT NULL,
    CHECK ((channel = 'cena') = (scene_id IS NOT NULL))
);

CREATE INDEX messages_by_channel ON messages (channel, scene_id, id);
