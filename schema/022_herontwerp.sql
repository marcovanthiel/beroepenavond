-- Herontwerp 2026 ("Kleurblok"): geharmoniseerd kleurpalet + jaarfiguur-
-- instellingen + beroepenpagina onder /beroepen.
-- De zes categoriekleuren behouden hun herkenbare tint maar krijgen
-- gelijke verzadiging/donkerte (tekstcontrast per kleur via code).

UPDATE categories SET color = '#E14B64' WHERE id = 'cat_creatief';
UPDATE categories SET color = '#2E7ED4' WHERE id = 'cat_zorg';
UPDATE categories SET color = '#F0A400' WHERE id = 'cat_handel';
UPDATE categories SET color = '#55862A' WHERE id = 'cat_maats';
UPDATE categories SET color = '#8A4FD0' WHERE id = 'cat_onderwijs';
UPDATE categories SET color = '#0A9B9B' WHERE id = 'cat_techniek';

-- Jaarfiguur: elk jaar één beroep als gezicht van de editie (drie
-- gedaanten wisselen automatisch). Kleur = het vlak achter het figuur.
INSERT INTO settings (key, value) VALUES
  ('jaarfiguur_beroep', 'de chirurg'),
  ('jaarfiguur_kleur', '#2E7ED4'),
  ('edition_label', '25e')
ON CONFLICT(key) DO UPDATE SET value = excluded.value;

-- De beroepencatalogus verhuist van /uitleg-beroepen naar /beroepen
-- (nieuwe treklijsten-pagina; oude URL redirect in de Worker).
UPDATE pages SET slug = '/beroepen', nav_label = 'Beroepen'
 WHERE slug = '/uitleg-beroepen';

-- Schrijfstijl: geen en-dashes; tijden met "tot".
UPDATE settings SET value = REPLACE(REPLACE(value, ' – ', ' tot '), '–', ' tot ')
 WHERE key = 'event_time' AND value LIKE '%–%';
