/**
 * Generatoren voor dynamische publieke content die als `appendHtml`
 * onder een pagina-hero komt: beroepencatalogus, voorlichters-grid,
 * nieuwsoverzicht en de publieke formulieren.
 */
import type { D1Database } from '@cloudflare/workers-types';
import type { SettingsMap } from '../env';
import { renderMarkdown } from '../lib/markdown';

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

// ----------------------------------------------------------------------
// Beroepencatalogus
// ----------------------------------------------------------------------

export async function renderBeroepenCatalog(db: D1Database): Promise<string> {
  const cats = await db
    .prepare('SELECT id, name, color FROM categories ORDER BY sort_order')
    .all<{ id: string; name: string; color: string | null }>();
  const ber = await db
    .prepare(
      'SELECT category_id, name, description_md FROM beroepen ORDER BY category_id, sort_order, name'
    )
    .all<{ category_id: string; name: string; description_md: string | null }>();

  const byCat = new Map<string, { name: string; desc: string | null }[]>();
  for (const b of ber.results ?? []) {
    const list = byCat.get(b.category_id) ?? [];
    list.push({ name: b.name, desc: b.description_md });
    byCat.set(b.category_id, list);
  }

  const filterButtons = [
    `<button class="active" data-cat="all" type="button">Alle</button>`,
    ...(cats.results ?? []).map(
      (c) =>
        `<button data-cat="${esc(c.id)}" type="button"><span class="chip__dot" style="background:${esc(c.color ?? '#88bc1d')};display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px"></span>${esc(c.name)}</button>`
    ),
  ].join('');

  const sections = (cats.results ?? [])
    .map((c) => {
      const items = byCat.get(c.id) ?? [];
      if (!items.length) return '';
      const grid = items
        .map(
          (b) =>
            `<div class="beroep" data-name="${esc(b.name.toLowerCase())}"><b>${esc(b.name)}</b>${b.desc ? `<p>${esc(b.desc)}</p>` : ''}</div>`
        )
        .join('');
      return `<section class="cat-section" data-cat="${esc(c.id)}" id="cat-${esc(c.id)}">
        <div class="cat-section__head">
          <span class="chip__dot" style="background:${esc(c.color ?? '#88bc1d')};width:14px;height:14px;border-radius:50%;display:inline-block"></span>
          <h3>${esc(c.name)}</h3>
          <span class="cat-section__count">${items.length} beroepen</span>
        </div>
        <div class="beroep-grid">${grid}</div>
      </section>`;
    })
    .join('');

  return `
    <div class="catalog-tools">
      <input type="search" class="catalog-search" id="beroepSearch" placeholder="Zoek een beroep…" aria-label="Zoek een beroep">
    </div>
    <div class="cat-filter" id="catFilter">${filterButtons}</div>
    <div id="catalog">${sections}</div>
    <p class="catalog-empty" id="catalogEmpty">Geen beroepen gevonden voor je zoekopdracht.</p>
    <script>
    (function(){
      var search=document.getElementById('beroepSearch');
      var filter=document.getElementById('catFilter');
      var empty=document.getElementById('catalogEmpty');
      var sections=[].slice.call(document.querySelectorAll('.cat-section'));
      var activeCat='all';
      function apply(){
        var q=(search.value||'').trim().toLowerCase();
        var anyVisible=false;
        sections.forEach(function(sec){
          var catOk=activeCat==='all'||sec.getAttribute('data-cat')===activeCat;
          var visibleItems=0;
          [].slice.call(sec.querySelectorAll('.beroep')).forEach(function(it){
            var match=catOk&&(!q||it.getAttribute('data-name').indexOf(q)>-1);
            it.style.display=match?'':'none';
            if(match)visibleItems++;
          });
          sec.style.display=visibleItems>0?'':'none';
          if(visibleItems>0)anyVisible=true;
        });
        empty.style.display=anyVisible?'none':'block';
      }
      search.addEventListener('input',apply);
      filter.addEventListener('click',function(e){
        var b=e.target.closest('button'); if(!b)return;
        activeCat=b.getAttribute('data-cat');
        [].slice.call(filter.querySelectorAll('button')).forEach(function(x){x.classList.toggle('active',x===b);});
        apply();
      });
    })();
    </script>`;
}

