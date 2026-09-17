-- 032: leerlingenaantallen per beroep per editie (jaar).
-- Bron voor de lokaalindeling: een beroep dat vorig jaar veel leerlingen trok
-- krijgt een groot lokaal. Rijen ontstaan handmatig (statistiek van een eerdere
-- editie, ingevoerd in beheer) of automatisch uit de voorlichter-evaluaties van
-- de avond zelf (bron 'evaluatie'; een handmatige waarde wint altijd).
CREATE TABLE IF NOT EXISTS beroep_bezoek (
  beroep_id  INTEGER NOT NULL REFERENCES beroepen(id) ON DELETE CASCADE,
  jaar       INTEGER NOT NULL,
  aantal     INTEGER NOT NULL,
  bron       TEXT    NOT NULL DEFAULT 'handmatig',   -- handmatig | evaluatie
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (beroep_id, jaar)
);

CREATE INDEX IF NOT EXISTS idx_beroep_bezoek_jaar ON beroep_bezoek(jaar);
