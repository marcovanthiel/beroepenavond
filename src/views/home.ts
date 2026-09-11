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
import { getActiveEvent, getCategoriesWithBeroepen, getNavPages, getSettings } from '../lib/db';
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
  const [settings, event, navItems, catsFull, beroepCount, rondeRow, sponsorRows] = await Promise.all([
    getSettings(db),
    getActiveEvent(db),
    getNavPages(db),
    getCategoriesWithBeroepen(db),
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
  const venue = settings['venue_name'] || 'Montessori College Nijmegen';
  const venueAdres = settings['venue_address'] || 'Kwakkenbergweg 27, 6523 MJ Nijmegen';
  const venueStraat = venueAdres.split(',')[0].trim();
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

  // Categoriestrip: elke tegel is een gewone link naar /beroepen?cat=…
  // (werkt zonder JS). Met JS onderschept het drawer-script de klik en
  // schuift het paneel met de beroepen uit, bovenop de homepage.
  const stripHtml = catsFull
    .map((cat) => {
      const kleur = cat.color || '#0d0d0d';
      return `<a class="bn-cat" data-cat="${esc(cat.id)}" href="/beroepen?cat=${esc(cat.id)}" aria-expanded="false" aria-controls="catDrawer" style="background:${esc(kleur)};color:${tekstOp(kleur)}">${esc(cat.name)}<em>${cat.beroepen.length}<span class="bn-cat__pijl" aria-hidden="true">→</span></em></a>`;
    })
    .join('\n      ');

  // Persistente kleur-schakelaar in het paneel: met één klik naar een ander
  // vakgebied, ook als de categorietegel op de home onder het paneel valt.
  const drawerTabs = catsFull
    .map(
      (cat) =>
        `<button type="button" class="cat-dot" data-goto="${esc(cat.id)}" style="background:${esc(cat.color || '#0d0d0d')};color:${esc(cat.color || '#0d0d0d')}" aria-label="${esc(cat.name)}" title="${esc(cat.name)}"></button>`
    )
    .join('');

  // Verborgen paneel-inhoud per categorie (het drawer-script kopieert de
  // juiste template in het paneel). Zo is de inhoud er meteen, zonder extra
  // netwerkverzoek, en blijft alles server-side gerenderd.
  const drawerData = catsFull
    .map((cat) => {
      const kleur = cat.color || '#0d0d0d';
      const opKleur = tekstOp(kleur);
      const items = cat.beroepen
        .map(
          (b) =>
            `<li><a href="/beroepen/${b.id}"><span>${esc(b.name)}</span><span class="cat-drawer__pijl" aria-hidden="true">→</span></a></li>`
        )
        .join('');
      return `<template data-cat="${esc(cat.id)}">
        <div class="cat-drawer__head" style="background:${esc(kleur)};color:${opKleur}">
          <span class="cat-drawer__eyebrow">Beroepen in dit vakgebied</span>
          <h2 tabindex="-1">${esc(cat.name)}</h2>
          <span class="cat-drawer__count">${cat.beroepen.length} ${cat.beroepen.length === 1 ? 'beroep' : 'beroepen'}</span>
        </div>
        <ul class="cat-drawer__list">${items}</ul>
        <div class="cat-drawer__foot"><a href="/beroepen?cat=${esc(cat.id)}">Bekijk dit hele vakgebied →</a></div>
      </template>`;
    })
    .join('\n');

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
      address: settings['venue_address'] || 'Kwakkenbergweg 27, 6523 MJ Nijmegen',
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
<link rel="stylesheet" href="/assets/css/style.css?v=3">
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
      <div class="bn-hero__sub"><b>${eventDateLong}</b> · ${venue}, ${venueStraat} · ${tijd} · gratis toegang</div>
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
    <span>${esc(organisatie)} · ${esc(venue)}, ${esc(venueAdres)}</span>
    <span><a href="/nieuwsbrief">Nieuwsbrief</a> · <a href="/privacy">Privacy</a> · <a href="/toegankelijkheid">Toegankelijkheid</a> · <a href="/updates">Updates</a> · <a href="/admin">Beheer</a></span>
  </div>

  <!-- Uitschuifpaneel per beroepscategorie (ligt bovenop de home). -->
  <div class="cat-scrim" id="catScrim" hidden></div>
  <aside class="cat-drawer" id="catDrawer" role="dialog" aria-modal="false" aria-label="Beroepen" hidden>
    <div class="cat-drawer__tabs" role="tablist" aria-label="Kies een vakgebied">
      ${raw(drawerTabs)}
      <button type="button" class="cat-drawer__x" data-close aria-label="Menu sluiten">✕</button>
    </div>
    <div class="cat-drawer__body" id="catBody"></div>
  </aside>
  <div id="catData" hidden>
    ${raw(drawerData)}
  </div>
</main>

<script>
  var t = document.getElementById('navToggle'), l = document.getElementById('navLinks');
  if (t && l) t.addEventListener('click', function () {
    var open = l.classList.toggle('open');
    t.setAttribute('aria-expanded', String(open));
  });

  // Uitschuifmenu per categorie op de homepage.
  (function () {
    var strip = document.querySelector('.bn-strip');
    var drawer = document.getElementById('catDrawer');
    var scrim = document.getElementById('catScrim');
    var data = document.getElementById('catData');
    var bodyEl = document.getElementById('catBody');
    if (!strip || !drawer || !scrim || !data || !bodyEl) return;
    var body = document.body;
    var tabs = drawer.querySelector('.cat-drawer__tabs');
    var DUR = 340; // moet gelijk zijn aan de CSS-transitieduur
    var reduce = false;
    try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
    var current = null, lastBtn = null, switchTimer = null;

    function tpl(id) {
      var list = data.getElementsByTagName('template');
      for (var i = 0; i < list.length; i++) {
        if (list[i].getAttribute('data-cat') === id) return list[i].innerHTML;
      }
      return null;
    }
    function markDot(id) {
      var dots = drawer.querySelectorAll('.cat-dot');
      for (var i = 0; i < dots.length; i++) {
        var on = dots[i].getAttribute('data-goto') === id;
        dots[i].classList.toggle('is-active', on);
        dots[i].setAttribute('aria-current', on ? 'true' : 'false');
      }
    }
    function markStrip(id) {
      var links = strip.querySelectorAll('a[data-cat]');
      for (var i = 0; i < links.length; i++) {
        var on = links[i].getAttribute('data-cat') === id;
        links[i].classList.toggle('is-active', on);
        links[i].setAttribute('aria-expanded', on ? 'true' : 'false');
      }
    }
    function fill(id) {
      var t = tpl(id);
      if (t === null) return false;
      bodyEl.innerHTML = t;
      current = id;
      markDot(id);
      markStrip(id);
      var h = bodyEl.querySelector('h2');
      drawer.setAttribute('aria-label', h ? h.textContent : 'Beroepen');
      if (h) setTimeout(function () { try { h.focus(); } catch (e) {} }, reduce ? 0 : DUR);
      return true;
    }
    function open(id, btn) {
      if (!fill(id)) return;
      if (btn) lastBtn = btn;
      body.classList.add('cat-open');
      scrim.hidden = false; drawer.hidden = false;
      void drawer.offsetWidth; // reflow: transitie vertrekt vanaf de dichte staat
      requestAnimationFrame(function () {
        drawer.classList.add('open');
        scrim.classList.add('show');
      });
    }
    function afterClose() {
      body.classList.remove('cat-open');
      scrim.hidden = true; drawer.hidden = true;
      bodyEl.innerHTML = '';
    }
    function clearStrip() {
      var links = strip.querySelectorAll('a[data-cat].is-active');
      for (var i = 0; i < links.length; i++) {
        links[i].classList.remove('is-active');
        links[i].setAttribute('aria-expanded', 'false');
      }
    }
    function closeFull() {
      if (!current) return;
      var btn = lastBtn;
      current = null;
      clearStrip();
      drawer.classList.remove('open');
      scrim.classList.remove('show');
      if (reduce) afterClose(); else setTimeout(afterClose, DUR);
      if (btn) try { btn.focus(); } catch (e) {}
    }
    function goto(id, btn) {
      if (current === id) { closeFull(); return; }
      if (current) {
        // Marco's volgorde: eerst het huidige menu dicht, dan het nieuwe open.
        if (reduce) { fill(id); return; }
        drawer.classList.remove('open'); // scrim blijft staan tijdens het wisselen
        clearTimeout(switchTimer);
        switchTimer = setTimeout(function () {
          if (!fill(id)) return;
          void drawer.offsetWidth;
          requestAnimationFrame(function () { drawer.classList.add('open'); });
        }, DUR);
      } else {
        open(id, btn);
      }
    }

    // Klik op een categorietegel op de home: paneel openen i.p.v. navigeren.
    strip.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('a[data-cat]') : null;
      if (!a) return;
      e.preventDefault();
      goto(a.getAttribute('data-cat'), a);
    });
    // Kleur-schakelaar in het paneel + sluitknop.
    tabs.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('button') : null;
      if (!t) return;
      if (t.hasAttribute('data-close')) { closeFull(); return; }
      var id = t.getAttribute('data-goto');
      if (id) goto(id, lastBtn);
    });
    scrim.addEventListener('click', function () { closeFull(); });
    document.addEventListener('keydown', function (e) {
      if ((e.key === 'Escape' || e.key === 'Esc') && current) closeFull();
    });

    // Deep-link: /#vak=<categorie> opent dat paneel direct (deelbare link).
    function fromHash() {
      var m = /#vak=([\w-]+)/.exec(location.hash || '');
      if (m && tpl(m[1])) open(m[1], null);
    }
    fromHash();
    window.addEventListener('hashchange', fromHash);
  })();
</script>
</body>
</html>`);
}
