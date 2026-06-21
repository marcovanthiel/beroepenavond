/**
 * Leerling-portaal onder /leerling. Magic-link login, dashboard
 * ("Mijn avond"), beroepen kiezen, interesseprofiel + aanbevelingen,
 * vraag vooraf en agenda-export (.ics).
 */
import { Hono } from 'hono';
import type { StudentEnv } from '../lib/studentauth';
import { requestLogin, verifyToken, getCurrentStudent, logoutStudent, requireStudent } from '../lib/studentauth';
import { getNavPages, getSettings } from '../lib/db';
import { renderLayout } from '../views/layout';

export const studentApp = new Hono<StudentEnv>();

const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function page(
  c: any,
  opts: { title: string; eyebrow?: string; lede?: string; body: string; notice?: { type: 'ok' | 'err'; text: string } | null }
) {
  const [settings, navItems] = await Promise.all([getSettings(c.env.DB), getNavPages(c.env.DB)]);
  return c.html(
    renderLayout({
      title: `${opts.title} — Beroepenavond Nijmegen`,
      navItems,
      activeSlug: '/leerling',
      canonicalPath: '/leerling',
      notice: opts.notice ?? null,
      hero: { eyebrow: opts.eyebrow ?? 'Mijn avond', title: opts.title, lede: opts.lede ?? null, compact: true },
      bodyHtml: opts.body,
      settings,
    })
  );
}

// ----------------------------------------------------------------------
// Login / registratie (magic link)
// ----------------------------------------------------------------------

function loginForm(notice?: string): string {
  return `
    <div class="grid grid--2" style="align-items:start">
      <form class="form card-box" method="post" action="/leerling/login">
        <h3>Inloggen of account aanmaken</h3>
        <p class="muted">Je krijgt een inloglink per e-mail — geen wachtwoord nodig.</p>
        <div class="field"><label>E-mail <span class="req">*</span></label>
          <input type="email" name="email" required autocomplete="email"></div>
        <div class="field"><label>Naam</label><input type="text" name="name" autocomplete="name"></div>
        <div class="form__row cols-2">
          <div class="field"><label>School</label><input type="text" name="school"></div>
          <div class="field"><label>Profiel / niveau</label><input type="text" name="profiel" placeholder="bv. havo N&amp;T"></div>
        </div>
        <input type="text" name="website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
        <div class="form__actions"><button class="btn btn--primary btn--lg" type="submit">Stuur mij een inloglink</button></div>
      </form>
      <div class="card-box">
        <h3>Wat kun je met een account?</h3>
        <ul>
          <li>Kies de <strong>beroepen die je wilt volgen</strong> en bewaar ze.</li>
          <li>Krijg <strong>aanbevelingen</strong> op basis van je interesses.</li>
          <li>Stel <strong>vooraf een vraag</strong> aan een voorlichter.</li>
          <li>Straks: je <strong>persoonlijke rooster</strong> + in je agenda.</li>
          <li>Schrijf je in voor de <strong>nieuwsbrief</strong>.</li>
        </ul>
      </div>
    </div>`;
}

studentApp.get('/', async (c) => {
  const student = await getCurrentStudent(c);
  const q = c.req.query();
  if (!student) {
    let notice = null as null | { type: 'ok' | 'err'; text: string };
    if (q.sent) notice = { type: 'ok', text: 'Check je mailbox! We hebben je een inloglink gestuurd (kijk ook in spam).' };
    if (q.error) notice = { type: 'err', text: 'Die inloglink is verlopen of al gebruikt. Vraag een nieuwe aan.' };
    return page(c, { title: 'Mijn Beroepenavond', eyebrow: 'Voor leerlingen', lede: 'Plan jouw avond: kies beroepen, krijg tips en stel vragen.', body: loginForm(), notice });
  }
  c.set('student', student);
  return dashboard(c);
});

