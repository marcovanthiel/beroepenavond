-- 029_lokaal_shapes.sql
-- Dienstruimten (kantoren, bergingen, techniek) kregen in 027 geen
-- map_shape, waardoor ze niet op de publieke plattegrond stonden. Marco
-- wil ze wel tonen, maar gedimd (de viewer dimt in_use = 0). Hier krijgen
-- ze alsnog hun klikvlak; in_use blijft ongemoeid (028 bepaalt dat).
-- Coordinaten uit dezelfde framing als 027. Idempotent.

UPDATE classrooms SET map_shape = '{"shape":"rect","x":57,"y":216,"w":40,"h":46}', map_floor = 'bouwlaag-0' WHERE id = 'cr_mcn_016' AND (map_shape IS NULL OR map_shape = '');
UPDATE classrooms SET map_shape = '{"shape":"rect","x":432,"y":180,"w":52,"h":74}', map_floor = 'bouwlaag-0' WHERE id = 'cr_mcn_009' AND (map_shape IS NULL OR map_shape = '');
UPDATE classrooms SET map_shape = '{"shape":"rect","x":639,"y":199,"w":50,"h":62}', map_floor = 'bouwlaag-0' WHERE id = 'cr_mcn_006' AND (map_shape IS NULL OR map_shape = '');
UPDATE classrooms SET map_shape = '{"shape":"rect","x":745,"y":199,"w":62,"h":57}', map_floor = 'bouwlaag-0' WHERE id = 'cr_mcn_007' AND (map_shape IS NULL OR map_shape = '');
UPDATE classrooms SET map_shape = '{"shape":"rect","x":17,"y":268,"w":50,"h":40}', map_floor = 'bouwlaag-0' WHERE id = 'cr_mcn_038' AND (map_shape IS NULL OR map_shape = '');
UPDATE classrooms SET map_shape = '{"shape":"rect","x":67,"y":268,"w":42,"h":40}', map_floor = 'bouwlaag-0' WHERE id = 'cr_mcn_037' AND (map_shape IS NULL OR map_shape = '');
UPDATE classrooms SET map_shape = '{"shape":"rect","x":116,"y":270,"w":81,"h":40}', map_floor = 'bouwlaag-0' WHERE id = 'cr_mcn_036' AND (map_shape IS NULL OR map_shape = '');
UPDATE classrooms SET map_shape = '{"shape":"rect","x":272,"y":268,"w":60,"h":40}', map_floor = 'bouwlaag-0' WHERE id = 'cr_mcn_035' AND (map_shape IS NULL OR map_shape = '');
UPDATE classrooms SET map_shape = '{"shape":"rect","x":647,"y":268,"w":45,"h":42}', map_floor = 'bouwlaag-0' WHERE id = 'cr_mcn_008' AND (map_shape IS NULL OR map_shape = '');
UPDATE classrooms SET map_shape = '{"shape":"rect","x":16,"y":372,"w":88,"h":40}', map_floor = 'bouwlaag-0' WHERE id = 'cr_mcn_033' AND (map_shape IS NULL OR map_shape = '');
UPDATE classrooms SET map_shape = '{"shape":"rect","x":20,"y":417,"w":81,"h":47}', map_floor = 'bouwlaag-0' WHERE id = 'cr_mcn_031' AND (map_shape IS NULL OR map_shape = '');
UPDATE classrooms SET map_shape = '{"shape":"rect","x":19,"y":469,"w":82,"h":53}', map_floor = 'bouwlaag-0' WHERE id = 'cr_mcn_030' AND (map_shape IS NULL OR map_shape = '');
UPDATE classrooms SET map_shape = '{"shape":"rect","x":16,"y":524,"w":112,"h":77}', map_floor = 'bouwlaag-0' WHERE id = 'cr_mcn_029' AND (map_shape IS NULL OR map_shape = '');
UPDATE classrooms SET map_shape = '{"shape":"rect","x":133,"y":527,"w":45,"h":74}', map_floor = 'bouwlaag-0' WHERE id = 'cr_mcn_028' AND (map_shape IS NULL OR map_shape = '');
UPDATE classrooms SET map_shape = '{"shape":"rect","x":184,"y":524,"w":50,"h":77}', map_floor = 'bouwlaag-0' WHERE id = 'cr_mcn_027' AND (map_shape IS NULL OR map_shape = '');
UPDATE classrooms SET map_shape = '{"shape":"rect","x":235,"y":524,"w":74,"h":77}', map_floor = 'bouwlaag-0' WHERE id = 'cr_mcn_025' AND (map_shape IS NULL OR map_shape = '');
UPDATE classrooms SET map_shape = '{"shape":"rect","x":137,"y":370,"w":44,"h":55}', map_floor = 'bouwlaag-0' WHERE id = 'cr_mcn_034' AND (map_shape IS NULL OR map_shape = '');
UPDATE classrooms SET map_shape = '{"shape":"rect","x":137,"y":427,"w":44,"h":24}', map_floor = 'bouwlaag-0' WHERE id = 'cr_mcn_032' AND (map_shape IS NULL OR map_shape = '');
UPDATE classrooms SET map_shape = '{"shape":"rect","x":182,"y":370,"w":103,"h":45}', map_floor = 'bouwlaag-0' WHERE id = 'cr_mcn_023' AND (map_shape IS NULL OR map_shape = '');
UPDATE classrooms SET map_shape = '{"shape":"rect","x":182,"y":450,"w":50,"h":50}', map_floor = 'bouwlaag-0' WHERE id = 'cr_mcn_026' AND (map_shape IS NULL OR map_shape = '');
UPDATE classrooms SET map_shape = '{"shape":"rect","x":233,"y":450,"w":52,"h":50}', map_floor = 'bouwlaag-0' WHERE id = 'cr_mcn_024' AND (map_shape IS NULL OR map_shape = '');
UPDATE classrooms SET map_shape = '{"shape":"rect","x":436,"y":376,"w":42,"h":26}', map_floor = 'bouwlaag-0' WHERE id = 'cr_mcn_018' AND (map_shape IS NULL OR map_shape = '');
UPDATE classrooms SET map_shape = '{"shape":"rect","x":508,"y":376,"w":36,"h":26}', map_floor = 'bouwlaag-0' WHERE id = 'cr_mcn_017' AND (map_shape IS NULL OR map_shape = '');
UPDATE classrooms SET map_shape = '{"shape":"rect","x":592,"y":372,"w":42,"h":32}', map_floor = 'bouwlaag-0' WHERE id = 'cr_mcn_019' AND (map_shape IS NULL OR map_shape = '');
UPDATE classrooms SET map_shape = '{"shape":"rect","x":146,"y":203,"w":50,"h":52}', map_floor = 'bouwlaag-1' WHERE id = 'cr_mcn_115' AND (map_shape IS NULL OR map_shape = '');
UPDATE classrooms SET map_shape = '{"shape":"rect","x":567,"y":183,"w":32,"h":28}', map_floor = 'bouwlaag-1' WHERE id = 'cr_mcn_100' AND (map_shape IS NULL OR map_shape = '');
UPDATE classrooms SET map_shape = '{"shape":"rect","x":661,"y":187,"w":46,"h":48}', map_floor = 'bouwlaag-1' WHERE id = 'cr_mcn_106' AND (map_shape IS NULL OR map_shape = '');
UPDATE classrooms SET map_shape = '{"shape":"rect","x":738,"y":56,"w":68,"h":74}', map_floor = 'bouwlaag-2' WHERE id = 'cr_mcn_202' AND (map_shape IS NULL OR map_shape = '');
UPDATE classrooms SET map_shape = '{"shape":"rect","x":806,"y":56,"w":60,"h":74}', map_floor = 'bouwlaag-2' WHERE id = 'cr_mcn_201' AND (map_shape IS NULL OR map_shape = '');
UPDATE classrooms SET map_shape = '{"shape":"rect","x":148,"y":208,"w":90,"h":43}', map_floor = 'bouwlaag-3' WHERE id = 'cr_mcn_315' AND (map_shape IS NULL OR map_shape = '');
UPDATE classrooms SET map_shape = '{"shape":"rect","x":566,"y":188,"w":32,"h":28}', map_floor = 'bouwlaag-3' WHERE id = 'cr_mcn_300' AND (map_shape IS NULL OR map_shape = '');
UPDATE classrooms SET map_shape = '{"shape":"rect","x":634,"y":186,"w":32,"h":28}', map_floor = 'bouwlaag-3' WHERE id = 'cr_mcn_307' AND (map_shape IS NULL OR map_shape = '');
UPDATE classrooms SET map_shape = '{"shape":"rect","x":624,"y":228,"w":58,"h":30}', map_floor = 'bouwlaag-3' WHERE id = 'cr_mcn_308' AND (map_shape IS NULL OR map_shape = '');
UPDATE classrooms SET map_shape = '{"shape":"rect","x":698,"y":212,"w":48,"h":34}', map_floor = 'bouwlaag-3' WHERE id = 'cr_mcn_306' AND (map_shape IS NULL OR map_shape = '');
UPDATE classrooms SET map_shape = '{"shape":"rect","x":401,"y":108,"w":55,"h":95}', map_floor = 'bouwlaag-4' WHERE id = 'cr_mcn_408' AND (map_shape IS NULL OR map_shape = '');
UPDATE classrooms SET map_shape = '{"shape":"rect","x":401,"y":63,"w":48,"h":43}', map_floor = 'bouwlaag-4' WHERE id = 'cr_mcn_407' AND (map_shape IS NULL OR map_shape = '');
UPDATE classrooms SET map_shape = '{"shape":"rect","x":651,"y":63,"w":55,"h":45}', map_floor = 'bouwlaag-4' WHERE id = 'cr_mcn_404' AND (map_shape IS NULL OR map_shape = '');