// ----------------------------------------------------------------------
// Voorlichters / sprekers
// ----------------------------------------------------------------------

interface SpeakerRow {
  full_name: string;
  job_title: string | null;
  organization: string | null;
  portrait_url: string | null;
  linkedin: string | null;
  category_id: string | null;
}

function speakerCard(s: SpeakerRow): string {
  const avatar = s.portrait_url
    ? `<img class="speaker-card__avatar" src="${esc(s.portrait_url)}" alt="${esc(s.full_name)}" loading="lazy" decoding="async">`
    : `<div class="speaker-card__ph" aria-hidden="true">${esc(initials(s.full_name))}</div>`;
  const li = s.linkedin
    ? `<a class="speaker-card__li" href="${esc(s.linkedin)}" target="_blank" rel="noopener" aria-label="LinkedIn van ${esc(s.full_name)}">in · LinkedIn</a>`
    : '';
  return `<article class="card-box speaker-card" data-name="${esc(s.full_name.toLowerCase())}">
    ${avatar}
    <h3>${esc(s.full_name)}</h3>
    ${s.job_title ? `<p class="role">${esc(s.job_title)}</p>` : ''}
    ${s.organization ? `<p class="org">${esc(s.organization)}</p>` : ''}
    ${li}
  </article>`;
}

/** Voorbeeld van de beroepen per categorie (getoond zolang de voorlichters
 *  nog niet gepubliceerd zijn — dan zie je wél de vakgebieden, nog geen namen). */
async function beroepenPreview(db: D1Database): Promise<string> {
  const cats = await db.prepare('SELECT id, name, color FROM categories ORDER BY sort_order').all<{ id: string; name: string; color: string | null }>();
  const ber = await db.prepare('SELECT category_id, name FROM beroepen ORDER BY category_id, name').all<{ category_id: string; name: string }>();
  const byCat = new Map<string, string[]>();
  for (const b of ber.results ?? []) (byCat.get(b.category_id) ?? byCat.set(b.category_id, []).get(b.category_id)!).push(b.name);
  const sections = (cats.results ?? [])
    .map((c) => {
      const items = byCat.get(c.id) ?? [];
      if (!items.length) return '';
      return `<section class="cat-section">
        <div class="cat-section__head"><span class="chip__dot" style="background:${esc(c.color ?? '#88bc1d')};width:14px;height:14px;border-radius:50%;display:inline-block"></span><h3>${esc(c.name)}</h3><span class="cat-section__count">${items.length} beroepen</span></div>
        <div class="beroep-grid">${items.map((n) => `<div class="beroep"><b>${esc(n)}</b></div>`).join('')}</div>
      </section>`;
    })
    .join('');
  return `<div class="callout"><p>De voorlichters voor deze editie worden binnenkort
    bekendgemaakt. Hieronder alvast de vakgebieden waarmee je kennis kunt maken.
    Wil je zelf een beroep presenteren? <a href="/aanmelden">Meld je aan als voorlichter</a>.</p></div>
    ${sections}`;
}

