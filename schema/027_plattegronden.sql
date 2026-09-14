-- 027_plattegronden.sql
-- Plattegronden Montessori College Nijmegen, bouwdeel BC, bouwlaag 0 tot en met 4.
-- Gedigitaliseerd uit de scan 'Beuk nummering ruimtes definitief'
-- (clipL2R interieurarchitecten, tek. B100 t/m B105, update 30 oktober 2013).
-- Achtergrond per bouwlaag: /assets/plattegrond/<slug>.svg
-- Klikvlakken staan als rect in classrooms.map_shape, in hetzelfde
-- coordinatenstelsel als de viewBox van die bouwlaag.

DELETE FROM classrooms WHERE id LIKE 'cr_mcn_%';
DELETE FROM floorplans WHERE id LIKE 'fp_mcn_%';

INSERT INTO floorplans (id, event_id, floor_slug, floor_label, image_url, viewbox, sort_order)
  SELECT 'fp_mcn_bouwlaag-0', id, 'bouwlaag-0', 'Bouwlaag 0',
         '/assets/plattegrond/bouwlaag-0.svg', '0 0 986 644', 10
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO floorplans (id, event_id, floor_slug, floor_label, image_url, viewbox, sort_order)
  SELECT 'fp_mcn_bouwlaag-1', id, 'bouwlaag-1', 'Bouwlaag 1',
         '/assets/plattegrond/bouwlaag-1.svg', '0 0 874 303', 20
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO floorplans (id, event_id, floor_slug, floor_label, image_url, viewbox, sort_order)
  SELECT 'fp_mcn_bouwlaag-2', id, 'bouwlaag-2', 'Bouwlaag 2',
         '/assets/plattegrond/bouwlaag-2.svg', '0 0 882 340', 30
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO floorplans (id, event_id, floor_slug, floor_label, image_url, viewbox, sort_order)
  SELECT 'fp_mcn_bouwlaag-3', id, 'bouwlaag-3', 'Bouwlaag 3',
         '/assets/plattegrond/bouwlaag-3.svg', '0 0 874 302', 40
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO floorplans (id, event_id, floor_slug, floor_label, image_url, viewbox, sort_order)
  SELECT 'fp_mcn_bouwlaag-4', id, 'bouwlaag-4', 'Bouwlaag 4',
         '/assets/plattegrond/bouwlaag-4.svg', '0 0 887 348', 50
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;

