/**
 * HTML-layout voor de publieke site.
 */
import { html, raw } from 'hono/html';
import type { PageRow, SettingsMap } from '../env';

export interface LayoutOpts {
  title: string;
  metaDescription?: string | null;
  navItems: PageRow[];
  activeSlug: string;
  hero: {
    eyebrow?: string | null;
    title: string;
    lede?: string | null;
    image?: string | null;
    compact?: boolean;
  } | null;
  bodyHtml: string;
  settings: SettingsMap;
}

export function renderLayout(opts: LayoutOpts) {
  const navHtml = opts.navItems
    .map((p) => {
      const label = p.nav_label || p.title;
      const active = p.slug === opts.activeSlug ? 'active' : '';
      return `<li><a class="${active}" href="${p.slug}">${label}</a></li>`;
    })
    .join('\n      ');

  return html`<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${opts.title}</title>
${opts.metaDescription ? raw(`<meta name="description" content="${opts.metaDescription.replace(/"/g, '&quot;')}">`) : ''}
<meta property="og:title" content="${opts.title}">
${opts.metaDescription ? raw(`<meta property="og:description" content="${opts.metaDescription.replace(/"/g, '&quot;')}">`) : ''}
<meta property="og:type" content="website">
<meta property="og:locale" content="nl_NL">
<meta name="theme-color" content="#a3d935">
<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/css/style.css">
</head>
<body>
<header class="site-header">
  <nav class="nav" aria-label="Hoofdmenu">
    <a class="nav__logo" href="/">
      <span>Beroepenavond</span>
      <small>Nijmegen</small>
    </a>
    <button class="nav__toggle" id="navToggle" aria-label="Menu" aria-expanded="false">
      <span></span><span></span><span></span>
    </button>
    <ul class="nav__links" id="navLinks">
      ${raw(navHtml)}
    </ul>
  </nav>
</header>

${opts.hero
  ? raw(`<section class="hero ${opts.hero.compact ? 'hero--compact' : ''}">
  ${opts.hero.image ? `<div class="hero__bg" style="background-image:url('${opts.hero.image}')"></div>` : ''}
  <div class="wrap hero__inner">
    ${opts.hero.eyebrow ? `<span class="hero__eyebrow">${opts.hero.eyebrow}</span>` : ''}
    <h1>${opts.hero.title}</h1>
    ${opts.hero.lede ? `<p class="lede">${opts.hero.lede}</p>` : ''}
  </div>
</section>`)
  : ''}

<main class="section">
  <div class="wrap">
${raw(opts.bodyHtml)}
  </div>
</main>

<footer class="site-footer">
  <div class="wrap">
    <div class="footer-grid">
      <div>
        <h4>Wanneer</h4>
        <p>${opts.settings['event_date_long'] || ''}<br>
        ${opts.settings['event_time'] || ''}</p>
      </div>
      <div>
        <h4>Waar</h4>
        <p>${opts.settings['venue_name'] || ''}<br>
        ${opts.settings['venue_address'] || ''}</p>
      </div>
      <div>
        <h4>Organisatie</h4>
        <p>${opts.settings['organization'] || ''}<br>
        <small>${opts.settings['partners'] || ''}</small></p>
      </div>
      <div>
        <h4>Contact</h4>
        <p><a href="mailto:${opts.settings['contact_email'] || ''}">${opts.settings['contact_email'] || ''}</a></p>
      </div>
    </div>
    <div class="footer-bottom">
      <span>© <span id="year">2026</span> ${opts.settings['organization'] || 'Rotary Club Nijmegen-Stad en Land'}</span>
    </div>
  </div>
</footer>

<script>
  document.getElementById('year').textContent = new Date().getFullYear();
  const t = document.getElementById('navToggle');
  const l = document.getElementById('navLinks');
  if (t && l) t.addEventListener('click', () => {
    const open = l.classList.toggle('open');
    t.setAttribute('aria-expanded', String(open));
  });
</script>
</body>
</html>`;
}
