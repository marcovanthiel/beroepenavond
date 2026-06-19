/**
 * Homepage — 1-op-1 nagebootst van beroepenavondnijmegen.nl
 * Sectie-volgorde komt direct uit de bron-HTML:
 *  - block-8a    "DONDERDAG 20 NOVEMBER"          (heading, 48px, links)
 *  - block-8b    "BEROEPENAVOND"                  (heading, 48px, links, #88bc1d)
 *  - block-9a    "2026"                           (heading, 185px, rechts)
 *  - block-9b    banner "Binnenkort alle informatie" (rgba(136,188,29,.25))
 *  - block-4     zwarte balk (sticky nav-placeholder, 50px)
 *  - block-92    accordion-categorieën
 *  - block-56    groene email-button (#88BC1D)
 *  - block-95a   organisatietekst, gecentreerd
 *  - block-95b   "Mede mogelijk gemaakt door" + Schrofenblick-logo
 *  - block-95c   © + Weijsters & Kooij credit
 *
 * Het mannetje (`/assets/img/mannetje.jpg`) staat als body-background:
 * right top, contain — zoals bronsite (#page-1369748).
 */
import type { Context } from 'hono';
import { html, raw } from 'hono/html';
import type { Env } from '../env';
import { getCategoriesWithBeroepen, getSettings } from '../lib/db';

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function renderHome(c: Context<{ Bindings: Env }>) {
  const [settings, cats] = await Promise.all([
    getSettings(c.env.DB),
    getCategoriesWithBeroepen(c.env.DB),
  ]);

  const eventYear = settings['event_year'] || '2026';
  const eventDate = settings['event_date_long'] || 'Donderdag 20 november 2026';
  const eventDateNoYear = eventDate.replace(/\s+\d{4}\s*$/, '').toUpperCase();
  const email = settings['contact_email'] || 'info@beroepenavondnijmegen.nl';

  const accordionHtml = cats
    .map(
      (cat) => `
        <article class="accordion-item">
          <button class="accordion-handle" type="button" aria-expanded="false">
            <span class="accordion-handle__label">${escape(cat.name)}</span>
            <svg class="accordion-arrow" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <div class="accordion-panel">
            <ul>
              ${cat.beroepen
                .map((b) => `<li>${escape(b.name)}</li>`)
                .join('\n              ')}
            </ul>
          </div>
        </article>`
    )
    .join('\n');

  const emailEntities = email
    .split('')
    .map((ch) => `&#${ch.charCodeAt(0)};`)
    .join('');

  return c.html(html`<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Beroepenavond ${eventYear} — Nijmegen</title>
<meta name="description" content="Donderdag 20 november 2026 — Beroepenavond Nijmegen. Voorlichtingsavond voor middelbare scholieren in Canisius College Nijmegen.">
<meta name="theme-color" content="#88bc1d">
<link rel="icon" href="/assets/img/favicon.png" type="image/png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/css/style.css">
</head>
<body class="home">

<div class="home-wrap">

  <!-- block-8a: "DONDERDAG 20 NOVEMBER" -->
  <section class="b-8a">
    <div class="b-inner">
      <h1 class="heading-2">${eventDateNoYear}</h1>
    </div>
  </section>

  <!-- block-8b: "BEROEPENAVOND" in lime -->
  <section class="b-8b">
    <div class="b-inner">
      <h2 class="heading-2 accent">BEROEPENAVOND</h2>
    </div>
  </section>

  <!-- block-9a: "2026" gigantisch rechts -->
  <section class="b-9a">
    <div class="b-inner">
      <h2 class="heading-year">${eventYear}</h2>
    </div>
  </section>

  <!-- block-9b: lichtgroene banner -->
  <section class="b-9b">
    <div class="b-inner">
      <h2 class="heading-banner"><span class="accent">Binnenkort</span> alle informatie</h2>
    </div>
  </section>

  <!-- block-4: zwarte sticky balk -->
  <header class="b-4" data-sticky></header>

  <!-- block-92: accordion -->
  <section class="b-92">
    <div class="b-inner">
      <div class="accordion" aria-label="Beroepen per categorie">
        ${raw(accordionHtml)}
      </div>
    </div>
  </section>

  <!-- block-56: groene email-button -->
  <section class="b-56">
    <div class="b-inner">
      <a class="email-btn" href="mailto:${raw(emailEntities)}">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path fill="currentColor" d="M12 12.713L.015 3h23.97L12 12.713zm0 2.574L0 5.562V21h24V5.562l-12 9.725z"/>
        </svg>
        <span>${raw(emailEntities)}</span>
      </a>
    </div>
  </section>

  <!-- block-95a: organisatie-tekst -->
  <footer class="b-95a">
    <div class="b-inner text-6">
      <p><strong>Rotary Club Nijmegen-Stad en Land | Canisius College Nijmegen</strong><br>
      in samenwerking met de decanen<br>
      van de middelbare scholen in Nijmegen e.o.</p>
    </div>
  </footer>

  <!-- block-95b: sponsor -->
  <footer class="b-95b">
    <div class="b-inner sponsor">
      <p class="sponsor__label">Mede mogelijk gemaakt door</p>
      <a class="sponsor__logo" href="https://www.resort-schrofenblick.at/" target="_blank" rel="noopener noreferrer">
        <img src="/assets/img/schrofenblick.png" alt="Schrofenblick Alpen Resort" width="180">
      </a>
    </div>
  </footer>

  <!-- block-95c: copyright -->
  <footer class="b-95c">
    <div class="b-inner text-6">
      <p>© ${eventYear} ${escape(settings['organization'] || 'Rotary Club Nijmegen-Stad en Land')}</p>
    </div>
  </footer>

</div>

<script>
  document.querySelectorAll('.accordion-handle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.accordion-item');
      const open = item.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(open));
    });
  });
</script>
</body>
</html>`);
}