studentApp.post('/login', async (c) => {
  const b = await c.req.parseBody();
  if (str(b.website)) return c.redirect('/leerling?sent=1', 302); // honeypot
  const email = str(b.email);
  if (!EMAIL_RE.test(email)) {
    return page(c, { title: 'Mijn Beroepenavond', eyebrow: 'Voor leerlingen', body: loginForm(), notice: { type: 'err', text: 'Vul een geldig e-mailadres in.' } });
  }
  await requestLogin(c, { email, name: str(b.name), school: str(b.school), profiel: str(b.profiel) });
  return c.redirect('/leerling?sent=1', 302);
});

studentApp.get('/verify', async (c) => {
  const student = await verifyToken(c, c.req.query('token') ?? '');
  return c.redirect(student ? '/leerling' : '/leerling?error=1', 302);
});

studentApp.post('/logout', async (c) => {
  await logoutStudent(c);
  return c.redirect('/leerling', 302);
});

// ----------------------------------------------------------------------
// Dashboard ("Mijn avond")
// ----------------------------------------------------------------------

async function dashboard(c: any) {
  const s = c.get('student');
  const q = c.req.query();
  const [picks, interests, questions] = await Promise.all([
    c.env.DB.prepare(
      `SELECT b.id, b.name, cat.name AS cat_name, cat.color AS cat_color,
              (SELECT COUNT(*) FROM speakers sp WHERE sp.beroep_id=b.id AND sp.is_public=1 AND sp.confirmed=1) AS n_sprekers
         FROM student_picks p JOIN beroepen b ON b.id=p.beroep_id
         LEFT JOIN categories cat ON cat.id=b.category_id
        WHERE p.student_id=? ORDER BY cat.sort_order, b.name`
    ).bind(s.id).all(),
    c.env.DB.prepare('SELECT category_id FROM student_interests WHERE student_id=?').bind(s.id).all(),
    c.env.DB.prepare('SELECT q.question, q.status, b.name AS beroep FROM student_questions q LEFT JOIN beroepen b ON b.id=q.beroep_id WHERE q.student_id=? ORDER BY q.created_at DESC').bind(s.id).all(),
  ]);
  const pickRows = picks.results ?? [];
  const interestIds = new Set((interests.results ?? []).map((r: any) => r.category_id));

  // Aanbevelingen: beroepen in interesse-categorieën, nog niet gekozen.
  let recHtml = '';
  if (interestIds.size) {
    const rec = await c.env.DB.prepare(
      `SELECT b.id, b.name FROM beroepen b
        WHERE b.category_id IN (${[...interestIds].map(() => '?').join(',')})
          AND b.id NOT IN (SELECT beroep_id FROM student_picks WHERE student_id=?)
        ORDER BY b.name LIMIT 12`
    ).bind(...[...interestIds], s.id).all();
    const items = rec.results ?? [];
    recHtml = items.length
      ? `<div class="card-box"><h3>Misschien ook interessant</h3><div class="cat-filter">${items
          .map((r: any) => `<form method="post" action="/leerling/kies" class="inline-form"><input type="hidden" name="beroep_id" value="${r.id}"><button class="btn btn--ghost btn--sm" type="submit">+ ${esc(r.name)}</button></form>`)
          .join(' ')}</div></div>`
      : '';
  }

  const picksHtml = pickRows.length
    ? `<div class="grid grid--2">${pickRows
        .map(
          (r: any) => `<div class="card-box" style="display:flex;justify-content:space-between;align-items:center;gap:10px">
        <div><strong>${esc(r.name)}</strong><br>
          <span class="muted" style="font-size:.85rem">${r.cat_name ? `<span class="chip__dot" style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${esc(r.cat_color ?? '#88bc1d')};margin-right:5px"></span>${esc(r.cat_name)}` : ''}${r.n_sprekers ? ` · ${r.n_sprekers} voorlichter(s)` : ''}</span></div>
        <div style="display:flex;gap:6px;align-items:center">
          ${r.n_sprekers ? `<a class="btn btn--ghost btn--sm" href="/voorlichters?beroep=${r.id}">Bekijk</a>` : ''}
          <form method="post" action="/leerling/kies" class="inline-form"><input type="hidden" name="beroep_id" value="${r.id}"><input type="hidden" name="remove" value="1"><button class="btn btn--ghost btn--sm" type="submit" title="Verwijderen">×</button></form>
        </div>
      </div>`
        )
        .join('')}</div>`
    : `<div class="callout"><p>Je hebt nog geen beroepen gekozen. <a href="/leerling/kiezen">Kies je beroepen →</a></p></div>`;

  const questionRows = questions.results ?? [];
  const questionsHtml = questionRows.length
    ? `<div class="card-box"><h3>Mijn vragen vooraf</h3><ul>${questionRows
        .map((r: any) => `<li><strong>${esc(r.beroep ?? 'Algemeen')}:</strong> ${esc(r.question)} <span class="muted">(${r.status === 'new' ? 'verstuurd' : esc(r.status)})</span></li>`)
        .join('')}</ul></div>`
    : '';

  const notice = q.ok ? { type: 'ok' as const, text: String(q.ok) } : null;

  const body = `
    <div class="card-box" style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
      <div>Ingelogd als <strong>${esc(s.name || s.email)}</strong>${s.school ? ` · ${esc(s.school)}` : ''}${s.profiel ? ` · ${esc(s.profiel)}` : ''}</div>
      <div style="display:flex;gap:8px">
        <a class="btn btn--ghost btn--sm" href="/leerling/profiel">Profiel & interesses</a>
        <form method="post" action="/leerling/logout" class="inline-form"><button class="btn btn--ghost btn--sm" type="submit">Uitloggen</button></form>
      </div>
    </div>

    <div class="section-head" style="margin:30px 0 14px"><h2>Mijn gekozen beroepen</h2><p><a href="/leerling/kiezen" class="btn btn--primary">+ Beroepen kiezen</a> ${pickRows.length ? `<a class="btn btn--ghost" href="/leerling/rooster.ics">In mijn agenda (.ics)</a>` : ''}</p></div>
    ${picksHtml}
    ${recHtml}

    <div class="section-head" style="margin:30px 0 14px"><h2>Mijn rooster</h2></div>
    <div class="callout"><p>Zodra de organisatie het rooster publiceert, zie je hier per ronde in welk lokaal jouw gekozen beroepen plaatsvinden — met een waarschuwing bij dubbele keuzes. Je keuzes hierboven worden dan automatisch ingepland.</p></div>

    ${questionsHtml}

    <div class="card-box" style="margin-top:22px">
      <h3>Nieuwsbrief</h3>
      <form method="post" action="/leerling/nieuwsbrief">
        <label class="field" style="flex-direction:row;align-items:center;gap:10px">
          <input type="checkbox" name="newsletter" value="1" ${s.newsletter ? 'checked' : ''} onchange="this.form.submit()">
          <span>Houd mij per e-mail op de hoogte van de Beroepenavond</span>
        </label>
      </form>
    </div>`;

  return page(c, { title: 'Mijn avond', eyebrow: `Hoi ${esc((s.name || '').split(' ')[0] || '')}`, body, notice });
}

