/**
 * Genereert de één-pagina A4-infographic "Overzicht functies" in de
 * Kleurblok-huisstijl: donkere hero + statstrook + drie kolommen (website,
 * beheerpaneel, relatiebeheerder) met badge-iconen; de voorlichter-werkstroom
 * staat als stepper in de relatiebeheerder-kolom. Deelt de inhoud met
 * build-overzicht.mjs.
 *
 *   node scripts/overzicht/build-infographic.mjs
 *
 * Uitvoer: docs/overzicht-functies-1a4.pdf  (HTML -> headless Chrome)
 */
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { C, secties, DATUM, URL } from './build-overzicht.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const FONTS = join(ROOT, 'public', 'assets', 'fonts');
const OUT = join(ROOT, 'docs', 'overzicht-functies-1a4.pdf');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const black = readFileSync(join(FONTS, 'archivo-black.woff2')).toString('base64');
const varf = readFileSync(join(FONTS, 'archivo-var.woff2')).toString('base64');

const MONUMENT = '12.11';
// Kerncijfers (spiegelen de D1-data: beroepen met voorlichter, rondes,
// in-gebruik-lokalen, publieke voorlichters).
const STATS = [
  ['100', 'workshops', C.blauw],
  ['3', 'rondes', C.geel],
  ['49', 'lokalen', C.groen],
  ['169', 'voorlichters', C.roze],
];

const strip = Object.values(C)
  .filter((c) => c !== C.ink)
  .map((c) => `<span style="background:${c}"></span>`)
  .join('');

function kolom(s) {
  const items = s.items
    .map(
      ([emoji, titel, tekst]) =>
        `<div class="it"><div class="it__ic" style="background:${s.kleur}1f;border-color:${s.kleur}55">${emoji}</div><div class="it__tx"><b>${titel}</b><span>${tekst}</span></div></div>`
    )
    .join('');
  const flow = s.flow
    ? `<div class="stepper">
        <div class="stepper__lab" style="color:${s.kleur}">Werkstroom</div>
        ${s.flow
          .map((f, i) => `<div class="step"><span class="step__n" style="background:${s.kleur}">${i + 1}</span>${f}</div>`)
          .join('')}
      </div>`
    : '';
  return `<div class="col">
    <div class="col__head" style="background:${s.kleur}">
      <span class="col__nr">${s.nr}</span>
      <span class="col__t">${s.titel}</span>
    </div>
    <div class="col__sub">${s.sub}</div>
    <div class="col__items">${items}</div>
    ${flow}
  </div>`;
}

