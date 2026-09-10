/**
 * Admin-applicatie. Volgorde van registratie is belangrijk:
 *   1. publieke auth-routes (login/setup/logout) — vóór requireAuth
 *   2. requireAuth-middleware
 *   3. dashboard + alle CRUD-submodules — achter de middleware
 */
import { Hono } from 'hono';
import {
  AdminEnv,
  requireAuth,
  getCurrentUser,
  countUsers,
  findUserByEmail,
  createUser,
  createSession,
  destroySession,
  genCode,
  setLoginCode,
  verifyLoginCode,
  logAudit,
} from '../../lib/auth';
import { renderLogin, renderSetup, renderCodeForm } from '../../views/admin/login';
import { renderAdminLayout, esc } from '../../views/admin/layout';
import { str, redirectErr } from '../../lib/forms';
import { getSettings } from '../../lib/db';
import { mailConfig, sendEmail, emailShell } from '../../lib/email';
import pkg from '../../../package.json';

import { pagesApp } from './pages';
import { settingsApp } from './settings';
import { eventsApp } from './events';
import { roundsApp } from './rounds';
import { categoriesApp } from './categories';
import { beroepenApp } from './beroepen';
import { speakersApp } from './speakers';
import { classroomsApp } from './classrooms';
import { floorplansApp } from './floorplans';
import { sessionsApp } from './sessions';
import { editorApp } from './floorplan-editor';
import { inboxApp } from './inbox';
import { subscribersApp } from './subscribers';
import { announcementsApp } from './announcements';
import { usersApp } from './users';
import { accountApp } from './account';
import { mediaApp } from './media';
import { auditApp } from './audit';
import { sponsorsApp } from './sponsors';
import { leerlingenApp } from './leerlingen';

export const adminApp = new Hono<AdminEnv>();

// ----------------------------------------------------------------------
// 1. Publieke auth-routes
// ----------------------------------------------------------------------

adminApp.get('/login', async (c) => {
  if (await getCurrentUser(c)) return c.redirect('/admin', 302);
  if ((await countUsers(c.env.DB)) === 0) return renderSetup(c);
  return renderLogin(c, { next: c.req.query('next'), error: c.req.query('err') });
});

// Stap 1: e-mailadres → stuur een 6-cijferige code (alleen als er een account bestaat).
adminApp.post('/login', async (c) => {
  const body = await c.req.parseBody();
  const email = str(body.email).trim().toLowerCase();
  const next = str(body.next) || '/admin';
  if (email) {
    const user = await findUserByEmail(c.env.DB, email);
    if (user) {
      const code = genCode();
      await setLoginCode(c.env.DB, email, code);
      try {
        const settings = await getSettings(c.env.DB);
        const cfg = mailConfig(c.env, settings);
        const inner = `
          <p>Hoi${user.name ? ' ' + esc(user.name) : ''},</p>
          <p>Gebruik deze code om in te loggen op het beheer van de Beroepenavond:</p>
          <p style="text-align:center;margin:22px 0"><span style="display:inline-block;background:#ffffff;border:3px solid #0d0d0d;padding:14px 26px;font-size:30px;font-weight:bold;letter-spacing:8px;color:#0d0d0d">${code}</span></p>
          <p style="color:#8a9099;font-size:13px">De code is 10 minuten geldig. Niet aangevraagd? Negeer deze e-mail.</p>`;
        await sendEmail(cfg, {
          to: email,
          subject: `Je inlogcode ${code} — Beheer Beroepenavond`,
          html: emailShell('Inlogcode', inner, cfg.brand),
          text: `Je inlogcode voor het beheer van de Beroepenavond is: ${code}\n\nDe code is 10 minuten geldig.`,
        });
      } catch (e) {
        console.error('inlogcode mailen faalde:', e);
      }
    }
  }
  // Altijd dezelfde vervolgstap — verraadt niet of het e-mailadres een account is.
  return renderCodeForm(c, { email, next });
});

