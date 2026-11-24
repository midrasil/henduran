-- 0002: semente do Mundo (ADR-077, item 5). O Mundo gerado e não editado guarda a semente
-- usada pelo gerador; o editado à mão, o criado do zero e o duplicado recebem uma semente nova
-- ao ser criados. Nula nos Mundos criados antes (a semente não foi guardada).
ALTER TABLE world_meta ADD COLUMN seed INTEGER CHECK (seed IS NULL OR seed BETWEEN 0 AND 9007199254740991);
