-- 030_smartboard.sql
-- Extra eigenschap per lokaal: heeft het een smartboard (digibord)?
-- Ja/nee-vinkvak in beheer -> Lokalen. Standaard nee (0); Marco vinkt aan
-- welke lokalen er een hebben.
ALTER TABLE classrooms ADD COLUMN smartboard INTEGER NOT NULL DEFAULT 0;