// Stap 2: code controleren → sessie aanmaken.
adminApp.post('/code', async (c) => {
  const body = await c.req.parseBody();
  const email = str(body.email).trim().toLowerCase();
  const code = str(body.code).trim();
  const next = str(body.next) || '/admin';
  const ok = email && code ? await verifyLoginCode(c.env.DB, email, code) : false;
  const user = ok ? await findUserByEmail(c.env.DB, email) : null;
  if (!ok || !user) {
    return renderCodeForm(c, { email, next, error: 'Onjuiste of verlopen code. Vraag eventueel een nieuwe code aan.' });
  }
  c.set('user', user);
  await createSession(c, user.id);
  await logAudit(c, 'login', 'user', user.id);
  return c.redirect(next.startsWith('/admin') ? next : '/admin', 302);
});

adminApp.get('/setup', async (c) => {
  if ((await countUsers(c.env.DB)) > 0) return c.redirect('/admin/login', 302);
  return renderSetup(c);
});

adminApp.post('/setup', async (c) => {
  if ((await countUsers(c.env.DB)) > 0) return c.redirect('/admin/login', 302);
  const body = await c.req.parseBody();
  const name = str(body.name);
  const email = str(body.email);
  const password = str(body.password);
  const password2 = str(body.password2);
  if (!name || !email || password.length < 10) {
    return renderSetup(c, { error: 'Vul alle velden in (wachtwoord min. 10 tekens).' });
  }
  if (password !== password2) {
    return renderSetup(c, { error: 'De wachtwoorden komen niet overeen.' });
  }
  const id = await createUser(c.env.DB, { name, email, password, role: 'admin' });
  const user = await findUserByEmail(c.env.DB, email);
  if (user) {
    c.set('user', user);
    await createSession(c, id);
    await logAudit(c, 'setup_first_admin', 'user', id);
  }
  return c.redirect('/admin', 302);
});

adminApp.post('/logout', async (c) => {
  await destroySession(c);
  return c.redirect('/admin/login', 302);
});

// ----------------------------------------------------------------------
// 2. Vanaf hier: ingelogd vereist
// ----------------------------------------------------------------------

adminApp.use('*', requireAuth);

// ----------------------------------------------------------------------
// 3. Dashboard
// ----------------------------------------------------------------------

