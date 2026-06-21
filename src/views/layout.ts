/**
 * HTML-layout voor de publieke site (interne pagina's).
 * Sessie 3: skip-link, breadcrumbs, hero-CTA's, JSON-LD, social-footer
 * + nieuwsbrief-mini-form, OG-meta. Achterwaarts compatibel met de
 * bestaande aanroepen vanuit renderPage/renderError.
 */
import { html, raw } from 'hono/html';
import type { PageRow, SettingsMap } from '../env';

export interface Crumb { label: string; href?: string; }
export interface HeroCta { label: string; href: string; variant?: 'primary' | 'secondary' | 'ghost'; }

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
    ctas?: HeroCta[];
  } | null;
  bodyHtml: string;
  settings: SettingsMap;
  breadcrumbs?: Crumb[];
  notice?: { type: 'ok' | 'err'; text: string } | null;
  jsonLd?: unknown;
  ogImage?: string | null;
  canonicalPath?: string | null;
}

function attr(s: unknown): string {
  return String(s ?? '').replace(/"/g, '&quot;');
}

export function renderLayout(opts: LayoutOpts) {
  const s = opts.settings;
  const host = `https://${s['site_host'] || 'inijmegen.com'}`;
  const ogImage = opts.ogImage || s['seo_og_image'] || '/assets/img/mannetje.jpg';
  const canonical = opts.canonicalPath ? host + opts.canonicalPath : null;

  const navHtml = opts.navItems
    .map((p) => {
      const label = p.nav_label || p.title;
      const isActive = p.slug === opts.activeSlug;
      return `<li><a class="${isActive ? 'active' : ''}" href="${p.slug}"${isActive ? ' aria-current="page"' : ''}>${label}</a></li>`;
    })
    .join('\n      ');

  const crumbsHtml = opts.breadcrumbs?.length
    ? `<nav class="wrap crumbs" aria-label="Kruimelpad"><a href="/">Home</a>${opts.breadcrumbs
        .map(
          (c) =>
            `<span>›</span>${c.href ? `<a href="${c.href}">${c.label}</a>` : c.label}`
        )
        .join('')}</nav>`
    : '';

  const ctasHtml = opts.hero?.ctas?.length
    ? `<div class="hero__cta">${opts.hero.ctas
        .map(
          (c) =>
            `<a class="btn btn--${c.variant || 'primary'} btn--lg" href="${c.href}">${c.label}</a>`
        )
        .join('')}</div>`
    : '';

  const socialLinks = [
    ['Facebook', s['social_facebook']],
    ['Instagram', s['social_instagram']],
    ['LinkedIn', s['social_linkedin']],
  ].filter(([, url]) => url) as [string, string][];
  const socialHtml = socialLinks.length
    ? `<div class="footer-social">${socialLinks
        .map(
          ([name, url]) =>
            `<a href="${attr(url)}" target="_blank" rel="noopener" aria-label="${name}" title="${name}">${name[0]}</a>`
        )
        .join('')}</div>`
    : '';

  // JSON-LD: altijd Organization, + BreadcrumbList op subpagina's, +
  // eventuele pagina-specifieke data (bv. Event op de home, FAQPage).
  const orgLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Beroepenavond Nijmegen',
    url: host + '/',
    logo: host + '/assets/img/favicon.png',
    sameAs: socialLinks.map(([, url]) => url),
  };
  const breadcrumbLd = opts.breadcrumbs?.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: host + '/' },
          ...opts.breadcrumbs.map((c, i) => ({
            '@type': 'ListItem',
            position: i + 2,
            name: c.label,
            ...(c.href ? { item: host + c.href } : {}),
          })),
        ],
      }
    : null;
  const jsonLdHtml = [orgLd, breadcrumbLd, opts.jsonLd]
    .filter(Boolean)
    .map((d) => `<script type="application/ld+json">${JSON.stringify(d)}</script>`)
    .join('\n');

  return html`<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${opts.title}</title>
${opts.metaDescription ? raw(`<meta name="description" content="${attr(opts.metaDescription)}">`) : ''}
${canonical ? raw(`<link rel="canonical" href="${attr(canonical)}">`) : ''}
<meta property="og:title" content="${attr(opts.title)}">
${opts.metaDescription ? raw(`<meta property="og:description" content="${attr(opts.metaDescription)}">`) : ''}
<meta property="og:type" content="website">
<meta property="og:locale" content="nl_NL">
<meta property="og:site_name" content="Beroepenavond Nijmegen">
<meta property="og:image" content="${attr(ogImage.startsWith('http') ? ogImage : host + ogImage)}">
${canonical ? raw(`<meta property="og:url" content="${attr(canonical)}">`) : ''}
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#88bc1d">
<link rel="icon" href="/assets/img/favicon.png" type="image/png">
<link rel="apple-touch-icon" href="/assets/img/favicon.png">
<link rel="manifest" href="/assets/site.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/css/style.css">
${raw(jsonLdHtml)}
</head>
<body>
<a class="skip-link" href="#main">Naar inhoud</a>
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
      <li><a href="/leerling">Mijn avond</a></li>
      <li><a class="nav__cta" href="/aanmelden">Word voorlichter</a></li>
    </ul>
  </nav>
</header>

${opts.hero
  ? raw(`<section class="hero ${opts.hero.compact ? 'hero--compact' : ''}">
  ${opts.hero.image ? `<div class="hero__bg" style="background-image:url('${attr(opts.hero.image)}')"></div>` : ''}
  <div class="wrap hero__inner">
    ${opts.hero.eyebrow ? `<span class="hero__eyebrow">${opts.hero.eyebrow}</span>` : ''}
    <h1>${opts.hero.title}</h1>
    ${opts.hero.lede ? `<p class="lede">${opts.hero.lede}</p>` : ''}
    ${ctasHtml}
  </div>
