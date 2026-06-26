/**
 * PDF-generatie voor het beheer (pure JS via pdf-lib — werkt in de Worker).
 * Nu: de "werflijst" van beroepen zonder voorlichter, met Rotary-logo erboven.
 */
import { PDFDocument, StandardFonts, rgb, type PDFPage } from 'pdf-lib';

const A4 = { w: 595.28, h: 841.89 };
const M = 50; // paginamarge (pt)

const LIME = rgb(0x88 / 255, 0xbc / 255, 0x1d / 255); // #88BC1D — website-accent (Beroepenavond)
const ROTARY_BLUE = rgb(0x17 / 255, 0x45 / 255, 0x8f / 255); // #17458f — logo-blauw / clubnaam
const INK = rgb(0.1, 0.11, 0.12);
const MUTED = rgb(0.42, 0.45, 0.49);

/** pdf-lib's standaardfonts gebruiken WinAnsi; vervang niet-codeerbare tekens. */
function winansi(s: string): string {
  const map: Record<string, string> = {
    '–': '-', '—': '-', '‘': "'", '’': "'", '“': '"', '”': '"', '•': '-', '…': '...',
  };
  return (s ?? '').replace(/[^\x00-\xFF]/g, (ch) => map[ch] ?? '?');
}

/** '#rrggbb' → pdf-lib rgb; valt terug op grijs bij ontbrekende/foute waarde. */
function hexToRgb(hex?: string | null) {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex ?? '').trim());
  if (!m) return rgb(0.55, 0.58, 0.62);
  const n = parseInt(m[1], 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

export interface WerflijstRow {
  categorie: string;
  beroep: string;
  color?: string | null;
}

export async function buildWerflijstPdf(opts: {
  logo: Uint8Array;
  rows: WerflijstRow[];
  dateLabel: string;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle('Werflijst — beroepen zonder voorlichter');
  pdf.setCreator('Beroepenavond Nijmegen');
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await pdf.embedPng(opts.logo);

  // Beroepen groeperen per categorie (incl. categoriekleur), brongvolgorde behouden.
  const groups: { naam: string; color: string | null; items: string[] }[] = [];
  for (const r of opts.rows) {
    const cat = r.categorie || 'Overig';
    let g = groups.find((x) => x.naam === cat);
    if (!g) { g = { naam: cat, color: r.color ?? null, items: [] }; groups.push(g); }
    g.items.push(r.beroep);
  }

  let page!: PDFPage;
  let y = 0;
  let pageNo = 0;
  const BOTTOM = 46;

  const text = (s: string, x: number, yy: number, size: number, f = font, color = INK) =>
    page.drawText(winansi(s), { x, y: yy, size, font: f, color });

  function footer() {
    page.drawText(
      winansi(`Beroepenavond Nijmegen · Rotary Club Nijmegen-Stad en Land · pagina ${pageNo}`),
      { x: M, y: 26, size: 8, font, color: MUTED }
    );
  }

  function newPage(first = false) {
    if (pageNo > 0) footer();
    page = pdf.addPage([A4.w, A4.h]);
    pageNo += 1;
    if (first) {
      const lw = 150;
      const lh = (160 / 400) * lw; // verhouding logo behouden (400×160)
      page.drawImage(logo, { x: M, y: A4.h - M - lh, width: lw, height: lh });
      // Clublogo-lockup: Rotary-merk + clubnaam in logo-blauw eronder.
      let ty = A4.h - M - lh - 16;
      text('Nijmegen-Stad en Land', M, ty, 13, bold, ROTARY_BLUE);
      ty -= 30;
      text('Werflijst voorlichters', M, ty, 20, bold, LIME);
      ty -= 18;
      text('Beroepen die nog géén voorlichter hebben — voor gerichte werving', M, ty, 11, font, MUTED);
      ty -= 14;
      text(`${opts.rows.length} openstaand · ${opts.dateLabel}`, M, ty, 10, font, MUTED);
      ty -= 16;
      page.drawLine({ start: { x: M, y: ty }, end: { x: A4.w - M, y: ty }, thickness: 1.2, color: LIME });
      y = ty - 26;
    } else {
      y = A4.h - M;
    }
  }

  newPage(true);

  if (!groups.length) {
    text('Elk beroep heeft al minstens één voorlichter — niets te werven.', M, y, 12, font, INK);
  }

  for (const g of groups) {
    if (y < BOTTOM + 42) newPage(); // categorie-kop + eerste item samenhouden
    const catColor = hexToRgb(g.color);
    // Gekleurd swatch-vierkantje vóór de categorienaam (zoals op de site).
    page.drawRectangle({ x: M, y: y - 1, width: 11, height: 11, color: catColor });
    text(`${g.naam}  (${g.items.length})`, M + 19, y, 12, bold, INK);
    y -= 19;
    for (const beroep of g.items) {
      if (y < BOTTOM) newPage();
      // Aanvinkvakje in de categoriekleur (gekleurd opsommingsteken, blijft afvinkbaar).
      page.drawRectangle({ x: M + 19, y: y - 1, width: 10, height: 10, borderColor: catColor, borderWidth: 1.4 });
      text(beroep, M + 37, y, 11, font, INK);
      y -= 16;
    }
    y -= 10; // ruimte tussen categorieën
  }
  footer();

  return await pdf.save();
}
