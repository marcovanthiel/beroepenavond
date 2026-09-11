-- Locatiecorrectie (11-9-2026): de Beroepenavond is in het Montessori
-- College Nijmegen (Kwakkenbergweg 27), niet in het Canisius College.
UPDATE settings SET value = 'Montessori College Nijmegen' WHERE key = 'venue_name';
UPDATE settings SET value = 'Kwakkenbergweg 27, 6523 MJ Nijmegen' WHERE key = 'venue_address';
UPDATE events SET venue_name = 'Montessori College Nijmegen',
                  venue_address = 'Kwakkenbergweg 27, 6523 MJ Nijmegen';
UPDATE events SET intro_md = REPLACE(intro_md, 'Canisius College', 'Montessori College');
UPDATE pages SET
  body_md = REPLACE(REPLACE(body_md, 'Canisius College', 'Montessori College'), 'Berg en Dalseweg 207, 6522 BR Nijmegen', 'Kwakkenbergweg 27, 6523 MJ Nijmegen'),
  hero_lede = REPLACE(COALESCE(hero_lede,''), 'Canisius College', 'Montessori College'),
  meta_description = REPLACE(COALESCE(meta_description,''), 'Canisius College', 'Montessori College'),
  title = REPLACE(title, 'Canisius College', 'Montessori College');
UPDATE mail_templates SET body = REPLACE(body, 'Canisius College', 'Montessori College');
