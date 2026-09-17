/**
 * Genereert een A4-PDF "Overzicht functies" in de Kleurblok-huisstijl van de
 * site (Archivo Black self-hosted, de zes categoriekleuren, zwart/wit-basis).
 * Drie secties: de website (publiek), het beheerpaneel en het werk voor de
 * relatiebeheerder (accountmanager).
 *
 * Rendert HTML -> PDF met headless Google Chrome (--print-to-pdf), dus zonder
 * extra dependencies. Fonts worden als base64 ingebed.
 *
 *   node scripts/overzicht/build-overzicht.mjs
 *
 * Uitvoer: docs/overzicht-functies-beroepenavond.pdf
 */
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const FONTS = join(ROOT, 'public', 'assets', 'fonts');
const OUT = join(ROOT, 'docs', 'overzicht-functies-beroepenavond.pdf');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const black = readFileSync(join(FONTS, 'archivo-black.woff2')).toString('base64');
const varf = readFileSync(join(FONTS, 'archivo-var.woff2')).toString('base64');

// Kleurblok-palet (zes categoriekleuren) + inkt.
export const C = { roze: '#E14B64', blauw: '#2E7ED4', geel: '#F0A400', groen: '#55862A', paars: '#8A4FD0', teal: '#0A9B9B', ink: '#0d0d0d' };

export const DATUM = 'Donderdag 12 november 2026';
export const URL = 'beroepenavond2026.nl';

// --- Inhoud (gedeeld met build-infographic.mjs) ---------------------------
export const secties = [
  {
    kleur: C.blauw,
    nr: '01',
    titel: 'De website',
    sub: 'Voor leerlingen, voorlichters en bezoekers',
    intro:
      'Een snelle, toegankelijke site waar leerlingen hun avond samenstellen en professionals zich aanmelden als voorlichter.',
    items: [
      ['🏠', 'Herkenbare homepage', 'Datummonument, jaarfiguur en de zes vakgebieden als kleurstrip.'],
      ['🧭', 'Alle beroepen', 'Per vakgebied uitklapbaar, met leesbare webadressen (bv. /beroepen/architect).'],
      ['📄', 'Beroeppagina', 'Uitleg, de voorlichters, ronde en lokaal, plus vragen vooraf stellen.'],
      ['🗺️', 'Interactieve plattegrond', 'Klikbare lokalen per verdieping; niet-gebruikte ruimten staan gedimd.'],
      ['🎓', 'Mijn avond (leerlingen)', 'Inloggen met alleen e-mail, beroepen kiezen, vragen stellen, rooster als agenda (.ics).'],
      ['✉️', 'Voorlichter worden', 'Aanmeldformulier met spamfilter en robotcheck.'],
      ['📣', 'Nieuws, vragen, contact', 'Nieuwsberichten, veelgestelde vragen, contact en nieuwsbrief.'],
      ['♿', 'Toegankelijk & privacy', 'Streeft naar WCAG 2.2 AA (EAA) en werkt AVG-proof.'],
      ['🔎', 'Goed vindbaar', 'Sitemap, rich-result-data en snelle laadtijd; campagneposter te downloaden.'],
      ['📱', 'Vlot op elk scherm', 'Werkt even goed op telefoon, tablet en laptop.'],
    ],
  },
  {
    kleur: C.teal,
    nr: '02',
    titel: 'Het beheerpaneel',
    sub: 'Alles achter de schermen, zonder technische kennis',
    intro:
      'Een compleet CMS: van de content en het programma tot de e-mails en de plattegrond. Werkt ook op tablet en telefoon.',
    items: [
      ['🔐', 'Veilig inloggen', 'Met een e-mailcode (geen wachtwoord) en rollen per medewerker.'],
      ['✅', 'Overzicht + checklist', 'Dashboard met "klaar voor de avond?" en directe snelacties.'],
      ['🗂️', 'Inhoud', "Pagina's, instellingen, nieuws en sponsoren beheren."],
      ['📅', 'Evenement', 'Edities, rondes, categorieën en beroepen.'],
      ['🎤', 'Voorlichters', 'Toevoegen, foto, aan een beroep koppelen en bevestigen (ook in bulk).'],
      ['🚪', 'Lokalen', 'Aanvinklijst wel/niet gebruikt en smartboard; sorteren en filteren op elke kolom.'],
      ['✏️', 'Plattegronden', 'Plattegrond-editor om lokalen op de kaart te tekenen.'],
      ['🧩', 'Automatische indeling', 'Sprekers en lokalen worden met één klik automatisch over de rondes ingedeeld, volledig binnen de website; beroepen met veel leerlingen krijgen een groot lokaal.'],
      ['📊', 'Leerlingenaantallen', 'Per beroep het aantal leerlingen per editie; de evaluaties van de voorlichters vullen het jaar zelf automatisch in.'],
      ['📥', 'Communicatie', 'Formulieren, inkomende e-mail, uitgaande mail met sjablonen en planning, uitnodigingen, nieuwsbrief, evaluaties.'],
      ['🖼️', 'Systeem', 'Mediatheek, gebruikers en rollen, logboek, versiebeheer en eigen account.'],
    ],
  },
  {
    kleur: C.roze,
    nr: '03',
    titel: 'De relatiebeheerder',
    sub: 'De accountmanager van de voorlichters',
    intro:
      'Een eigen rol met precies de juiste rechten: alles inzien, en de complete voorlichter-werkstroom beheren. De rest staat op alleen-lezen.',
    items: [
      ['🤝', 'Voorlichters beheren', 'Gegevens, foto, koppeling aan een beroep en bevestiging (los of in bulk).'],
      ['✉️', 'Uitnodigen', 'Losse adressen of in bulk de voorlichters van vorig jaar; herinnering gaat automatisch na 7 dagen.'],
      ['📝', 'Aanmeldingen afhandelen', 'Formulierinzendingen bekijken en met één klik omzetten naar een voorlichter.'],
      ['🎯', 'Gericht werven', 'Overzicht van beroepen zonder voorlichter, zodat je precies weet wie je nog zoekt.'],
      ['❓', 'Vragen vooraf', 'De vragen van leerlingen bereiken de juiste voorlichter.'],
      ['👤', 'Eigen account', 'Eigen naam beheren; overige onderdelen zichtbaar maar alleen-lezen.'],
    ],
    flow: ['Uitnodigen', 'Bevestigen', 'Indelen', 'Indelingsmail'],
  },
];

