-- Um retrato restaurado acompanha o estado SQLite e é publicado na mesma transação.
ALTER TABLE character ADD COLUMN portrait_snapshot BLOB;