// ----------------------------------------------------------------------
// Beroepen kiezen
// ----------------------------------------------------------------------

studentApp.get('/kiezen', requireStudent, async (c) => {
  const s = c.get('student');
  const [cats, ber, picks] = await Promise.all([
    c.env.DB.prepare('SELECT id, name, color FROM categories ORDER BY sort_order').all(),
    c.env.DB.prepare('SELECT id, name, category_id FROM beroepen ORDER BY category_id, name').all(),
    c.env.DB.prepare('SELECT beroep_id FROM student_picks WHERE student_id=?').bind(s.id).all(),
  ]);
  const picked = new Set((picks.results ?? []).map((r: any) => r.beroep_id));
  const byCat = new Map<string, any[]>();
  for (const b of (ber.results ?? []) as any[]) (byCat.get(b.category_id) ?? byCat.set(b.category_id, []).get(b.category_id)!).push(b);
  const sections = (cats.results ?? [])
    .map((cat: any) => {
      const items = byCat.get(cat.id) ?? [];
      if (!items.length) return '';
      return `<section class="cat-section">
        <div class="cat-section__head"><span class="chip__dot" style="background:${esc(cat.color ?? '#88bc1d')};width:14px;height:14px;border-radius:50%;display:inline-block"></span><h3>${esc(cat.name)}</h3></div>
        <div class="beroep-grid">${items
          .map((b: any) => {
            const on = picked.has(b.id);
            return `<div class="beroep"><form method="post" action="/leerling/kies?to=kiezen" class="inline-form">
              <input type="hidden" name="beroep_id" value="${b.id}">${on ? '<input type="hidden" name="remove" value="1">' : ''}
              <button class="btn ${on ? 'btn--secondary' : 'btn--ghost'} btn--sm" type="submit">${on ? '✓ ' : '+ '}${esc(b.name)}</button>
            </form></div>`;
          })
          .join('')}</div>
      </section>`;
    })
    .join('');
  const body = `<p><a href="/leerling">← Terug naar Mijn avond</a></p>
    <p class="prose-lead">Klik een beroep aan om het aan je avond toe te voegen. Je keuze wordt meteen bewaard.</p>${sections}`;
  return page(c, { title: 'Beroepen kiezen', body });
});

