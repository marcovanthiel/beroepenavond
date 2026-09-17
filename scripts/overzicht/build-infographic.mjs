/**
 * Genereert de één-pagina A4-infographic "Overzicht functies" in de
 * Kleurblok-huisstijl: drie kolommen (website, beheerpaneel, relatiebeheerder)
 * naast elkaar + een workflow-balk. Deelt de inhoud met build-overzicht.mjs.
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

const strip = Object.values(C)
  .filter((c) => c !== C.ink)
  .map((c) => `<span style="background:${c}"></span>`)
  .join('');

function kolom(s) {
  const items = s.items
    .map(
      ([emoji, titel, tekst]) =>
        `<div class="it"><div class="it__ic">${emoji}</div><div><b>${titel}</b><span>${tekst}</span></div></div>`
    )
    .join('');
  return `<div class="col" style="background:${s.kleur}12">
    <div class="col__head" style="background:${s.kleur}">
      <div class="col__nr">${s.nr}</div>
      <div><h2>${s.titel}</h2><div class="col__sub">${s.sub}</div></div>
    </div>
    <div class="col__items">${items}</div>
  </div>`;
}

const flow = secties.find((s) => s.flow)?.flow ?? [];
const flowHtml = flow.length
  ? `<div class="flow"><span class="flow__lab">Werkstroom voorlichters</span>${flow
      .map((f, i) => `<span class="flow__step">${f}</span>${i < flow.length - 1 ? '<span class="flow__ar">→</span>' : ''}`)
      .join('')}</div>`
  : '';

const html = `<!DOCTYPE html><html lang="nl"><head><meta charset="utf-8">
<style>
@font-face{font-family:'Archivo Black';src:url(data:font/woff2;base64,${black}) format('woff2');font-weight:400;font-display:block}
@font-face{font-family:'Archivo';src:url(data:font/woff2;base64,${varf}) format('woff2');font-weight:100 900;font-display:block}
@page{size:A4;margin:0}
*{margin:0;padding:0;box-sizing:border-box}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:'Archivo',system-ui,sans-serif;color:${C.ink}}
.page{width:210mm;height:297mm;padding:11mm 11mm 9mm;box-sizing:border-box;display:flex;flex-direction:column}
.head{display:flex;justify-content:space-between;align-items:flex-end}
.head__eyebrow{font-weight:700;font-size:9pt;letter-spacing:.16em;text-transform:uppercase}
.head__title{font-family:'Archivo Black';font-size:26pt;line-height:.9;margin-top:2px}
.head__meta{text-align:right;font-size:8.5pt;font-weight:700;letter-spacing:.02em;text-transform:uppercase;line-height:1.5}
.head__meta b{color:${C.ink}}
.strip{display:flex;height:7px;margin-top:9px;border-radius:4px;overflow:hidden}
.strip span{flex:1}
.lead{font-size:9.5pt;color:#444;margin-top:9px;max-width:180mm;line-height:1.45}
.cols{display:flex;gap:5mm;margin-top:10px;flex:1}
.col{flex:1;border-radius:12px;overflow:hidden;display:flex;flex-direction:column}
.col__head{display:flex;gap:9px;align-items:center;padding:11px 12px;color:#fff}
.col__nr{font-family:'Archivo Black';font-size:20pt;line-height:.8;opacity:.9}
.col__head h2{font-family:'Archivo Black';font-size:13.5pt;line-height:.95;letter-spacing:-.01em}
.col__sub{font-size:7.6pt;font-weight:600;margin-top:2px;opacity:.95}
.col__items{padding:4px 12px 12px}
.it{display:flex;gap:8px;align-items:flex-start;padding:7px 0;border-bottom:1px solid rgba(13,13,13,.09)}
.it:last-child{border-bottom:none}
.it__ic{font-size:12.5pt;line-height:1.15;flex:none;width:20px;text-align:center}
.it b{display:block;font-family:'Archivo';font-weight:800;font-size:9pt;letter-spacing:-.01em}
.it span{display:block;font-size:7.7pt;line-height:1.32;color:#3a3a3a;margin-top:1px}
.flow{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-top:9px;padding:11px 14px;background:${C.ink};border-radius:11px}
.flow__lab{font-size:7.5pt;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#9aa0a6;margin-right:4px}
.flow__step{font-family:'Archivo Black';font-size:11pt;color:#fff}
.flow__ar{color:${C.roze};font-size:12pt;font-weight:800}
.pf{margin-top:9px;padding-top:8px;border-top:2px solid ${C.ink};display:flex;justify-content:space-between;font-size:8pt;font-weight:700;letter-spacing:.03em;text-transform:uppercase}
</style></head><body>
<div class="page">
  <div class="head">
    <div>
      <div class="head__eyebrow">Beroepenavond Nijmegen</div>
      <div class="head__title">Overzicht van functies</div>
    </div>
    <div class="head__meta"><b>${URL}</b><br>${DATUM}</div>
  </div>
  <div class="strip">${strip}</div>
  <p class="lead">De website, het beheerpaneel en het werk voor de relatiebeheerder in één oogopslag.</p>
  <div class="cols">${secties.map(kolom).join('')}</div>
  ${flowHtml}
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
