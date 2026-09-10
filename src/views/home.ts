/**
 * Homepage — herontwerp 2026 "Kleurblok".
 *
 * Opbouw: zwarte nav, typografisch monument met de datum (dd.mm) naast een
 * kleurvlak met het jaarfiguur, de zes categorieblokken als klikbare strip,
 * dynamische feitenregel, "Hoe werkt het?" in vier stappen, en de zwarte
 * voorlichters-balk. Alle aantallen komen live uit D1.
 */
import type { Context } from 'hono';
import { html, raw } from 'hono/html';
import type { Env } from '../env';
import { getActiveEvent, getNavPages, getSettings } from '../lib/db';
import { gedaanteVanVandaag, jaarfiguurSvg, tekstOp } from './figuur';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function renderHome(c: Context<{ Bindings: Env }>) {
  const db = c.env.DB;
  const [settings, event, navItems, cats, beroepCount, rondeRow, sponsorRows] = await Promise.all([
    getSettings(db),
    getActiveEvent(db),
    getNavPages(db),
    db.prepare(
      `SELECT c.id, c.name, c.color, COUNT(b.id) AS n
       FROM categories c LEFT JOIN beroepen b ON b.category_id = c.id
       GROUP BY c.id ORDER BY c.sort_order`
    ).all<{ id: string; name: string; color: string; n: number }>(),
    db.prepare('SELECT COUNT(*) AS n FROM beroepen').first<{ n: number }>(),
    db.prepare(
      `SELECT COUNT(*) AS n FROM rounds WHERE event_id = (SELECT id FROM events WHERE is_active = 1 LIMIT 1)`
    ).first<{ n: number }>(),
    db.prepare('SELECT name, logo_url, website FROM sponsors WHERE is_active = 1 ORDER BY sort_order, name')
      .all<{ name: string; logo_url: string | null; website: string | null }>(),
  ]);

  const published = (settings['voorlichters_published'] ?? '0') === '1';
  // Teller: bevestigde voorlichters zodra gepubliceerd; vangnet: zolang er
  // nog niemand bevestigd is tellen de aangemelde voorlichters mee (anders
  // zou de home "0 professionals" tonen terwijl er 169 aangemeld zijn).
  const bevestigdRow = await db.prepare('SELECT COUNT(*) AS n FROM speakers WHERE is_public = 1 AND confirmed = 1').first<{ n: number }>();
  const aangemeldRow = await db.prepare('SELECT COUNT(*) AS n FROM speakers WHERE is_public = 1').first<{ n: number }>();
  const bevestigd = bevestigdRow?.n ?? 0;
  const sprekerRow = published && bevestigd > 0 ? bevestigdRow : aangemeldRow;
  const toonNamen = published && bevestigd > 0;

  // Sprekersbalk-lijst: 5 bevestigde voorlichters, of (zolang die er niet
  // zijn) 5 beroepen als voorproefje.
  const lijst: { l: string; r: string }[] = [];
  if (toonNamen) {
    const rows = await db.prepare(
      `SELECT s.full_name, s.job_title FROM speakers s
       WHERE s.is_public = 1 AND s.confirmed = 1 AND s.job_title IS NOT NULL
       ORDER BY s.full_name LIMIT 5`
    ).all<{ full_name: string; job_title: string }>();
    for (const r of rows.results ?? []) lijst.push({ l: r.full_name, r: r.job_title });
  } else {
    const rows = await db.prepare(
      `SELECT b.name, c.name AS cat FROM beroepen b
       LEFT JOIN categories c ON c.id = b.category_id
       ORDER BY b.name LIMIT 5`
    ).all<{ name: string; cat: string | null }>();
    for (const r of rows.results ?? []) lijst.push({ l: r.name, r: r.cat ?? '' });
  }

  const eventYear = event?.year ? String(event.year) : settings['event_year'] || '2026';
  const eventDateLong = settings['event_date_long'] || 'Donderdag 20 november 2026';
  // Datum-monument dd.mm uit de actieve editie (bron van waarheid = events).
  const iso = event?.date || c.env.EVENT_DATE || '2026-11-20';
  const monument = `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;
  const venue = settings['venue_name'] || 'Canisius College Nijmegen';
  const tijd = (settings['event_time'] || '18:30 tot 21:30').replace(/\s*[–—-]\s*/g, ' tot ');
  const editie = settings['edition_label'] || '25e';
  const organisatie = settings['organization'] || 'Rotary Club Nijmegen-Stad en Land';

  // Jaarfiguur (drie gedaanten, wisselt per dag; instelbaar via settings).
  const figuurBeroep = settings['jaarfiguur_beroep'] || 'de chirurg';
  const figuurKleur = settings['jaarfiguur_kleur'] || '#2E7ED4';
  const figuurSvg = jaarfiguurSvg({
    gedaante: gedaanteVanVandaag(),
    figuur: '#ffffff',
    detail: figuurKleur,
    beroep: figuurBeroep,
  });
  const veldTekst = tekstOp(figuurKleur);

  const totBeroepen = beroepCount?.n ?? 0;
  const totSprekers = sprekerRow?.n ?? 0;
  const totRondes = rondeRow?.n ?? 0;

  const stripHtml = (cats.results ?? [])
    .map((cat) => {
      const kleur = cat.color || '#0d0d0d';
      return `<a href="/beroepen?cat=${esc(cat.id)}" style="background:${esc(kleur)};color:${tekstOp(kleur)}">${esc(cat.name)}<em>${cat.n}<span aria-hidden="true">→</span></em></a>`;
    })
    .join('\n      ');

  const lijstHtml = lijst
    .map((r) => `<div>${esc(r.l)} <span>${esc(r.r)}</span></div>`)
    .join('\n        ');

  const navHtml = navItems
    .map((p) => `<li><a href="${p.slug}">${esc(p.nav_label || p.title)}</a></li>`)
    .join('');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: `Beroepenavond Nijmegen ${eventYear}`,
    description: `Voorlichtingsavond waarop scholieren kennismaken met ${totBeroepen || 'ruim 100'} beroepen.`,
    startDate: `${iso}T18:30:00+01:00`,
    endDate: `${iso}T21:30:00+01:00`,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    isAccessibleForFree: true,
    location: {
      '@type': 'Place',
      name: venue,
      address: settings['venue_address'] || 'Berg en Dalseweg 207, 6522 BR Nijmegen',
    },
    organizer: { '@type': 'Organization', name: organisatie, url: `https://${c.env.SITE_HOST}` },
    image: `https://${c.env.SITE_HOST}/assets/img/og.png`,
    url: `https://${c.env.SITE_HOST}/`,
  };

  return c.html(html`<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Beroepenavond ${eventYear} — Nijmegen</title>
<meta name="description" content="${eventDateLong}: Beroepenavond Nijmegen. ${totBeroepen} beroepen, ${totSprekers} professionals, één avond in ${venue}. Gratis voor scholieren.">
<meta name="theme-color" content="#0d0d0d">
<link rel="icon" href="/assets/img/favicon.png" type="image/png">
<link rel="apple-touch-icon" href="/assets/img/favicon.png">
<link rel="manifest" href="/assets/site.webmanifest">
<link rel="stylesheet" href="/assets/css/style.css?v=2">
<meta property="og:title" content="Beroepenavond ${eventYear} — Nijmegen">
<meta property="og:type" content="website">
<meta property="og:image" content="https://${c.env.SITE_HOST}/assets/img/og.png">
<link rel="canonical" href="https://${c.env.SITE_HOST}/">
<script type="application/ld+json">${raw(JSON.stringify(jsonLd))}</script>
</head>
<body>
<a class="skip-link" href="#main">Naar inhoud</a>
<header class="site-header">
  <nav class="nav" aria-label="Hoofdmenu">
    <a class="nav__logo" href="/"><span>Beroepenavond</span><small>Nijmegen</small></a>
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

<main id="main">
  <div class="bn-hero">
    <div class="bn-hero__tekst">
      <h1>${monument}</h1>
      <div class="bn-hero__sub"><b>${eventDateLong}</b> · ${venue} · ${tijd} · gratis toegang</div>
      <div class="bn-hero__cta">
        <a class="btn btn--primary btn--lg" href="#hoe">Hoe werkt het?</a>
        <a class="btn btn--ghost btn--lg" href="/beroepen">Alle beroepen</a>
      </div>
    </div>
    <div class="bn-veld" style="background:${figuurKleur}">
      <div class="bn-veld__wie" style="color:${veldTekst}"><span>Figuur van ${eventYear}</span><span>${esc(figuurBeroep)}</span></div>
      ${raw(figuurSvg)}
    </div>
  </div>

  <nav class="bn-strip" aria-label="Beroepen per categorie">
      ${raw(stripHtml)}
  </nav>

  <div class="bn-feit">
    <span><b>${totBeroepen}</b> beroepen</span>
    ${totSprekers ? raw(`<span><b>${totSprekers}</b> professionals</span>`) : ''}
    ${totRondes ? raw(`<span><b>${totRondes}</b> rondes van 25 min.</span>`) : ''}
    <span><b>${editie}</b> editie</span>
  </div>

  <section class="bn-stappen" id="hoe">
    <h2>Hoe werkt het?</h2>
    <div class="bn-stappen__grid">
      <div class="bn-stap"><div class="nr" aria-hidden="true">1</div><h3>Kies je beroepen</h3><p>Blader door de zes vakgebieden of zoek direct. Klik door tot je de mensen ziet die het werk echt doen.</p></div>
      <div class="bn-stap"><div class="nr" aria-hidden="true">2</div><h3>Bouw je avond</h3><p>Log in met alleen je e-mailadres en zet je favoriete beroepen in <a href="/leerling">Mijn avond</a>: dat wordt je persoonlijke rooster.</p></div>
      <div class="bn-stap"><div class="nr" aria-hidden="true">3</div><h3>Stel je vraag vast</h3><p>Elke voorlichter leest vooraf jouw vragen. Vraag wat je écht wilt weten, ook wat je in de klas niet vraagt.</p></div>
      <div class="bn-stap"><div class="nr" aria-hidden="true">4</div><h3>Kom op ${monument.replace('.', '/')}</h3><p>${venue}, ${tijd.split(' ')[0]} uur. Je rooster staat op je telefoon en wijst je per ronde naar het juiste lokaal.</p></div>
    </div>
  </section>

  <section class="bn-sprekers">
    <div class="bn-sprekers__in">
      <div>
        <h2>${totSprekers > 0 ? `${totSprekers} professionals.` : 'Professionals gezocht.'}<br>Eén missie.</h2>
        <p>Zij staan op ${eventDateLong.toLowerCase().replace(/^\w/, (m) => m)} voor een vol lokaal om hun vak door te geven. Werk jij in een beroep dat scholieren moeten leren kennen?</p>
        <a class="knop" href="/aanmelden">Meld je aan als voorlichter</a>
      </div>
      <div class="bn-sprekers__lijst">
        ${raw(lijstHtml)}
      </div>
    </div>
  </section>

  ${raw((() => {
    const sp = sponsorRows.results ?? [];
    if (!sp.length) return '';
    const logos = sp.map((x) => {
      const img = x.logo_url
        ? `<img src="${esc(x.logo_url)}" alt="${esc(x.name)}" loading="lazy" decoding="async">`
        : `<span>${esc(x.name)}</span>`;
      return x.website ? `<a href="${esc(x.website)}" target="_blank" rel="noopener">${img}</a>` : `<span>${img}</span>`;
    }).join('');
    return `<div class="bn-sponsors"><span class="bn-sponsors__label">Mede mogelijk gemaakt door</span><div class="bn-sponsors__logos">${logos}</div><a class="bn-sponsors__word" href="/aanmelden#sponsor">Word ook sponsor →</a></div>`;
  })())}

  <div class="bn-voet">
    <span>${esc(organisatie)} · met de decanen van de scholen in Nijmegen e.o.</span>
    <span><a href="/nieuwsbrief">Nieuwsbrief</a> · <a href="/privacy">Privacy</a> · <a href="/toegankelijkheid">Toegankelijkheid</a> · <a href="/updates">Updates</a> · <a href="/admin">Beheer</a></span>
  </div>
</main>

<script>
  var t = document.getElementById('navToggle'), l = document.getElementById('navLinks');
  if (t && l) t.addEventListener('click', function () {
    var open = l.classList.toggle('open');
    t.setAttribute('aria-expanded', String(open));
  });
</script>
</body>
</html>`);
}
