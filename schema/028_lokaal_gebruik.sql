-- 028_lokaal_gebruik.sql
-- Vlag per lokaal: wordt het op de avond gebruikt of niet?
-- In beheer -> Lokalen staat een aanvinklijst van alle ruimten; dit veld
-- bewaart de keuze. Standaard AAN voor de les-, leerplein- en bijzondere
-- ruimten (die een kaartvlak hebben), UIT voor de dienstruimten (kantoren,
-- bergingen, techniek) zonder kaartvlak. Marco stelt het daarna bij.
ALTER TABLE classrooms ADD COLUMN in_use INTEGER NOT NULL DEFAULT 1;
UPDATE classrooms SET in_use = 0 WHERE map_shape IS NULL OR map_shape = '';