</section>`)
  : ''}
${raw(crumbsHtml)}

<main class="section" id="main">
  <div class="wrap">
${opts.notice ? raw(`<div class="notice notice--${opts.notice.type}">${attr(opts.notice.text)}</div>`) : ''}
${raw(opts.bodyHtml)}
  </div>
</main>

<footer class="site-footer">
  <div class="wrap">
    <div class="footer-grid">
      <div>
        <h4>Wanneer</h4>
        <p>${s['event_date_long'] || ''}<br>${s['event_time'] || ''}</p>
      </div>
      <div>
        <h4>Waar</h4>
        <p>${s['venue_name'] || ''}<br>${s['venue_address'] || ''}</p>
      </div>
      <div>
        <h4>Contact</h4>
        <p><a href="mailto:${s['contact_email'] || ''}">${s['contact_email'] || ''}</a>${s['org_phone'] ? `<br>${s['org_phone']}` : ''}</p>
        ${raw(socialHtml)}
      </div>
      <div>
        <h4>Op de hoogte blijven</h4>
        <form class="footer-news" method="post" action="/nieuwsbrief">
          <input type="email" name="email" placeholder="Je e-mailadres" aria-label="E-mailadres" required>
          <input type="text" name="website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
          <button type="submit">Aanmelden</button>
        </form>
        <p style="margin-top:10px"><a href="/aanmelden">Word voorlichter</a> · <a href="/contact">Contact</a> · <a href="/faq">Vragen</a></p>
      </div>
    </div>
    <div class="footer-bottom">
      <span>© <span id="year">2026</span> ${s['organization'] || 'Rotary Club Nijmegen-Stad en Land'}</span>
      <span><a href="/privacy">Privacy</a> · <a href="/admin">Beheer</a></span>
    </div>
  </div>
</footer>

<script>
  document.getElementById('year').textContent = new Date().getFullYear();
  var t = document.getElementById('navToggle'), l = document.getElementById('navLinks');
  if (t && l) t.addEventListener('click', function () {
    var open = l.classList.toggle('open');
    t.setAttribute('aria-expanded', String(open));
  });
</script>
</body>
</html>`;
}