// --- HTML -----------------------------------------------------------------
const strip = Object.values(C)
  .filter((c) => c !== C.ink)
  .map((c) => `<span style="background:${c}"></span>`)
  .join('');

function card([emoji, titel, tekst], kleur) {
  return `<div class="card">
    <div class="card__tag" style="background:${kleur}"></div>
    <div class="card__ic">${emoji}</div>
    <div><h3>${titel}</h3><p>${tekst}</p></div>
  </div>`;
}

function sectie(s, eerste) {
  const flow = s.flow
    ? `<div class="flow">${s.flow
        .map((f, i) => `<span class="flow__step">${f}</span>${i < s.flow.length - 1 ? '<span class="flow__ar">→</span>' : ''}`)
        .join('')}</div>`
    : '';
  return `<section class="page${eerste ? ' page--first' : ''}">
    <header class="ph">
      <div class="ph__top">
        <div>
          <div class="ph__eyebrow">Beroepenavond Nijmegen</div>
          <div class="ph__doc">Overzicht van functies</div>
        </div>
        <div class="ph__mon" style="color:${s.kleur}">${s.nr}</div>
      </div>
      <div class="strip">${strip}</div>
    </header>
    <div class="body">
      <div class="sec-title">
        <span class="sec-title__sq" style="background:${s.kleur}"></span>
        <div>
          <h2>${s.titel}</h2>
          <div class="sec-title__sub">${s.sub}</div>
        </div>
      </div>
      <p class="intro">${s.intro}</p>
      <div class="grid">${s.items.map((it) => card(it, s.kleur)).join('')}</div>
      ${flow}
    </div>
    <footer class="pf"><span>${URL}</span><span>${DATUM}</span></footer>
  </section>`;
}

