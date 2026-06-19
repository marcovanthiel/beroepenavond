/**
 * Homepage-renderer — strikt naar het ontwerp van de bronsite.
 * Geen nav-bar of hero zoals de interne pagina's; in plaats daarvan
 * een man-silhouet rechts, grote typografie + accordion-categorieën.
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
  // "Donderdag 20 november" — zonder jaar (jaar komt apart groot eronder)
  const eventDateNoYear = eventDate.replace(/\s+\d{4}\s*$/, '').toUpperCase();
  const email = settings['contact_email'] || 'info@beroepenavondnijmegen.nl';
  const credits = settings['credits'] || '';

  const accordionHtml = cats
    .map(
      (cat, i) => `
        <article class="accordion-item${i === 0 ? ' open' : ''}">
          <button class="accordion-handle" type="button" aria-expanded="${i === 0 ? 'true' : 'false'}">
            <span>${escape(cat.name).toUpperCase()}</span>
            <svg class="accordion-arrow" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <div class="accordion-panel">
            <ul>
              ${cat.beroepen
                .map(
                  (b) =>
                    `<li>${
                      b.slug
                        ? `<a href="/uitleg-beroepen/#${escape(b.slug)}">${escape(b.name)}</a>`
                        : escape(b.name)
                    }</li>`
                )
                .join('\n              ')}
            </ul>
          </div>
        </article>`
    )
    .join('\n');

  // Email obfuscation: HTML-entities zoals bron-site doet
  const emailEntities = email
    .split('')
    .map((ch) => `&#${ch.charCodeAt(0)};`)
    .join('');

  return c.html(html`<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${settings['organization'] ? `Beroepenavond ${eventYear} — Nijmegen` : 'Beroepenavond Nijmegen'}</title>
<meta name="description" content="Donderdag 20 november 2026 — Beroepenavond Nijmegen. Voorlichtingsavond voor middelbare scholieren in Canisius College Nijmegen.">
<meta name="theme-color" content="#a3d935">
<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/css/style.css">
</head>
<body class="home">
<div class="home-bg" aria-hidden="true"></div>

<main class="home-main">
  <header class="home-title">
    <p class="home-date">${eventDateNoYear}<br><span class="home-date__accent">BEROEPENAVOND</span></p>
    <p class="home-year">${eventYear}</p>
  </header>

  <div class="home-banner">
    <span class="home-banner__accent">BINNENKORT</span> ALLE INFORMATIE
  </div>
  <div class="home-divider"></div>

  <section class="accordion" aria-label="Beroepen per categorie">
    ${raw(accordionHtml)}
  </section>

  <div class="home-contact">
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" class="home-contact__icon">
      <path fill="currentColor" d="M12 12.713L.015 3h23.97L12 12.713zm0 2.574L0 5.562V21h24V5.562l-12 9.725z"/>
    </svg>
    <a href="mailto:${raw(emailEntities)}">${raw(emailEntities)}</a>
  </div>

  <div class="home-org">
    <p><strong>Rotary Club Nijmegen-Stad en Land</strong> &nbsp;|&nbsp; Canisius College Nijmegen<br>
    in samenwerking met de decanen<br>
    van de middelbare scholen in Nijmegen e.o.</p>
  </div>

  <p class="home-credits">© ${eventYear} ${raw(escape(credits))}</p>
</main>

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