export async function renderVoorlichters(db: D1Database, beroepId?: number): Promise<string> {
  // Globale publicatie-schakelaar: uit = alleen beroepen tonen, geen namen.
  const pub = await db.prepare("SELECT value FROM settings WHERE key='voorlichters_published'").first<{ value: string }>();
  if ((pub?.value ?? '0') !== '1') {
    return beroepenPreview(db);
  }

  // Eén beroep gefilterd (vanaf de homepage-link): toon de voorlichter(s) van dat beroep.
  if (beroepId) {
    const ber = await db
      .prepare('SELECT b.name, c.name AS cat_name, c.color AS cat_color FROM beroepen b LEFT JOIN categories c ON c.id = b.category_id WHERE b.id = ?')
      .bind(beroepId)
      .first<{ name: string; cat_name: string | null; cat_color: string | null }>();
    const sp = await db
      .prepare(
        'SELECT full_name, job_title, organization, portrait_url, linkedin, category_id FROM speakers WHERE is_public = 1 AND confirmed = 1 AND beroep_id = ? ORDER BY full_name'
      )
      .bind(beroepId)
      .all<SpeakerRow>();
    const items = sp.results ?? [];
    const catChip = ber?.cat_name
      ? `<p><span class="chip"><span class="chip__dot" style="background:${esc(ber.cat_color ?? '#88bc1d')}"></span>${esc(ber.cat_name)}</span></p>`
      : '';
    const heading = `<div class="section-head">
      <span class="eyebrow">Voorlichter${items.length === 1 ? '' : 's'}</span>
      <h2>${esc(ber?.name ?? 'Beroep')}</h2>
      ${catChip}
      <p><a href="/voorlichters">← Alle voorlichters</a></p>
    </div>`;
    // Leerling-box: toevoegen aan eigen avond + vraag vooraf (vraagt zo nodig om inloggen).
    const studentBox = `<div class="card-box" style="margin-top:26px;border-left:4px solid var(--c-accent)">
      <h3>Ben je leerling?</h3>
      <p>Voeg <strong>${esc(ber?.name ?? 'dit beroep')}</strong> toe aan jouw avond, of stel vooraf een vraag aan de voorlichter.</p>
      <div class="reserve-actions" style="justify-content:flex-start">
        <form method="post" action="/leerling/kies" class="inline-form"><input type="hidden" name="beroep_id" value="${beroepId}"><button class="btn btn--primary" type="submit">+ Voeg toe aan mijn avond</button></form>
      </div>
      <form method="post" action="/leerling/vraag" style="margin-top:14px">
        <input type="hidden" name="beroep_id" value="${beroepId}">
        <div class="field"><label>Vraag vooraf (optioneel)</label><textarea name="question" rows="2" placeholder="Bijv. welke opleiding heb je gevolgd?"></textarea></div>
        <button class="btn btn--ghost btn--sm" type="submit">Vraag versturen</button>
      </form>
      <p class="muted" style="font-size:.85rem;margin-top:8px">Nog geen account? Je wordt gevraagd in te loggen — gratis, met je e-mail. <a href="/leerling">Mijn avond ↗</a></p>
    </div>`;
    if (!items.length) {
      return `${heading}<div class="callout"><p>Voor dit beroep is nog geen voorlichter bekendgemaakt.</p></div>${studentBox}`;
    }
    return `${heading}<div class="grid grid--auto">${items.map(speakerCard).join('')}</div>${studentBox}`;
  }

  const [cats, spk] = await Promise.all([
    db.prepare('SELECT id, name, color FROM categories ORDER BY sort_order').all<{ id: string; name: string; color: string | null }>(),
    db
      .prepare(
        'SELECT full_name, job_title, organization, portrait_url, linkedin, category_id FROM speakers WHERE is_public = 1 AND confirmed = 1 ORDER BY full_name'
      )
      .all<SpeakerRow>(),
  ]);
  const list = spk.results ?? [];
  if (!list.length) {
    return beroepenPreview(db);
  }

  const byCat = new Map<string, SpeakerRow[]>();
  for (const s of list) {
    const k = s.category_id ?? '_none';
    (byCat.get(k) ?? byCat.set(k, []).get(k)!).push(s);
  }
  const categories = cats.results ?? [];

  const filterButtons = [
    `<button class="active" data-cat="all" type="button">Alle (${list.length})</button>`,
    ...categories
      .filter((c) => (byCat.get(c.id) ?? []).length)
      .map(
        (c) =>
          `<button data-cat="${esc(c.id)}" type="button"><span class="chip__dot" style="background:${esc(c.color ?? '#88bc1d')};display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px"></span>${esc(c.name)}</button>`
      ),
  ].join('');

  const sections = categories
    .map((c) => {
      const items = byCat.get(c.id) ?? [];
      if (!items.length) return '';
      return `<section class="cat-section" data-cat="${esc(c.id)}">
        <div class="cat-section__head">
          <span class="chip__dot" style="background:${esc(c.color ?? '#88bc1d')};width:14px;height:14px;border-radius:50%;display:inline-block"></span>
          <h3>${esc(c.name)}</h3>
          <span class="cat-section__count">${items.length} voorlichters</span>
        </div>
        <div class="grid grid--auto">${items.map(speakerCard).join('')}</div>
      </section>`;
    })
    .join('');
  const uncategorized = byCat.get('_none') ?? [];
  const restSection = uncategorized.length
    ? `<section class="cat-section" data-cat="_none">
        <div class="cat-section__head"><h3>Overig</h3><span class="cat-section__count">${uncategorized.length}</span></div>
        <div class="grid grid--auto">${uncategorized.map(speakerCard).join('')}</div>
      </section>`
    : '';

  return `
    <div class="catalog-tools">
      <input type="search" class="catalog-search" id="voorSearch" placeholder="Zoek een voorlichter…" aria-label="Zoek een voorlichter">
    </div>
    <div class="cat-filter" id="voorFilter">${filterButtons}</div>
    <div id="voorlichters">${sections}${restSection}</div>
    <p class="catalog-empty" id="voorEmpty">Geen voorlichters gevonden.</p>
    <script>
    (function(){
      var search=document.getElementById('voorSearch'),filter=document.getElementById('voorFilter'),empty=document.getElementById('voorEmpty');
      var secs=[].slice.call(document.querySelectorAll('#voorlichters .cat-section')),active='all';
      function apply(){
        var q=(search.value||'').trim().toLowerCase(),any=false;
        secs.forEach(function(sec){
          var catOk=active==='all'||sec.getAttribute('data-cat')===active,vis=0;
          [].slice.call(sec.querySelectorAll('.speaker-card')).forEach(function(card){
            var m=catOk&&(!q||card.getAttribute('data-name').indexOf(q)>-1);
            card.style.display=m?'':'none'; if(m)vis++;
          });
          sec.style.display=vis>0?'':'none'; if(vis>0)any=true;
        });
        empty.style.display=any?'none':'block';
      }
      search.addEventListener('input',apply);
      filter.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;active=b.getAttribute('data-cat');
        [].slice.call(filter.querySelectorAll('button')).forEach(function(x){x.classList.toggle('active',x===b);});apply();});
    })();
    </script>`;
}