adminApp.get('/', async (c) => {
  const db = c.env.DB;
  const q = (sql: string) =>
    db.prepare(sql).first<{ n: number }>().then((r) => r?.n ?? 0);
  const [beroepen, beroepenZonder, speakers, confirmedSpeakers, sessions, mapped, rounds, newMsgs, subs, news, settings, ev, recent] =
    await Promise.all([
      q('SELECT COUNT(*) n FROM beroepen'),
      q('SELECT COUNT(*) n FROM beroepen b WHERE NOT EXISTS (SELECT 1 FROM speakers s WHERE s.beroep_id = b.id)'),
      q('SELECT COUNT(*) n FROM speakers'),
      q('SELECT COUNT(*) n FROM speakers WHERE confirmed = 1'),
      q('SELECT COUNT(*) n FROM sessions_program'),
      q("SELECT COUNT(*) n FROM classrooms WHERE map_shape IS NOT NULL AND map_shape <> ''"),
      q('SELECT COUNT(*) n FROM rounds'),
      q("SELECT COUNT(*) n FROM submissions WHERE status IN ('new','read')"),
      q("SELECT COUNT(*) n FROM subscribers WHERE status='active'"),
      q('SELECT COUNT(*) n FROM announcements'),
      getSettings(db),
      db.prepare('SELECT title, date FROM events WHERE is_active = 1 LIMIT 1').first<{ title: string; date: string }>(),
      db
        .prepare('SELECT id, type, name, email, created_at FROM submissions ORDER BY created_at DESC LIMIT 6')
        .all<{ id: number; type: string; name: string | null; email: string | null; created_at: number }>(),
    ]);

  const published = (settings['voorlichters_published'] ?? '0') === '1';
  const mailOn = (settings['mail_enabled'] ?? '0') === '1';

  const stat = (n: number, label: string, href: string, accent = false) =>
    `<a class="stat" href="${href}"><div class="stat__n" ${accent && n > 0 ? 'style="color:#d4493f"' : ''}>${n}</div><div class="stat__l">${esc(label)}</div></a>`;

  // ---- Gereedheids-checklist "Klaar voor de avond" ----
  const checks = [
    { done: !!ev, label: 'Actieve editie ingesteld', hint: ev ? `${ev.title}` : 'Maak of activeer een editie', href: '/admin/events', fix: 'Edities' },
    { done: rounds > 0, label: 'Voorlichtingsrondes aangemaakt', hint: `${rounds} ronde(s)`, href: '/admin/rounds', fix: 'Rondes' },
    { done: confirmedSpeakers > 0, label: 'Voorlichters bevestigd', hint: `${confirmedSpeakers} van ${speakers} bevestigd`, href: '/admin/speakers', fix: 'Sprekers' },
    { done: sessions > 0, label: 'Sessies in het rooster', hint: `${sessions} sessie(s)`, href: '/admin/sessions', fix: 'Sessies' },
    { done: mapped > 0, label: 'Lokalen op de plattegrond', hint: `${mapped} lokaal/lokalen ingetekend`, href: '/admin/floorplan-editor', fix: 'Plattegrond' },
    { done: mailOn, label: 'E-mail (bevestigingen) werkt', hint: mailOn ? 'Verzending staat aan' : 'Zet e-mail aan bij Instellingen', href: '/admin/settings', fix: 'Instellingen' },
    { done: published, label: 'Voorlichters gepubliceerd op de site', hint: published ? 'Zichtbaar voor bezoekers' : 'Nog verborgen — zet publicatie aan', href: '/admin/speakers', fix: 'Publiceren' },
  ];
  const doneCount = checks.filter((x) => x.done).length;
  const pct = Math.round((doneCount / checks.length) * 100);
  const checklistHtml = checks
    .map(
      (x) => `<li class="${x.done ? 'done' : ''}">
        <span class="check-ico ${x.done ? 'check-ico--done' : 'check-ico--todo'}" aria-hidden="true">${x.done ? '✓' : '○'}</span>
        <span class="lbl">${esc(x.label)}<small>${esc(x.hint)}</small></span>
        ${x.done ? '' : `<a class="btn btn--ghost btn--sm fix" href="${x.href}">${esc(x.fix)} →</a>`}
      </li>`
    )
    .join('');

  const recentRows = (recent.results ?? [])
    .map(
      (r) => `<tr><td style="width:30px">${r.type === 'volunteer' ? '🙋' : '✉️'}</td>
        <td><a href="/admin/inbox/${r.id}">${esc(r.name ?? r.email ?? 'Onbekend')}</a></td>
        <td class="muted">${new Date(r.created_at * 1000).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td></tr>`
    )
    .join('');

  const quickActions = `
    <a class="btn btn--primary btn--sm" href="/admin/speakers/new">+ Spreker</a>
    <a class="btn btn--ghost btn--sm" href="/admin/nieuws/new">+ Nieuwsbericht</a>
    <a class="btn btn--ghost btn--sm" href="/admin/inbox">Postvak</a>
    <a class="btn btn--ghost btn--sm" href="/" target="_blank">Bekijk site ↗</a>`;

  const body = `
    <header class="page-head"><h1>Overzicht</h1><div class="page-head__actions">${quickActions}</div></header>
    <div class="card">
      <p style="margin:0">${ev ? `Actieve editie: <strong>${esc(ev.title)}</strong> — ${esc(ev.date)}` : '⚠️ Geen actieve editie ingesteld. <a href="/admin/events">Stel er een in →</a>'}</p>
    </div>
    <div class="card">
      <div class="card__head">
        <h2>Klaar voor de avond?</h2>
        <span class="muted">${doneCount} van ${checks.length} geregeld</span>
      </div>
      <div class="progress" aria-hidden="true"><span style="width:${pct}%"></span></div>
      <ul class="checklist">${checklistHtml}</ul>
    </div>
    <div class="stat-grid">
      ${stat(newMsgs, 'Openstaande berichten', '/admin/inbox', true)}
      ${stat(beroepenZonder, 'Beroepen zonder spreker', '/admin/beroepen?filter=zonder', true)}
      ${stat(subs, 'Nieuwsbrief-abonnees', '/admin/subscribers')}
      ${stat(beroepen, 'Beroepen', '/admin/beroepen')}
      ${stat(speakers, 'Sprekers', '/admin/speakers')}
      ${stat(sessions, 'Sessies', '/admin/sessions')}
      ${stat(news, 'Nieuwsberichten', '/admin/nieuws')}
    </div>
    <div class="card">
      <h2>Laatste inzendingen</h2>
      ${recentRows ? `<table class="data" style="width:100%">${recentRows}</table>` : '<p class="muted">Nog geen inzendingen.</p>'}
    </div>`;

  return renderAdminLayout(c, { title: 'Overzicht', activeKey: 'dashboard', body });
});

