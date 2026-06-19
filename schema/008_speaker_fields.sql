-- Sessie 4 — extra spreker-velden: LinkedIn + categorie-koppeling.
-- (SQLite ADD COLUMN met REFERENCES mag, default NULL.)
ALTER TABLE speakers ADD COLUMN linkedin TEXT;
ALTER TABLE speakers ADD COLUMN category_id TEXT REFERENCES categories(id);
CREATE INDEX IF NOT EXISTS speakers_category_idx ON speakers(category_id);