-- Bouwlaag 0: Begane grond met de hoofdingang, receptie, aula en presentatiezaal.
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_015', id, '015', 'Theorielokaal (60 m2)', 'Bouwlaag 0', NULL,
         '{"shape":"rect","x":28,"y":25,"w":102,"h":110}', 'bouwlaag-0', 'les'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_014', id, '014', 'Theorielokaal (56 m2)', 'Bouwlaag 0', NULL,
         '{"shape":"rect","x":136,"y":25,"w":95,"h":110}', 'bouwlaag-0', 'les'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_013', id, '013', 'Theorielokaal (56 m2)', 'Bouwlaag 0', NULL,
         '{"shape":"rect","x":238,"y":25,"w":95,"h":109}', 'bouwlaag-0', 'les'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_012', id, '012', 'Theorielokaal (60 m2)', 'Bouwlaag 0', NULL,
         '{"shape":"rect","x":340,"y":25,"w":101,"h":110}', 'bouwlaag-0', 'les'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_011', id, '011', 'Theorielokaal (73 m2)', 'Bouwlaag 0', NULL,
         '{"shape":"rect","x":448,"y":25,"w":89,"h":153}', 'bouwlaag-0', 'les'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_005', id, '005', 'Theorielokaal (74 m2)', 'Bouwlaag 0', NULL,
         '{"shape":"rect","x":544,"y":24,"w":92,"h":154}', 'bouwlaag-0', 'les'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_004', id, '004', 'Theorielokaal (59 m2)', 'Bouwlaag 0', NULL,
         '{"shape":"rect","x":642,"y":24,"w":100,"h":112}', 'bouwlaag-0', 'les'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_003', id, '003', 'Theorielokaal (56 m2)', 'Bouwlaag 0', NULL,
         '{"shape":"rect","x":748,"y":23,"w":96,"h":110}', 'bouwlaag-0', 'les'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_002', id, '002', 'Theorielokaal (64 m2)', 'Bouwlaag 0', NULL,
         '{"shape":"rect","x":851,"y":22,"w":110,"h":110}', 'bouwlaag-0', 'les'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_010', id, '010', 'Studeerkamer (30 m2)', 'Bouwlaag 0', NULL,
         '{"shape":"rect","x":270,"y":142,"w":110,"h":58}', 'bouwlaag-0', 'open'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_001', id, '001', 'Studeerkamer (26 m2)', 'Bouwlaag 0', NULL,
         '{"shape":"rect","x":710,"y":140,"w":100,"h":52}', 'bouwlaag-0', 'open'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_016', id, '016', 'Kernteam (21 m2)', 'Bouwlaag 0', NULL,
         NULL, 'bouwlaag-0', 'dienst'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_009', id, '009', 'Keuken (30 m2)', 'Bouwlaag 0', NULL,
         NULL, 'bouwlaag-0', 'dienst'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_006', id, '006', 'Kernteam (17 m2)', 'Bouwlaag 0', NULL,
         NULL, 'bouwlaag-0', 'dienst'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_007', id, '007', 'Receptie (33 m2)', 'Bouwlaag 0', NULL,
         NULL, 'bouwlaag-0', 'dienst'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_038', id, '038', 'Schoolmaatschappelijk werk (10 m2)', 'Bouwlaag 0', NULL,
         NULL, 'bouwlaag-0', 'dienst'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_037', id, '037', 'Stagecoordinator (10 m2)', 'Bouwlaag 0', NULL,
         NULL, 'bouwlaag-0', 'dienst'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_036', id, '036', 'Centrale kopie (19 m2)', 'Bouwlaag 0', NULL,
         NULL, 'bouwlaag-0', 'dienst'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_035', id, '035', 'Werkkast (18 m2)', 'Bouwlaag 0', NULL,
         NULL, 'bouwlaag-0', 'dienst'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_008', id, '008', 'Berging aula (18 m2)', 'Bouwlaag 0', NULL,
         NULL, 'bouwlaag-0', 'dienst'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_033', id, '033', 'Personeelsruimte locatieondersteuning (16 m2)', 'Bouwlaag 0', NULL,
         NULL, 'bouwlaag-0', 'dienst'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_031', id, '031', 'Personeelsruimte zorgcoordinator (21 m2)', 'Bouwlaag 0', NULL,
         NULL, 'bouwlaag-0', 'dienst'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_030', id, '030', 'Personeelsruimte remediatie (24 m2)', 'Bouwlaag 0', NULL,
         NULL, 'bouwlaag-0', 'dienst'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_029', id, '029', 'Personeelsruimte locatieadministratie (41 m2)', 'Bouwlaag 0', NULL,
         NULL, 'bouwlaag-0', 'dienst'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_028', id, '028', 'Personeelsruimte coach (18 m2)', 'Bouwlaag 0', NULL,
         NULL, 'bouwlaag-0', 'dienst'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_027', id, '027', 'Personeelsruimte roosterkamer (18 m2)', 'Bouwlaag 0', NULL,
         NULL, 'bouwlaag-0', 'dienst'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_025', id, '025', 'Personeelsruimte directie onderbouw (28 m2)', 'Bouwlaag 0', NULL,
         NULL, 'bouwlaag-0', 'dienst'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_034', id, '034', 'EHBO en artsenkamer (11 m2)', 'Bouwlaag 0', NULL,
         NULL, 'bouwlaag-0', 'dienst'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_032', id, '032', 'Archief', 'Bouwlaag 0', NULL,
         NULL, 'bouwlaag-0', 'dienst'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_023', id, '023', 'Conciergeloge (22 m2)', 'Bouwlaag 0', NULL,
         NULL, 'bouwlaag-0', 'dienst'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_026', id, '026', 'Spreekkamer (12 m2)', 'Bouwlaag 0', NULL,
         NULL, 'bouwlaag-0', 'dienst'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_024', id, '024', 'Spreekkamer (12 m2)', 'Bouwlaag 0', NULL,
         NULL, 'bouwlaag-0', 'dienst'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_022', id, '022', 'Presentatiezaal (132 m2)', 'Bouwlaag 0', NULL,
         '{"shape":"rect","x":309,"y":376,"w":120,"h":225}', 'bouwlaag-0', 'bijz'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_021', id, '021', 'Praktijklokaal muziek (69 m2)', 'Bouwlaag 0', NULL,
         '{"shape":"rect","x":444,"y":407,"w":90,"h":190}', 'bouwlaag-0', 'les'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_018', id, '018', 'Technische ruimte (5 m2)', 'Bouwlaag 0', NULL,
         NULL, 'bouwlaag-0', 'dienst'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_017', id, '017', 'Berging (2 m2)', 'Bouwlaag 0', NULL,
         NULL, 'bouwlaag-0', 'dienst'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_019', id, '019', 'Spreekkamer (13 m2)', 'Bouwlaag 0', NULL,
         NULL, 'bouwlaag-0', 'dienst'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_020', id, '020', 'Praktijklokaal expressie (67 m2)', 'Bouwlaag 0', NULL,
         '{"shape":"rect","x":540,"y":472,"w":107,"h":125}', 'bouwlaag-0', 'les'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_000', id, '000', 'Aula en kantine', 'Bouwlaag 0', NULL,
         '{"shape":"rect","x":652,"y":374,"w":305,"h":222}', 'bouwlaag-0', 'bijz'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;

