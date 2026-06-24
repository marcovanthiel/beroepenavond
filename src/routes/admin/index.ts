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
          <p style="text-align:center;margin:22px 0"><span style="display:inline-block;background:#f3f5f7;border:1px solid #e3e6ea;border-radius:10px;padding:14px 26px;font-size:30px;font-weight:bold;letter-spacing:8px;color:#15171a">${code}</span></p>
          <p style="color:#8a9099;font-size:13px">De code is 10 minuten geldig. Niet aangevraagd? Negeer deze e-mail.</p>`;
        await sendEmail(cfg, {
          to: email,
          subject: `Je inlogcode ${code} — Beheer Beroepenavond`,
          html: emailShell('Inlogcode', inner),
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
  const [beroepen, speakers, sessions, mapped, newMsgs, subs, news] =
    await Promise.all([
      q('SELECT COUNT(*) n FROM beroepen'),
      q('SELECT COUNT(*) n FROM speakers'),
      q('SELECT COUNT(*) n FROM sessions_program'),
      q("SELECT COUNT(*) n FROM classrooms WHERE map_shape IS NOT NULL AND map_shape <> ''"),
      q("SELECT COUNT(*) n FROM submissions WHERE status IN ('new','read')"),
      q("SELECT COUNT(*) n FROM subscribers WHERE status='active'"),
      q('SELECT COUNT(*) n FROM announcements'),
    ]);
  const ev = await db
    .prepare('SELECT title, date FROM events WHERE is_active = 1 LIMIT 1')
    .first<{ title: string; date: string }>();
  const recent = await db
    .prepare('SELECT id, type, name, email, created_at FROM submissions ORDER BY created_at DESC LIMIT 6')
    .all<{ id: number; type: string; name: string | null; email: string | null; created_at: number }>();

  const stat = (n: number, label: string, href: string, accent = false) =>
    `<a class="stat" href="${href}"><div class="stat__n" ${accent && n > 0 ? 'style="color:#d4493f"' : ''}>${n}</div><div class="stat__l">${esc(label)}</div></a>`;

  const recentRows = (recent.results ?? [])
    .map(
      (r) => `<tr><td>${r.type === 'volunteer' ? '🙋' : '✉️'}</td>
        <td><a href="/admin/inbox/${r.id}">${esc(r.name ?? r.email ?? 'Onbekend')}</a></td>
        <td class="muted">${new Date(r.created_at * 1000).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td></tr>`
    )
    .join('');

  const body = `
    <header class="page-head"><h1>Overzicht</h1><div class="page-head__actions"><a class="btn btn--ghost btn--sm" href="/" target="_blank">Bekijk site ↗</a></div></header>
    <div class="card">
      <h2>Actieve editie</h2>
      <p>${ev ? `<strong>${esc(ev.title)}</strong> — ${esc(ev.date)}` : 'Geen actieve editie ingesteld.'}</p>
    </div>
    <div class="stat-grid">
      ${stat(newMsgs, 'Openstaande berichten', '/admin/inbox', true)}
      ${stat(subs, 'Nieuwsbrief-abonnees', '/admin/subscribers')}
      ${stat(beroepen, 'Beroepen', '/admin/beroepen')}
      ${stat(speakers, 'Sprekers', '/admin/speakers')}
      ${stat(sessions, 'Sessies', '/admin/sessions')}
      ${stat(mapped, 'Lokalen op kaart', '/admin/floorplan-editor')}
      ${stat(news, 'Nieuwsberichten', '/admin/nieuws')}
    </div>
    <div class="card">
      <h2>Laatste inzendingen</h2>
      ${recentRows ? `<table class="data" style="width:100%">${recentRows}</table>` : '<p class="muted">Nog geen inzendingen.</p>'}
    </div>`;

  return renderAdminLayout(c, { title: 'Overzicht', activeKey: 'dashboard', body });
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