// ----------------------------------------------------------------------
// Software & versies — dependency-overzicht (huidig vs. laatste npm-versie)
// ----------------------------------------------------------------------

const cleanVer = (v: string) => String(v || '').replace(/^[\^~>=<\s]+/, '').trim();
async function npmLatest(name: string): Promise<string | null> {
  try {
    const r = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}/latest`, {
      headers: { accept: 'application/json' },
      cf: { cacheTtl: 3600, cacheEverything: true },
    } as RequestInit);
    if (!r.ok) return null;
    const j = (await r.json()) as { version?: string };
    return j.version || null;
  } catch {
    return null;
  }
}
type VerStatus = 'up-to-date' | 'minor-or-patch' | 'major' | 'unknown';
function classifyVer(cur: string, latest: string | null): VerStatus {
  if (!latest) return 'unknown';
  const c = cleanVer(cur);
  if (!c) return 'unknown';
  if (c === latest) return 'up-to-date';
  const cMaj = parseInt(c.split('.')[0], 10) || 0;
  const lMaj = parseInt(latest.split('.')[0], 10) || 0;
  return lMaj > cMaj ? 'major' : 'minor-or-patch';
}

adminApp.get('/software', async (c) => {
  type Row = { name: string; current: string; grp: 'prod' | 'dev'; latest: string | null; status: VerStatus };
  const entries: Row[] = [
    ...Object.entries((pkg as any).dependencies || {}).map(([name, current]) => ({ name, current: String(current), grp: 'prod' as const, latest: null, status: 'unknown' as VerStatus })),
    ...Object.entries((pkg as any).devDependencies || {}).map(([name, current]) => ({ name, current: String(current), grp: 'dev' as const, latest: null, status: 'unknown' as VerStatus })),
  ];
  const latests = await Promise.all(entries.map((e) => npmLatest(e.name)));
  entries.forEach((e, i) => { e.latest = latests[i]; e.status = classifyVer(e.current, latests[i]); });
  let vinfo: { version?: string; commit?: string; date?: string } | null = null;
  try {
    const r = await c.env.ASSETS.fetch(new Request(new URL('/assets/version.json', c.req.url)));
    if (r.ok) vinfo = await r.json();
  } catch {}
  const hono = entries.find((e) => e.name === 'hono');

  const BADGE: Record<VerStatus, [string, string, string]> = {
    'up-to-date': ['Up-to-date', '#0c7a3f', '#e6f5ec'],
    'minor-or-patch': ['Minor / patch beschikbaar', '#8a6100', '#fdf4dd'],
    major: ['Major beschikbaar', '#9b2226', '#fbe6e6'],
    unknown: ['Onbekend', '#555', '#eee'],
  };
  const badge = (s: VerStatus) => { const [t, fg, bg] = BADGE[s]; return `<span style="display:inline-block;padding:2px 10px;border-radius:999px;font-size:.8rem;font-weight:600;color:${fg};background:${bg}">${t}</span>`; };
  const cnt = (grp: string, s: VerStatus) => entries.filter((e) => e.grp === grp && e.status === s).length;
  const card = (label: string, big: string, sub: string) => `<div style="background:#0f1729;color:#fff;border-radius:12px;padding:16px 18px"><div style="font-size:.72rem;letter-spacing:.06em;text-transform:uppercase;opacity:.6">${esc(label)}</div><div style="font-size:1.35rem;font-weight:700;margin-top:4px;word-break:break-word">${big}</div>${sub ? `<div style="opacity:.6;font-size:.8rem;margin-top:2px">${sub}</div>` : ''}</div>`;
  const table = (title: string, grp: 'prod' | 'dev') => {
    const rows = entries.filter((e) => e.grp === grp);
    if (!rows.length) return '';
    const chip = (n: number, fg: string, bg: string) => (n ? `<span style="display:inline-block;padding:1px 9px;border-radius:999px;font-size:.8rem;font-weight:600;color:${fg};background:${bg};margin-left:6px">${n}</span>` : '');
    return `<div style="margin-top:26px">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
        <h2 style="margin:0">${esc(title)} <span style="opacity:.5;font-weight:400">(${rows.length})</span></h2>
        <div>${chip(cnt(grp, 'up-to-date'), '#0c7a3f', '#e6f5ec')}${chip(cnt(grp, 'minor-or-patch'), '#8a6100', '#fdf4dd')}${chip(cnt(grp, 'major'), '#9b2226', '#fbe6e6')}</div>
      </div>
      <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;margin-top:10px">
        <thead><tr style="text-align:left;border-bottom:2px solid #e3e8f0;color:#5a6472;font-size:.78rem;text-transform:uppercase;letter-spacing:.04em">
          <th style="padding:8px 10px">Pakket</th><th style="padding:8px 10px">Huidig</th><th style="padding:8px 10px">Laatste</th><th style="padding:8px 10px">Status</th></tr></thead>
        <tbody>${rows.map((e) => `<tr style="border-bottom:1px solid #eef1f6">
          <td style="padding:9px 10px;font-family:ui-monospace,Menlo,monospace">${esc(e.name)}</td>
          <td style="padding:9px 10px;font-family:ui-monospace,Menlo,monospace;color:#5a6472">${esc(e.current)}</td>
          <td style="padding:9px 10px;font-family:ui-monospace,Menlo,monospace;color:#5a6472">${esc(e.latest || '—')}</td>
          <td style="padding:9px 10px">${badge(e.status)}</td></tr>`).join('')}</tbody>
      </table></div></div>`;
  };
  const outdated = entries.filter((e) => e.status === 'minor-or-patch' || e.status === 'major').length;
  const body = `
    <p style="color:#5a6472;max-width:60ch">Overzicht van alle gebruikte software, met aanduiding of we op de meest recente versie zitten. ${outdated ? `<strong>${outdated}</strong> pakket${outdated === 1 ? '' : 'ten'} kan worden bijgewerkt.` : 'Alles is up-to-date.'}</p>
    <p style="margin:10px 0"><a class="btn" href="/updates" target="_blank" rel="noopener">🕑 Versiegeschiedenis</a> <a class="btn" href="/admin/software">⟳ Vernieuwen</a></p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin:16px 0 4px">
      ${card('App-versie', 'v' + esc(vinfo?.version || (pkg as any).version || '0.1.0'), esc(vinfo?.commit || ''))}
      ${card('Framework', 'Hono ' + esc(hono ? cleanVer(hono.current) : '—'), hono?.latest ? 'laatste ' + esc(hono.latest) : '')}
      ${card('Runtime', 'Cloudflare Workers', 'workerd · productie')}
      ${card('Build', esc(vinfo?.date ? String(vinfo.date).slice(0, 10) : '—'), 'inijmegen.com')}
    </div>
    ${table('Productie', 'prod')}
    ${table('Ontwikkeling', 'dev')}
    <p style="color:#5a6472;font-size:.9rem;margin-top:26px">Laatste versies opgehaald bij de npm-registry. Afhankelijkheden worden <strong>wekelijks</strong> automatisch gecontroleerd en via Dependabot bijgewerkt.</p>`;
  return renderAdminLayout(c, { title: 'Software & versies', activeKey: 'software', body });
});

// ----------------------------------------------------------------------
// 4. CRUD-submodules
// ----------------------------------------------------------------------

adminApp.route('/pages', pagesApp);
adminApp.route('/settings', settingsApp);
adminApp.route('/events', eventsApp);
adminApp.route('/rounds', roundsApp);
adminApp.route('/categories', categoriesApp);
adminApp.route('/beroepen', beroepenApp);
adminApp.route('/speakers', speakersApp);
adminApp.route('/classrooms', classroomsApp);
adminApp.route('/floorplans', floorplansApp);
adminApp.route('/sessions', sessionsApp);
adminApp.route('/floorplan-editor', editorApp);
adminApp.route('/inbox', inboxApp);
adminApp.route('/subscribers', subscribersApp);
adminApp.route('/nieuws', announcementsApp);
adminApp.route('/sponsors', sponsorsApp);
adminApp.route('/leerlingen', leerlingenApp);
adminApp.route('/users', usersApp);
adminApp.route('/account', accountApp);
adminApp.route('/media', mediaApp);
adminApp.route('/audit', auditApp);

// Onbekende /admin/* → terug naar dashboard.
adminApp.notFound((c) => redirectErr(c, '/admin', 'Onbekende beheerpagina.'));