-- Bouwlaag 1: Noordvleugel met theorielokalen onderbouw.
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_114', id, '114', 'Theorielokaal onderbouw (59 m2)', 'Bouwlaag 1', NULL,
         '{"shape":"rect","x":25,"y":35,"w":100,"h":108}', 'bouwlaag-1', 'les'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_113', id, '113', 'Theorielokaal onderbouw (56 m2)', 'Bouwlaag 1', NULL,
         '{"shape":"rect","x":132,"y":35,"w":94,"h":112}', 'bouwlaag-1', 'les'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_112', id, '112', 'Theorielokaal onderbouw (60 m2)', 'Bouwlaag 1', NULL,
         '{"shape":"rect","x":234,"y":34,"w":102,"h":108}', 'bouwlaag-1', 'les'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_111', id, '111', 'Theorielokaal onderbouw (67 m2)', 'Bouwlaag 1', NULL,
         '{"shape":"rect","x":343,"y":32,"w":91,"h":142}', 'bouwlaag-1', 'les'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_105', id, '105', 'Theorielokaal onderbouw (68 m2)', 'Bouwlaag 1', NULL,
         '{"shape":"rect","x":437,"y":33,"w":89,"h":140}', 'bouwlaag-1', 'les'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_104', id, '104', 'Theorielokaal onderbouw (60 m2)', 'Bouwlaag 1', NULL,
         '{"shape":"rect","x":533,"y":18,"w":101,"h":109}', 'bouwlaag-1', 'les'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_103', id, '103', 'Theorielokaal onderbouw (56 m2)', 'Bouwlaag 1', NULL,
         '{"shape":"rect","x":640,"y":17,"w":96,"h":108}', 'bouwlaag-1', 'les'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_102', id, '102', 'Theorielokaal onderbouw (64 m2)', 'Bouwlaag 1', NULL,
         '{"shape":"rect","x":743,"y":16,"w":111,"h":109}', 'bouwlaag-1', 'les'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_110', id, '110', 'Studeerkamer (24 m2)', 'Bouwlaag 1', NULL,
         '{"shape":"rect","x":161,"y":137,"w":110,"h":58}', 'bouwlaag-1', 'open'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_101', id, '101', 'Studeerkamer (16 m2)', 'Bouwlaag 1', NULL,
         '{"shape":"rect","x":593,"y":133,"w":100,"h":50}', 'bouwlaag-1', 'open'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_115', id, '115', 'Kernteam (15 m2)', 'Bouwlaag 1', NULL,
         NULL, 'bouwlaag-1', 'dienst'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_100', id, '100', 'Repro (5 m2)', 'Bouwlaag 1', NULL,
         NULL, 'bouwlaag-1', 'dienst'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_106', id, '106', 'Kernteam (20 m2)', 'Bouwlaag 1', NULL,
         NULL, 'bouwlaag-1', 'dienst'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;

