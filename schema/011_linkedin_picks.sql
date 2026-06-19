-- Sessie 4 — door Marco bevestigde LinkedIn-keuzes uit de twijfellijst. Idempotent.
UPDATE speakers SET linkedin='https://www.linkedin.com/in/marcovanthiel/' WHERE id='spk_imp_marco-van-thiel';
UPDATE speakers SET linkedin='https://www.linkedin.com/in/wouter-van-der-geest-3a623534/' WHERE id='spk_imp_wouter-van-der-geest';
UPDATE speakers SET linkedin='https://www.linkedin.com/in/caspar-pompe-3868343/' WHERE id='spk_imp_casper-pompe';
UPDATE speakers SET linkedin='https://www.linkedin.com/in/janvanaggelen/' WHERE id='spk_imp_jan-van-aggelen';
UPDATE speakers SET linkedin='https://www.linkedin.com/in/meijering/' WHERE id='spk_imp_john-meijering';
UPDATE speakers SET linkedin='https://www.linkedin.com/in/renske-gabrielle-snijders-334519175/' WHERE id='spk_imp_renske-snijders';
UPDATE speakers SET linkedin='https://www.linkedin.com/in/sabinevanwissen/' WHERE id='spk_imp_sabine-van-wissen';
-- correctie nummering: Sabine was abusievelijk gezet, hoort leeg; Myrthe + Sjoerd Roelofs toegevoegd
UPDATE speakers SET linkedin='https://www.linkedin.com/in/myrthe-schuurman-870529110/' WHERE id='spk_imp_myrthe-schuurmans';
UPDATE speakers SET linkedin=NULL WHERE id='spk_imp_sabine-van-wissen';
UPDATE speakers SET linkedin='https://www.linkedin.com/in/sgahroelofs/' WHERE id='spk_imp_sjoerd-roelofs';
UPDATE speakers SET linkedin='https://www.linkedin.com/in/susanne-versteeg-a8bb1b13/' WHERE id='spk_imp_susanne-versteeg';
UPDATE speakers SET linkedin='https://www.linkedin.com/in/wim-voet-19274b45/' WHERE id='spk_imp_wim-voet';
UPDATE speakers SET linkedin='https://www.linkedin.com/in/marc-rouppe-van-der-voort-a62a031/' WHERE id='spk_imp_marc-rouppe-van-der-voort';
UPDATE speakers SET linkedin='https://www.linkedin.com/in/jeroenbakkernijmegen/' WHERE id='spk_imp_jeroen-bakker';