// ----------------------------------------------------------------------
// Nieuws-overzicht
// ----------------------------------------------------------------------

function dateNL(unix: number): string {
  const d = new Date(unix * 1000);
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
}

export async function renderNieuwsList(db: D1Database): Promise<string> {
  const rows = await db
    .prepare(
      'SELECT slug, title, summary, cover_url, published_at FROM announcements WHERE is_published = 1 ORDER BY published_at DESC'
    )
    .all<{ slug: string; title: string; summary: string | null; cover_url: string | null; published_at: number }>();
  const list = rows.results ?? [];
  if (!list.length) {
    return `<div class="callout"><p>Er is nog geen nieuws. Houd deze pagina in
      de gaten — of <a href="/nieuwsbrief">meld je aan voor updates</a>.</p></div>`;
  }
  const cards = list
    .map(
      (n) => `<a class="card-box news-card" href="/nieuws/${esc(n.slug)}">
        ${n.cover_url ? `<img class="news-card__img" src="${esc(n.cover_url)}" alt="" loading="lazy" decoding="async">` : ''}
        <div class="news-card__body">
          <time>${dateNL(n.published_at)}</time>
          <h3>${esc(n.title)}</h3>
          ${n.summary ? `<p>${esc(n.summary)}</p>` : ''}
        </div>
      </a>`
    )
    .join('');
  return `<div class="grid grid--2">${cards}</div>`;
}

export async function renderNieuwsItem(
  db: D1Database,
  slug: string
): Promise<{ title: string; summary: string | null; html: string; cover: string | null; date: number } | null> {
  const n = await db
    .prepare(
      'SELECT title, summary, body_md, cover_url, published_at FROM announcements WHERE slug = ? AND is_published = 1'
    )
    .bind(slug)
    .first<{ title: string; summary: string | null; body_md: string; cover_url: string | null; published_at: number }>();
  if (!n) return null;
  const html = `
    <p class="crumbs" style="padding:0 0 10px">${dateNL(n.published_at)}</p>
    ${n.cover_url ? `<img src="${esc(n.cover_url)}" alt="" style="width:100%;border-radius:6px;margin-bottom:24px">` : ''}
    <div class="prose">${renderMarkdown(n.body_md)}</div>
    <p style="margin-top:30px"><a class="btn btn--ghost" href="/nieuws">← Al het nieuws</a></p>`;
  return { title: n.title, summary: n.summary, html, cover: n.cover_url, date: n.published_at };
}

