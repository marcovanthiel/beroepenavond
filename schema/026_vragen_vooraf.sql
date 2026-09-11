-- Vragen vooraf naar de voorlichter mailen (sept 2026).
-- Twee dagen voor de avond krijgt elke bevestigde voorlichter de tot dan
-- ingestuurde vragen voor zijn/haar beroep; de vragen die daarna nog
-- binnenkomen gaan mee in de ochtendmail van de avond zelf.

ALTER TABLE student_questions ADD COLUMN sent_to_speaker INTEGER NOT NULL DEFAULT 0;

-- Nieuwe, bewerkbare mailtekst (beheer → Mails). Placeholders:
-- {{naam}} {{datum}} {{locatie}} {{vragen}}
INSERT OR IGNORE INTO mail_templates (key, name, subject, body) VALUES
('vl_vragen', 'Voorlichter: vragen vooraf',
 'De vragen die leerlingen alvast voor je hebben',
 'Beste {{naam}},

Over twee dagen is het zover! Ter voorbereiding: dit zijn de vragen die leerlingen tot nu toe voor jouw beroep hebben ingestuurd. Handig om er in je verhaal alvast op in te spelen.

{{vragen}}

Je hoeft niets terug te sturen, neem ze gewoon mee. Komen er later nog vragen bij, dan sturen we je die op de ochtend van de avond zelf na.

Tot {{datum}}!');

-- Ochtendmail van de avond krijgt er een blok bij voor de late vragen
-- (alleen als er nieuwe vragen zijn; leeg blok wordt niet getoond).
UPDATE mail_templates
   SET body = body || char(10) || char(10) || '{{vragen}}'
 WHERE key = 'vl_eventdag' AND body NOT LIKE '%{{vragen}}%';