-- Bouwlaag 2: Zuidvleugel met de praktijklokalen voor kunst en vormgeving.
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_208', id, '208', 'Praktijklokaal tekenen (63 m2)', 'Bouwlaag 2', NULL,
         '{"shape":"rect","x":16,"y":58,"w":85,"h":142}', 'bouwlaag-2', 'les'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_207', id, '207', 'Praktijklokaal tekenen (75 m2)', 'Bouwlaag 2', NULL,
         '{"shape":"rect","x":148,"y":58,"w":86,"h":142}', 'bouwlaag-2', 'les'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_206', id, '206', 'Praktijklokaal CKV (77 m2)', 'Bouwlaag 2', NULL,
         '{"shape":"rect","x":281,"y":58,"w":118,"h":142}', 'bouwlaag-2', 'les'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_205', id, '205', 'Praktijklokaal handvaardigheid grof (75 m2)', 'Bouwlaag 2', NULL,
         '{"shape":"rect","x":399,"y":58,"w":82,"h":142}', 'bouwlaag-2', 'les'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_204', id, '204', 'Praktijklokaal handvaardigheid fijn (62 m2)', 'Bouwlaag 2', NULL,
         '{"shape":"rect","x":534,"y":58,"w":102,"h":142}', 'bouwlaag-2', 'les'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_202', id, '202', 'Serverruimte (26 m2)', 'Bouwlaag 2', NULL,
         NULL, 'bouwlaag-2', 'dienst'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_201', id, '201', 'Medewerkers ICT (25 m2)', 'Bouwlaag 2', NULL,
         NULL, 'bouwlaag-2', 'dienst'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_203', id, '203', 'Personeelskamer (171 m2)', 'Bouwlaag 2', NULL,
         '{"shape":"rect","x":636,"y":140,"w":230,"h":158}', 'bouwlaag-2', 'bijz'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;

-- Bouwlaag 3: Noordvleugel met theorielokalen bovenbouw.
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_314', id, '314', 'Theorielokaal bovenbouw (59 m2)', 'Bouwlaag 3', NULL,
         '{"shape":"rect","x":25,"y":34,"w":100,"h":109}', 'bouwlaag-3', 'les'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_313', id, '313', 'Theorielokaal bovenbouw (56 m2)', 'Bouwlaag 3', NULL,
         '{"shape":"rect","x":132,"y":34,"w":95,"h":109}', 'bouwlaag-3', 'les'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_312', id, '312', 'Theorielokaal bovenbouw (60 m2)', 'Bouwlaag 3', NULL,
         '{"shape":"rect","x":234,"y":34,"w":102,"h":109}', 'bouwlaag-3', 'les'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_311', id, '311', 'Theorielokaal bovenbouw (67 m2)', 'Bouwlaag 3', NULL,
         '{"shape":"rect","x":343,"y":33,"w":87,"h":141}', 'bouwlaag-3', 'les'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_305', id, '305', 'Theorielokaal bovenbouw (67 m2)', 'Bouwlaag 3', NULL,
         '{"shape":"rect","x":438,"y":33,"w":87,"h":140}', 'bouwlaag-3', 'les'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_304', id, '304', 'Theorielokaal bovenbouw (60 m2)', 'Bouwlaag 3', NULL,
         '{"shape":"rect","x":532,"y":17,"w":102,"h":111}', 'bouwlaag-3', 'les'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_303', id, '303', 'Theorielokaal bovenbouw (56 m2)', 'Bouwlaag 3', NULL,
         '{"shape":"rect","x":640,"y":17,"w":95,"h":110}', 'bouwlaag-3', 'les'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_302', id, '302', 'Theorielokaal bovenbouw (63 m2)', 'Bouwlaag 3', NULL,
         '{"shape":"rect","x":743,"y":16,"w":110,"h":109}', 'bouwlaag-3', 'les'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_310', id, '310', 'Studeerkamer (21 m2)', 'Bouwlaag 3', NULL,
         '{"shape":"rect","x":164,"y":138,"w":110,"h":58}', 'bouwlaag-3', 'open'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_301', id, '301', 'Studeerkamer (22 m2)', 'Bouwlaag 3', NULL,
         '{"shape":"rect","x":594,"y":132,"w":100,"h":50}', 'bouwlaag-3', 'open'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_315', id, '315', 'Kernteam (21 m2)', 'Bouwlaag 3', NULL,
         NULL, 'bouwlaag-3', 'dienst'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_300', id, '300', 'Repro', 'Bouwlaag 3', NULL,
         NULL, 'bouwlaag-3', 'dienst'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_307', id, '307', 'Serverruimte (5 m2)', 'Bouwlaag 3', NULL,
         NULL, 'bouwlaag-3', 'dienst'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_308', id, '308', 'Berging binas (13 m2)', 'Bouwlaag 3', NULL,
         NULL, 'bouwlaag-3', 'dienst'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_306', id, '306', 'Kernteam (14 m2)', 'Bouwlaag 3', NULL,
         NULL, 'bouwlaag-3', 'dienst'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;

