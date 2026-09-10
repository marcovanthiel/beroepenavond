/**
 * Het jaarfiguur en de categorie-pictogrammen (herontwerp 2026).
 *
 * Vormentaal naar Otl Aicher (München 1972): cirkel-hoofd los van de romp,
 * romp en ledematen als dikke strokes met ronde uiteinden en knikken op ~45
 * graden. Het jaarfiguur bestaat altijd in drie gedaanten (man, vrouw, X),
 * onderscheiden via haarvorm; de site wisselt de gedaante per dag af.
 *
 * 2026 = de chirurg. Een nieuw jaar = nieuwe beroepslaag hier toevoegen en
 * de settings `jaarfiguur_beroep` + `jaarfiguur_kleur` bijwerken.
 */

export type Gedaante = 'man' | 'vrouw' | 'x';

/** Deterministische wissel per dag (cache-veilig, geen random per request). */
export function gedaanteVanVandaag(): Gedaante {
  const nu = new Date();
  const start = Date.UTC(nu.getUTCFullYear(), 0, 0);
  const dag = Math.floor((nu.getTime() - start) / 86400000);
  return (['man', 'vrouw', 'x'] as const)[dag % 3];
}

const GEDAANTE_LABEL: Record<Gedaante, string> = {
  man: 'man', vrouw: 'vrouw', x: 'X',
};

/**
 * Jaarfiguur 2026: de chirurg. `figuur` = hoofdkleur van het figuur,
 * `detail` = kleur van de negatieve details (mondkapje, stethoscoop, hand).
 * Op een gekleurd vlak: figuur wit, detail = vlakkleur. Op wit: andersom.
 */
export function jaarfiguurSvg(opts: {
  gedaante: Gedaante;
  figuur: string;
  detail: string;
  beroep: string;
}): string {
  const F = opts.figuur;
  const D = opts.detail;
  const haar =
    opts.gedaante === 'vrouw'
      ? `<circle cx="87" cy="35" r="7" fill="${F}"/>`
      : opts.gedaante === 'x'
        ? `<path d="M55 32 q-4 9 -1 17" stroke="${F}" stroke-width="6.5" stroke-linecap="round" fill="none"/>`
        : '';
  return `<svg viewBox="0 0 150 196" role="img" aria-label="Jaarfiguur: ${esc(opts.beroep)} (${GEDAANTE_LABEL[opts.gedaante]})">
    <path d="M55 30 a15 14 0 0 1 30 0 z" fill="${F}"/>
    ${haar}
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

/**
 * Klein wit pictogram per categorie (wegwijzer-vormentaal). `gat` = de
 * achtergrondkleur voor uitsparingen (alleen techniek gebruikt die).
 */
export function categoriePictogram(categoryId: string, gat: string): string {
  const p: Record<string, string> = {
    cat_creatief: '<rect x="13" y="2" width="6" height="15" rx="2" fill="#fff"/><polygon points="12,17 20,17 16,28" fill="#fff"/>',
    cat_zorg: '<rect x="12" y="4" width="8" height="24" fill="#fff"/><rect x="4" y="12" width="24" height="8" fill="#fff"/>',
    cat_handel: '<rect x="4" y="18" width="6" height="10" fill="#fff"/><rect x="13" y="11" width="6" height="17" fill="#fff"/><rect x="22" y="4" width="6" height="24" fill="#fff"/>',
    cat_maats: '<polygon points="16,2 28,7 26,20 16,30 6,20 4,7" fill="#fff"/>',
    cat_onderwijs: '<rect x="4" y="5" width="24" height="16" rx="3" fill="#fff"/><polygon points="9,21 9,29 17,21" fill="#fff"/>',
    cat_techniek: `<polygon points="16,3 27,9.5 27,22.5 16,29 5,22.5 5,9.5" fill="#fff"/><circle cx="16" cy="16" r="5" fill="${gat}"/>`,
  };
  const inhoud = p[categoryId] ?? '<circle cx="16" cy="16" r="12" fill="#fff"/>';
  return `<svg viewBox="0 0 32 32" aria-hidden="true">${inhoud}</svg>`;
}

/** Kiest leesbare tekstkleur (donker of wit) op een hex-achtergrond. */
export function tekstOp(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return '#ffffff';
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq > 150 ? '#0d0d0d' : '#ffffff';
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
