-- Sessie 6 — koppel een sessie ook aan een beroep (naast lokaal/ronde/spreker).
ALTER TABLE sessions_program ADD COLUMN beroep_id INTEGER REFERENCES beroepen(id);
CREATE INDEX IF NOT EXISTS sessions_beroep_idx ON sessions_program(beroep_id);