studentApp.post('/kies', requireStudent, async (c) => {
  const s = c.get('student');
  const b = await c.req.parseBody();
  const beroepId = parseInt(str(b.beroep_id), 10);
  if (Number.isFinite(beroepId)) {
    if (str(b.remove)) {
      await c.env.DB.prepare('DELETE FROM student_picks WHERE student_id=? AND beroep_id=?').bind(s.id, beroepId).run();
    } else {
      await c.env.DB.prepare('INSERT OR IGNORE INTO student_picks (student_id, beroep_id) VALUES (?, ?)').bind(s.id, beroepId).run();
    }
  }
  return c.redirect(c.req.query('to') === 'kiezen' ? '/leerling/kiezen' : '/leerling', 302);
});

// ----------------------------------------------------------------------
// Profiel & interesses
// ----------------------------------------------------------------------

studentApp.get('/profiel', requireStudent, async (c) => {
  const s = c.get('student');
  const [cats, interests] = await Promise.all([
    c.env.DB.prepare('SELECT id, name FROM categories ORDER BY sort_order').all(),
    c.env.DB.prepare('SELECT category_id FROM student_interests WHERE student_id=?').bind(s.id).all(),
  ]);
  const on = new Set((interests.results ?? []).map((r: any) => r.category_id));
  const checks = (cats.results ?? [])
    .map((cat: any) => `<label class="field" style="flex-direction:row;align-items:center;gap:9px"><input type="checkbox" name="interest" value="${esc(cat.id)}" ${on.has(cat.id) ? 'checked' : ''}><span>${esc(cat.name)}</span></label>`)
    .join('');
  const body = `<p><a href="/leerling">← Terug naar Mijn avond</a></p>
    <form class="form card-box" method="post" action="/leerling/profiel">
      <div class="form__row cols-2">
        <div class="field"><label>Naam</label><input type="text" name="name" value="${esc(s.name)}"></div>
        <div class="field"><label>E-mail</label><input type="email" value="${esc(s.email)}" disabled></div>
        <div class="field"><label>School</label><input type="text" name="school" value="${esc(s.school)}"></div>
        <div class="field"><label>Profiel / niveau</label><input type="text" name="profiel" value="${esc(s.profiel)}" placeholder="bv. havo N&amp;T"></div>
      </div>
      <p class="fld__label" style="margin:6px 0">Mijn interesses (voor aanbevelingen)</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:4px;margin-bottom:14px">${checks}</div>
      <div class="form__actions"><button class="btn btn--primary" type="submit">Opslaan</button></div>
    </form>`;
  return page(c, { title: 'Profiel & interesses', body });
});

