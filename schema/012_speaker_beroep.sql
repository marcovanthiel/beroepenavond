-- Sessie 5 — koppeling spreker → beroep (uit de bestaande beroepenlijst).
-- Categorie van de spreker volgt het gekozen beroep. Nullable: een spreker
-- mag (nog) geen beroep hebben, en een beroep mag (nog) geen spreker hebben.
ALTER TABLE speakers ADD COLUMN beroep_id INTEGER REFERENCES beroepen(id);
CREATE INDEX IF NOT EXISTS speakers_beroep_idx ON speakers(beroep_id);