// ----------------------------------------------------------------------
// Formulieren
// ----------------------------------------------------------------------

type Vals = Record<string, string>;

function val(v: Vals | undefined, k: string): string {
  return esc(v?.[k] ?? '');
}

export function contactFormHtml(settings: SettingsMap, values?: Vals): string {
  return `
    <div class="grid grid--2" style="align-items:start">
      <form class="form card-box" method="post" action="/contact">
        <div class="form__row cols-2">
          <div class="field"><label>Naam <span class="req">*</span></label>
            <input type="text" name="name" value="${val(values, 'name')}" required></div>
          <div class="field"><label>E-mail <span class="req">*</span></label>
            <input type="email" name="email" value="${val(values, 'email')}" required></div>
        </div>
        <div class="field"><label>Onderwerp</label>
          <input type="text" name="subject" value="${val(values, 'subject')}"></div>
        <div class="field"><label>Bericht <span class="req">*</span></label>
          <textarea name="message" required>${val(values, 'message')}</textarea></div>
        <input type="text" name="website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
        ${settings['turnstile_site_key'] ? `<div class="cf-turnstile" data-sitekey="${esc(settings['turnstile_site_key'])}" style="margin:4px 0 12px"></div><script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>` : ''}
        <div class="form__actions">
          <button type="submit" class="btn btn--primary btn--lg">Versturen</button>
        </div>
        <p class="form-consent">Je gegevens worden alleen gebruikt om je vraag te
          beantwoorden. Zie ons <a href="/privacy">privacybeleid</a>.</p>
      </form>
      <div>
        <div class="card-box">
          <h3>Direct contact</h3>
          <p><strong>E-mail</strong><br><a href="mailto:${esc(settings['contact_email'] || '')}">${esc(settings['contact_email'] || '')}</a></p>
          ${settings['org_phone'] ? `<p><strong>Telefoon</strong><br>${esc(settings['org_phone'])}</p>` : ''}
          <p><strong>Locatie van de avond</strong><br>${esc(settings['venue_name'] || '')}<br>${esc(settings['venue_address'] || '')}</p>
        </div>
      </div>
    </div>`;
}

export function volunteerFormHtml(settings: SettingsMap, values?: Vals): string {
  return `
    <form class="form card-box" method="post" action="/aanmelden">
      <div class="form__row cols-2">
        <div class="field"><label>Naam <span class="req">*</span></label>
          <input type="text" name="name" value="${val(values, 'name')}" required></div>
        <div class="field"><label>E-mail <span class="req">*</span></label>
          <input type="email" name="email" value="${val(values, 'email')}" required></div>
        <div class="field"><label>Telefoon</label>
          <input type="tel" name="phone" value="${val(values, 'phone')}"></div>
        <div class="field"><label>Organisatie / werkgever</label>
          <input type="text" name="organization" value="${val(values, 'organization')}"></div>
      </div>
      <div class="field"><label>Welk beroep wil je presenteren? <span class="req">*</span></label>
        <input type="text" name="profession" value="${val(values, 'profession')}" required placeholder="bijv. Architect, Verpleegkundige, Piloot…"></div>
      <div class="field"><label>Toelichting (optioneel)</label>
        <textarea name="message" placeholder="Vertel kort over jezelf en je vak.">${val(values, 'message')}</textarea></div>
      <input type="text" name="website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
      ${settings['turnstile_site_key'] ? `<div class="cf-turnstile" data-sitekey="${esc(settings['turnstile_site_key'])}" style="margin:4px 0 12px"></div><script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>` : ''}
      <div class="form__actions">
        <button type="submit" class="btn btn--primary btn--lg">Aanmelding versturen</button>
      </div>
      <p class="form-consent">Na je aanmelding nemen we contact op met de
        details voor de avond op ${esc(settings['event_date_long'] || '')}.
        Zie ons <a href="/privacy">privacybeleid</a>.</p>
    </form>`;
}