studentApp.post('/profiel', requireStudent, async (c) => {
  const s = c.get('student');
  const b = await c.req.parseBody({ all: true });
  await c.env.DB.prepare('UPDATE students SET name=?, school=?, profiel=? WHERE id=?')
    .bind(str(b.name) || null, str(b.school) || null, str(b.profiel) || null, s.id)
    .run();
  const sel = b.interest;
  const ids = Array.isArray(sel) ? sel.map(String) : sel ? [String(sel)] : [];
  const stmts = [c.env.DB.prepare('DELETE FROM student_interests WHERE student_id=?').bind(s.id)];
  for (const cid of ids) stmts.push(c.env.DB.prepare('INSERT OR IGNORE INTO student_interests (student_id, category_id) VALUES (?, ?)').bind(s.id, cid));
  await c.env.DB.batch(stmts);
  return c.redirect('/leerling?ok=' + encodeURIComponent('Profiel opgeslagen.'), 302);
});

// ----------------------------------------------------------------------
// Vraag vooraf
// ----------------------------------------------------------------------

studentApp.post('/vraag', requireStudent, async (c) => {
  const s = c.get('student');
  const b = await c.req.parseBody();
  const beroepId = parseInt(str(b.beroep_id), 10);
  const question = str(b.question);
  if (question) {
    await c.env.DB.prepare('INSERT INTO student_questions (student_id, beroep_id, question) VALUES (?, ?, ?)')
      .bind(s.id, Number.isFinite(beroepId) ? beroepId : null, question)
      .run();
  }
  return c.redirect('/leerling?ok=' + encodeURIComponent('Je vraag is verstuurd naar de organisatie.'), 302);
});

// ----------------------------------------------------------------------
// Nieuwsbrief-toggle (sluit aan op de bestaande subscribers-lijst)
// ----------------------------------------------------------------------

studentApp.post('/nieuwsbrief', requireStudent, async (c) => {
  const s = c.get('student');
  const b = await c.req.parseBody();
  const on = str(b.newsletter) === '1' ? 1 : 0;
  await c.env.DB.prepare('UPDATE students SET newsletter=? WHERE id=?').bind(on, s.id).run();
  if (on) {
    await c.env.DB.prepare(
      `INSERT INTO subscribers (email, name, status, confirmed_at) VALUES (?, ?, 'active', unixepoch())
       ON CONFLICT(email) DO UPDATE SET status='active'`
    ).bind(s.email, s.name).run();
  } else {
    await c.env.DB.prepare("UPDATE subscribers SET status='unsubscribed' WHERE email=?").bind(s.email).run();
  }
  return c.redirect('/leerling?ok=' + encodeURIComponent(on ? 'Je staat op de nieuwsbrief.' : 'Je bent uitgeschreven.'), 302);
});

// ----------------------------------------------------------------------
// Agenda-export (.ics) van de avond + jouw gekozen beroepen
// ----------------------------------------------------------------------

studentApp.get('/rooster.ics', requireStudent, async (c) => {
  const s = c.get('student');
  const settings = await getSettings(c.env.DB);
  const picks = await c.env.DB.prepare('SELECT b.name FROM student_picks p JOIN beroepen b ON b.id=p.beroep_id WHERE p.student_id=? ORDER BY b.name').bind(s.id).all<{ name: string }>();
  const date = (settings['event_date'] || c.env.EVENT_DATE || '2026-11-20').replace(/-/g, '');
  const venue = `${settings['venue_name'] || ''}, ${settings['venue_address'] || ''}`.replace(/^,\s*/, '');
  const chosen = (picks.results ?? []).map((p) => p.name).join(', ') || 'Nog geen beroepen gekozen';
  const desc = `Mijn gekozen beroepen: ${chosen}. Bekijk je avond op https://${settings['site_host'] || 'inijmegen.com'}/leerling`.replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Beroepenavond Nijmegen//NL', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT', `UID:beroepenavond-${s.id}@inijmegen.com`,
    `DTSTART;TZID=Europe/Amsterdam:${date}T183000`, `DTEND;TZID=Europe/Amsterdam:${date}T213000`,
    'SUMMARY:Beroepenavond Nijmegen', `LOCATION:${venue.replace(/([,;\\])/g, '\\$1')}`, `DESCRIPTION:${desc}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  return new Response(ics, {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'attachment; filename="beroepenavond.ics"' },
  });
});