const html = `<!DOCTYPE html><html lang="nl"><head><meta charset="utf-8">
<style>
@font-face{font-family:'Archivo Black';src:url(data:font/woff2;base64,${black}) format('woff2');font-weight:400;font-display:block}
@font-face{font-family:'Archivo';src:url(data:font/woff2;base64,${varf}) format('woff2');font-weight:100 900;font-display:block}
@page{size:A4;margin:0}
*{margin:0;padding:0;box-sizing:border-box}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:'Archivo',system-ui,sans-serif;color:${C.ink}}
.page{width:210mm;height:297mm;padding:15mm 16mm 12mm;box-sizing:border-box;position:relative;display:flex;flex-direction:column;page-break-after:always;overflow:hidden}
.page:last-child{page-break-after:auto}
.ph__top{display:flex;justify-content:space-between;align-items:flex-start}
.ph__eyebrow{font-weight:700;font-size:10pt;letter-spacing:.16em;text-transform:uppercase;color:${C.ink}}
.ph__doc{font-family:'Archivo Black';font-size:15pt;margin-top:2px}
.ph__mon{font-family:'Archivo Black';font-size:34pt;line-height:.8}
.strip{display:flex;height:7px;margin-top:10px;border-radius:4px;overflow:hidden}
.strip span{flex:1}
.body{flex:1;display:flex;flex-direction:column;justify-content:center;padding:8mm 0}
.sec-title{display:flex;gap:14px;align-items:center}
.sec-title__sq{width:36px;height:36px;border-radius:7px;flex:none}
.sec-title h2{font-family:'Archivo Black';font-size:32pt;line-height:.95;letter-spacing:-.01em}
.sec-title__sub{font-size:11.5pt;color:#444;margin-top:3px;font-weight:600}
.intro{font-size:11.5pt;line-height:1.55;color:#333;margin-top:14px;max-width:165mm}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-top:20px}
.card{position:relative;display:flex;gap:12px;align-items:flex-start;border:1px solid #e6e8ea;border-radius:12px;padding:15px 16px 15px 18px;overflow:hidden;break-inside:avoid;box-shadow:0 1px 2px rgba(0,0,0,.04)}
.card__tag{position:absolute;left:0;top:0;bottom:0;width:6px}
.card__ic{font-size:18pt;line-height:1;flex:none}
.card h3{font-family:'Archivo';font-weight:800;font-size:11.5pt;letter-spacing:-.01em}
.card p{font-size:9.6pt;line-height:1.45;color:#444;margin-top:3px}
.flow{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:22px;padding:16px 18px;background:${C.ink};border-radius:12px}
.flow__step{font-family:'Archivo Black';font-size:12pt;color:#fff}
.flow__ar{color:${C.roze};font-size:14pt;font-weight:800}
.pf{margin-top:auto;padding-top:10px;border-top:2px solid ${C.ink};display:flex;justify-content:space-between;font-size:9pt;font-weight:700;letter-spacing:.03em;text-transform:uppercase;color:${C.ink}}
</style></head><body>
${secties.map((s, i) => sectie(s, i === 0)).join('')}
</body></html>`;

// Alleen renderen als dit script direct wordt uitgevoerd (niet bij import).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dir = mkdtempSync(join(tmpdir(), 'overzicht-'));
  const htmlPath = join(dir, 'overzicht.html');
  writeFileSync(htmlPath, html);
  execFileSync(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-pdf-header-footer',
      '--run-all-compositor-stages-before-draw',
      '--virtual-time-budget=3000',
      `--print-to-pdf=${OUT}`,
      `file://${htmlPath}`,
    ],
    { stdio: 'ignore' }
  );
  console.log('PDF geschreven:', OUT);
}