const html = `<!DOCTYPE html><html lang="nl"><head><meta charset="utf-8">
<style>
@font-face{font-family:'Archivo Black';src:url(data:font/woff2;base64,${black}) format('woff2');font-weight:400;font-display:block}
@font-face{font-family:'Archivo';src:url(data:font/woff2;base64,${varf}) format('woff2');font-weight:100 900;font-display:block}
@page{size:A4;margin:0}
*{margin:0;padding:0;box-sizing:border-box}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:'Archivo',system-ui,sans-serif;color:${C.ink};background:#eef1f5}
.page{width:210mm;height:297mm;padding:10mm 10mm 8mm;box-sizing:border-box;display:flex;flex-direction:column;background:#eef1f5}
.tnum{font-variant-numeric:tabular-nums}

/* Hero */
.hero{position:relative;background:${C.ink};border-radius:16px;padding:16px 20px 0;color:#fff;overflow:hidden}
.hero__row{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding-bottom:14px}
.hero__eyebrow{font-weight:800;font-size:8.5pt;letter-spacing:.22em;text-transform:uppercase;color:${C.geel}}
.hero__title{font-family:'Archivo Black';font-size:37pt;line-height:.9;letter-spacing:-.02em;margin-top:4px}
.hero__tag{font-size:9pt;color:#c7ccd3;margin-top:7px;max-width:120mm;line-height:1.4}
.hero__right{text-align:right;flex:none}
.hero__mon{font-family:'Archivo Black';font-size:40pt;line-height:.8;color:${C.geel};letter-spacing:-.01em}
.hero__meta{font-size:8pt;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#c7ccd3;margin-top:6px;line-height:1.5}
.hero__strip{display:flex;height:8px}
.hero__strip span{flex:1}

/* Stats */
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:9px}
.stat{background:#fff;border:1px solid rgba(13,13,13,.08);border-radius:12px;padding:11px 13px;box-shadow:0 1px 2px rgba(13,13,13,.05),0 8px 20px -14px rgba(13,13,13,.25)}
.stat__n{font-family:'Archivo Black';font-size:25pt;line-height:.85;letter-spacing:-.02em}
.stat__l{font-size:8pt;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#5a6572;margin-top:5px}

/* Kolommen */
.cols{display:flex;gap:8px;margin-top:9px;flex:1;align-items:stretch}
.col{flex:1;background:#fff;border:1px solid rgba(13,13,13,.08);border-radius:14px;padding:0 0 11px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 1px 2px rgba(13,13,13,.05),0 10px 26px -16px rgba(13,13,13,.28)}
.col__head{display:flex;align-items:center;gap:9px;padding:11px 13px;color:#fff;min-height:52px}
.col__nr{font-family:'Archivo Black';font-size:16pt;line-height:.8;opacity:.85}
.col__t{font-family:'Archivo Black';font-size:12.5pt;line-height:.98;letter-spacing:-.01em}
.col__sub{font-size:7.7pt;font-weight:700;letter-spacing:.02em;text-transform:uppercase;color:#5a6572;padding:9px 13px 3px;min-height:34px}
.col__items{padding:0 13px}
.it{display:flex;gap:9px;align-items:flex-start;padding:7px 0;border-bottom:1px solid rgba(13,13,13,.07)}
.it:last-child{border-bottom:none}
.it__ic{flex:none;width:24px;height:24px;border-radius:50%;border:1px solid;display:flex;align-items:center;justify-content:center;font-size:10.5pt;line-height:1}
.it__tx b{display:block;font-family:'Archivo';font-weight:800;font-size:9pt;letter-spacing:-.01em}
.it__tx span{display:block;font-size:7.7pt;line-height:1.32;color:#3f4650;margin-top:1px}

/* Stepper (werkstroom in kolom 3) */
.stepper{margin:16px 13px 2px;margin-top:auto;padding:12px 13px;background:${C.ink};border-radius:11px;color:#fff}
.stepper__lab{font-size:7pt;font-weight:800;letter-spacing:.14em;text-transform:uppercase;margin-bottom:7px}
.step{display:flex;align-items:center;gap:8px;font-family:'Archivo Black';font-size:9.5pt;padding:3px 0}
.step__n{flex:none;width:17px;height:17px;border-radius:50%;color:#fff;font-size:8pt;display:flex;align-items:center;justify-content:center}

.pf{margin-top:9px;padding-top:8px;border-top:2px solid ${C.ink};display:flex;justify-content:space-between;font-size:8pt;font-weight:700;letter-spacing:.03em;text-transform:uppercase}
</style></head><body>
<div class="page">
  <div class="hero">
    <div class="hero__row">
      <div>
        <div class="hero__eyebrow">Beroepenavond Nijmegen</div>
        <div class="hero__title">Overzicht van<br>functies</div>
        <div class="hero__tag">De website, het beheerpaneel en het werk voor de relatiebeheerder, in één oogopslag.</div>
      </div>
      <div class="hero__right">
        <div class="hero__mon tnum">${MONUMENT}</div>
        <div class="hero__meta">${DATUM}<br>${URL}</div>
      </div>
    </div>
    <div class="hero__strip">${strip}</div>
  </div>

  <div class="stats">
    ${STATS.map(([n, l, c]) => `<div class="stat"><div class="stat__n tnum" style="color:${c}">${n}</div><div class="stat__l">${l}</div></div>`).join('')}
  </div>

  <div class="cols">${secties.map(kolom).join('')}</div>

  <footer class="pf"><span>Montessori College Nijmegen</span><span>${URL}</span></footer>
</div>
</body></html>`;

const dir = mkdtempSync(join(tmpdir(), 'infographic-'));
const htmlPath = join(dir, 'infographic.html');
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