-- Bouwlaag 4: Zuidvleugel met de binas-praktijklokalen.
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_411', id, '411', 'Praktijklokaal biologie (69 m2)', 'Bouwlaag 4', NULL,
         '{"shape":"rect","x":16,"y":60,"w":108,"h":143}', 'bouwlaag-4', 'les'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_410', id, '410', 'Praktijklokaal biologie (81 m2)', 'Bouwlaag 4', NULL,
         '{"shape":"rect","x":124,"y":60,"w":130,"h":143}', 'bouwlaag-4', 'les'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_409', id, '409', 'Praktijklokaal scheikunde (81 m2)', 'Bouwlaag 4', NULL,
         '{"shape":"rect","x":254,"y":60,"w":122,"h":143}', 'bouwlaag-4', 'les'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_408', id, '408', 'Praktijklokaal TOA (30 m2)', 'Bouwlaag 4', NULL,
         NULL, 'bouwlaag-4', 'dienst'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_407', id, '407', 'Chemicalienopslag (11 m2)', 'Bouwlaag 4', NULL,
         NULL, 'bouwlaag-4', 'dienst'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_406', id, '406', 'Praktijklokaal leerlingenlab (49 m2)', 'Bouwlaag 4', NULL,
         '{"shape":"rect","x":471,"y":63,"w":66,"h":140}', 'bouwlaag-4', 'les'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_405', id, '405', 'Praktijklokaal natuurkunde (69 m2)', 'Bouwlaag 4', NULL,
         '{"shape":"rect","x":546,"y":63,"w":95,"h":140}', 'bouwlaag-4', 'les'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_404', id, '404', 'Kernteam (14 m2)', 'Bouwlaag 4', NULL,
         NULL, 'bouwlaag-4', 'dienst'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_403', id, '403', 'Praktijklokaal biologie (69 m2)', 'Bouwlaag 4', NULL,
         '{"shape":"rect","x":638,"y":144,"w":101,"h":157}', 'bouwlaag-4', 'les'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_401', id, '401', 'Praktijklokaal nask (38 m2)', 'Bouwlaag 4', NULL,
         '{"shape":"rect","x":769,"y":60,"w":100,"h":78}', 'bouwlaag-4', 'les'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;
INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)
  SELECT 'cr_mcn_402', id, '402', 'Praktijklokaal natuurkunde (84 m2)', 'Bouwlaag 4', NULL,
         '{"shape":"rect","x":761,"y":148,"w":105,"h":155}', 'bouwlaag-4', 'les'
    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;

