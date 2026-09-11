/**
 * Genereert de campagneposter (A3, PDF) voor de Beroepenavond.
 *
 * Vormentaal = het herontwerp "Kleurblok": Archivo Black self-hosted, het
 * datummonument dd.mm als hoofdmotief, de zes categoriekleuren als signatuur
 * en het jaarfiguur (2026 = de chirurg) in drie gedaanten (m/v/X), naar
 * src/views/figuur.ts.
 *
 * Bron van waarheid voor datum/locatie is de D1-settings-tabel; de constanten
 * hieronder spiegelen die. Wijzig ze bij een nieuwe editie en draai opnieuw:
 *
 *   node scripts/poster/build-poster.mjs
 *
 * Vereist Playwright (globaal geïnstalleerd; wordt via `npm root -g` gevonden).
 * Uitvoer: public/assets/campagneposter-beroepenavond-2026.pdf
 * Deploy verloopt zoals altijd via push naar main (GitHub = bron).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const GP = execSync('npm root -g').toString().trim();
const { chromium } = require(join(GP, 'playwright'));

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const FONTS = join(ROOT, 'public', 'assets', 'fonts');
const OUT = join(ROOT, 'public', 'assets', 'campagneposter-beroepenavond-2026.pdf');

// --- Editie-gegevens (spiegelen de D1-settings) ---------------------------
const MONUMENT = '12.11';
const DATUM_LANG = 'Donderdag 12 november 2026';
const TIJD = '18:30–21:30 uur';
const VENUE = 'Montessori College Nijmegen';
const VENUE_ADRES = 'Kwakkenbergweg 27, Nijmegen';
const URL = 'beroepenavond2026.nl';
const BLUE = '#2E7ED4'; // jaarfiguur_kleur

const black = readFileSync(join(FONTS, 'archivo-black.woff2')).toString('base64');
const varf = readFileSync(join(FONTS, 'archivo-var.woff2')).toString('base64');

// --- Jaarfiguur (de chirurg), port van src/views/figuur.ts ----------------
function figuur(gedaante, F, D) {
  const haar =
    gedaante === 'vrouw' ? `<circle cx="87" cy="35" r="7" fill="${F}"/>` :
    gedaante === 'x' ? `<path d="M55 32 q-4 9 -1 17" stroke="${F}" stroke-width="6.5" stroke-linecap="round" fill="none"/>` : '';
  return `<svg viewBox="0 0 150 196" xmlns="http://www.w3.org/2000/svg">
    <path d="M55 30 a15 14 0 0 1 30 0 z" fill="${F}"/>${haar}
    <circle cx="70" cy="42" r="14" fill="${F}"/>
    <rect x="60" y="44" width="20" height="9" rx="4" fill="${D}"/>
    <path d="M70 68 L70 112" stroke="${F}" stroke-width="36" stroke-linecap="round" fill="none"/>
    <path d="M61 64 C61 82 79 82 79 64" stroke="${D}" stroke-width="3.2" fill="none"/>
    <circle cx="70" cy="84" r="4.2" fill="${D}"/>
    <path d="M85 70 L100 55" stroke="${F}" stroke-width="15" stroke-linecap="round" fill="none"/>
    <circle cx="103" cy="52" r="7" fill="${D}"/>
    <path d="M103 45 L103 30" stroke="${F}" stroke-width="5" stroke-linecap="round"/>
    <polygon points="100,30 106,30 103,19" fill="${F}"/>
    <path d="M54 72 L48 94 L54 108" stroke="${F}" stroke-width="15" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M63 120 L58 146 L56 176" stroke="${F}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M77 120 L86 144 L92 170" stroke="${F}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </svg>`;
}

const CATS = [
  { pic: '<rect x="13" y="2" width="6" height="15" rx="2" fill="#fff"/><polygon points="12,17 20,17 16,28" fill="#fff"/>', name: 'Creatieve beroepen', c: '#E14B64' },
  { pic: '<rect x="12" y="4" width="8" height="24" fill="#fff"/><rect x="4" y="12" width="24" height="8" fill="#fff"/>', name: 'Gezondheidszorg &amp; welzijn', c: '#2E7ED4' },
  { pic: '<rect x="4" y="18" width="6" height="10" fill="#fff"/><rect x="13" y="11" width="6" height="17" fill="#fff"/><rect x="22" y="4" width="6" height="24" fill="#fff"/>', name: 'Handel &amp; economie', c: '#F0A400' },
  { pic: '<polygon points="16,2 28,7 26,20 16,30 6,20 4,7" fill="#fff"/>', name: 'Maatschappelijk &amp; uniform', c: '#55862A' },
  { pic: '<rect x="4" y="5" width="24" height="16" rx="3" fill="#fff"/><polygon points="9,21 9,29 17,21" fill="#fff"/>', name: 'Onderwijs &amp; communicatie', c: '#8A4FD0' },
  { pic: (g) => `<polygon points="16,3 27,9.5 27,22.5 16,29 5,22.5 5,9.5" fill="#fff"/><circle cx="16" cy="16" r="5" fill="${g}"/>`, name: 'Techniek', c: '#0A9B9B' },
];

const catBlocks = CATS.map((k) => {
  const pic = typeof k.pic === 'function' ? k.pic(k.c) : k.pic;
  const tc = k.c === '#F0A400' ? '#0d0d0d' : '#fff';
  return `<div class="cat" style="background:${k.c};color:${tc}">
    <svg class="cat__ico" viewBox="0 0 32 32">${pic.replace(/#fff/g, tc)}</svg>
    <span class="cat__nm">${k.name}</span></div>`;
}).join('');

const html = `<!doctype html><html lang="nl"><head><meta charset="utf-8"><style>
@font-face{font-family:'Archivo';font-style:normal;font-weight:100 900;font-display:block;src:url(data:font/woff2;base64,${varf}) format('woff2')}
@font-face{font-family:'Archivo Black';font-style:normal;font-weight:400;font-display:block;src:url(data:font/woff2;base64,${black}) format('woff2')}
@page{size:297mm 420mm;margin:0}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:297mm;height:420mm}
body{font-family:'Archivo',sans-serif;color:#0d0d0d;background:#fff;-webkit-font-smoothing:antialiased}
.poster{width:297mm;height:420mm;position:relative;display:flex;flex-direction:column;overflow:hidden}
.zb{font-family:'Archivo Black',sans-serif;font-weight:400}
.top{background:#0d0d0d;color:#fff;padding:13mm 16mm 11mm}
.top .word{font-size:18.5mm;line-height:.9;letter-spacing:-.015em;white-space:nowrap}
.top .word em{font-style:normal;opacity:.5;font-size:8.5mm;letter-spacing:.02em;margin-left:3mm}
.top .sub{margin-top:4.5mm;font-weight:700;text-transform:uppercase;letter-spacing:.13em;font-size:4mm}
.hero{padding:11mm 16mm 9mm;display:flex;flex-direction:column;justify-content:center}
.hero .eyebrow{font-weight:800;text-transform:uppercase;letter-spacing:.11em;font-size:5.4mm;color:${BLUE}}
.hero h1{font-size:125mm;line-height:.74;letter-spacing:-.035em;margin:2mm 0 3mm;white-space:nowrap}
.hero .tijd{font-weight:800;font-size:7.2mm;letter-spacing:.005em}
.hero .tijd b{color:${BLUE}}
.figs{background:${BLUE};color:#fff;flex:1;display:grid;grid-template-columns:1fr auto;align-items:center;gap:8mm;padding:7mm 16mm}
.figs .claim{max-width:96mm}
.figs .claim h2{font-size:9mm;line-height:.98;letter-spacing:-.01em}
.figs .claim p{margin-top:4mm;font-weight:600;font-size:4.6mm;line-height:1.28}
.trip{display:flex;align-items:flex-end;gap:5mm}
.figwrap{display:flex;flex-direction:column;align-items:center}
.figwrap svg{height:72mm;width:auto;display:block}
.figwrap span{font-weight:800;font-size:3.6mm;letter-spacing:.14em;text-transform:uppercase;margin-top:3mm;opacity:.92}
.cats{display:grid;grid-template-columns:repeat(3,1fr);grid-auto-rows:30mm}
.cat{display:flex;flex-direction:column;justify-content:space-between;padding:5.5mm}
.cat__ico{width:10mm;height:10mm}
.cat__nm{font-weight:800;font-size:4.3mm;line-height:1.08;letter-spacing:-.005em}
.info{display:grid;grid-template-columns:1fr 1fr;background:#0d0d0d;color:#fff}
.info .cell{padding:8mm 16mm}
.info .cell + .cell{border-left:.5mm solid #333}
.info .k{text-transform:uppercase;letter-spacing:.14em;font-size:3.3mm;font-weight:700;color:#8f8f8f;margin-bottom:2.5mm}
.info .v{font-weight:800;font-size:4.9mm;line-height:1.28}
.url{background:${BLUE};color:#fff;text-align:center;padding:8mm 6mm 9mm}
.url .u{font-size:13mm;line-height:1;letter-spacing:-.015em}
.url .o{margin-top:4mm;font-weight:600;font-size:3.6mm;letter-spacing:.02em;opacity:.95}
</style></head><body>
<div class="poster">
  <div class="top">
    <div class="word zb">BEROEPENAVOND<em class="zb">NIJMEGEN</em></div>
    <div class="sub">Ontdek in één avond welk beroep bij jou past</div>
  </div>
  <div class="hero">
    <div class="eyebrow">${DATUM_LANG} · ${TIJD}</div>
    <h1 class="zb">${MONUMENT}</h1>
    <div class="tijd">Circa 70 beroepen · zo'n 90 voorlichters · <b>gratis toegang</b></div>
  </div>
  <div class="figs">
    <div class="claim">
      <h2 class="zb">Eén beroep, drie gezichten.</h2>
      <p>Van chirurg tot softwareontwikkelaar: ontdek welk vak bij jóu past. Voor leerlingen van het voortgezet onderwijs én hun ouders.</p>
    </div>
    <div class="trip">
      <div class="figwrap">${figuur('man', '#fff', BLUE)}<span>Hij</span></div>
      <div class="figwrap">${figuur('vrouw', '#fff', BLUE)}<span>Zij</span></div>
      <div class="figwrap">${figuur('x', '#fff', BLUE)}<span>X</span></div>
    </div>
  </div>
  <div class="cats">${catBlocks}</div>
  <div class="info">
    <div class="cell"><div class="k">Waar</div><div class="v">${VENUE}<br>${VENUE_ADRES}</div></div>
    <div class="cell"><div class="k">Wanneer</div><div class="v">${DATUM_LANG}<br>18:30 tot 21:30 uur</div></div>
  </div>
  <div class="url">
    <div class="u zb">${URL}</div>
    <div class="o">Rotary Club Nijmegen-Stad en Land · decanen voortgezet onderwijs · Montessori College</div>
  </div>
</div>
</body></html>`;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1122, height: 1587 } });
await p.setContent(html, { waitUntil: 'networkidle' });
await p.waitForTimeout(400);
// Auto-fit het datummonument binnen de marge (robuust voor elke datum)
await p.evaluate(() => {
  const h = document.querySelector('.hero h1');
  let fs = parseFloat(getComputedStyle(h).fontSize);
  let guard = 0;
  while (h.scrollWidth > h.clientWidth && fs > 40 && guard++ < 200) { fs -= 3; h.style.fontSize = fs + 'px'; }
});
await p.waitForTimeout(150);
await p.pdf({ path: OUT, width: '297mm', height: '420mm', printBackground: true });
await b.close();
console.log('Poster geschreven:', OUT);
