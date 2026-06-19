import { Hono } from 'hono';
import type { Env } from '../env';
import { getPage, getSettings } from '../lib/db';
import { renderHome } from '../views/home';
import { renderError, renderPage, renderNotice } from '../views/public';
import { renderRoosterMap } from '../views/rooster';
import {
  renderBeroepenCatalog,
  renderVoorlichters,
  renderNieuwsList,
  renderNieuwsItem,
  contactFormHtml,
  volunteerFormHtml,
} from '../views/sections';
import { mailConfig, notifySubmission, confirmToSender, newsletterConfirm } from '../lib/email';
import { renderLayout } from '../views/layout';
import { getNavPages } from '../lib/db';

export const publicApp = new Hono<{ Bindings: Env }>();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const isBot = (b: Record<string, unknown>) => str(b.website) !== '';

async function storeSubmission(
  c: any,
  data: {
    type: string;
    name?: string;
    email?: string;
    phone?: string;
    organization?: string;
    profession?: string;
    message?: string;
  }
): Promise<number> {
  const res = await c.env.DB.prepare(
    `INSERT INTO submissions (type, name, email, phone, organization, profession, message, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      data.type,
      data.name ?? null,
      data.email ?? null,
      data.phone ?? null,
      data.organization ?? null,
      data.profession ?? null,
      data.message ?? null,
      c.req.header('cf-connecting-ip') ?? null,
      (c.req.header('user-agent') ?? '').slice(0, 300)
    )
    .run();
  return Number(res.meta?.last_row_id ?? 0);
}

async function emailForSubmission(c: any, data: any) {
  try {
    const settings = await getSettings(c.env.DB);
    const cfg = mailConfig(c.env, settings);
    const host = `https://${settings['site_host'] || 'inijmegen.com'}`;
    await notifySubmission(cfg, data, `${host}/admin/inbox`);
    await confirmToSender(cfg, data);
  } catch (e) {
    console.error('email submission faalde:', e);
  }
}

// ----------------------------------------------------------------------
// Formulier-POSTs
// ----------------------------------------------------------------------

publicApp.post('/contact', async (c) => {
  const b = await c.req.parseBody();
  if (isBot(b)) return c.redirect('/contact?sent=1', 302);
  const data = {
    type: 'contact',
    name: str(b.name),
    email: str(b.email),
    message: str(b.message),
    profession: undefined,
    payload: str(b.subject),
  };
  if (!data.name || !EMAIL_RE.test(data.email) || !data.message) {
    const page = await getPage(c.env.DB, '/contact');
    const settings = await getSettings(c.env.DB);
    if (!page) return renderError(c, 404, 'Pagina niet gevonden');
    return renderPage(c, page, contactFormHtml(settings, b as any), {
      notice: { type: 'err', text: 'Controleer je naam, e-mailadres en bericht.' },
    });
  }
  await storeSubmission(c, data);
  await emailForSubmission(c, { ...data, subject: str(b.subject) });
  return c.redirect('/contact?sent=1', 302);
});

publicApp.post('/aanmelden', async (c) => {
  const b = await c.req.parseBody();
  if (isBot(b)) return c.redirect('/aanmelden?sent=1', 302);
  const data = {
    type: 'volunteer',
    name: str(b.name),
    email: str(b.email),
    phone: str(b.phone),
    organization: str(b.organization),
    profession: str(b.profession),
    message: str(b.message),
  };
  if (!data.name || !EMAIL_RE.test(data.email) || !data.profession) {
    const page = await getPage(c.env.DB, '/aanmelden');
    const settings = await getSettings(c.env.DB);
    if (!page) return renderError(c, 404, 'Pagina niet gevonden');
    return renderPage(c, page, volunteerFormHtml(settings, b as any), {
      notice: { type: 'err', text: 'Vul je naam, e-mailadres en het beroep in.' },
    });
  }
  await storeSubmission(c, data);
  await emailForSubmission(c, data);
  return c.redirect('/aanmelden?sent=1', 302);
});

publicApp.post('/nieuwsbrief', async (c) => {
  const b = await c.req.parseBody();
  if (isBot(b)) return c.redirect('/nieuwsbrief?sent=1', 302);
  const email = str(b.email).toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return renderNotice(c, {
      title: 'Ongeldig e-mailadres',
      eyebrow: 'Nieuwsbrief',
      type: 'err',
      message: 'Vul een geldig e-mailadres in en probeer het opnieuw.',
      backHref: '/nieuwsbrief',
      backLabel: 'Terug',
    });
  }
  const existing = await c.env.DB.prepare('SELECT status FROM subscribers WHERE email = ?')
    .bind(email)
    .first<{ status: string }>();
  if (existing?.status === 'active') {
    return c.redirect('/nieuwsbrief?already=1', 302);
  }
  const token = crypto.randomUUID().replace(/-/g, '');
  await c.env.DB.prepare(
    `INSERT INTO subscribers (email, name, status, token) VALUES (?, ?, 'pending', ?)
     ON CONFLICT(email) DO UPDATE SET status='pending', token=excluded.token`
  )
    .bind(email, str(b.name) || null, token)
    .run();
  try {
    const settings = await getSettings(c.env.DB);
    const cfg = mailConfig(c.env, settings);
    const host = `https://${settings['site_host'] || 'inijmegen.com'}`;
    await newsletterConfirm(cfg, email, `${host}/nieuwsbrief/bevestigen?token=${token}`);
  } catch (e) {
    console.error('newsletter confirm mail faalde:', e);
  }
  return c.redirect('/nieuwsbrief?sent=1', 302);
});

publicApp.get('/nieuwsbrief/bevestigen', async (c) => {
  const token = c.req.query('token') ?? '';
  const sub = await c.env.DB.prepare('SELECT id FROM subscribers WHERE token = ?').bind(token).first();
  if (!sub) return renderNotice(c, { title: 'Link verlopen', eyebrow: 'Nieuwsbrief', type: 'err', message: 'Deze bevestigingslink is ongeldig of al gebruikt.' });
  await c.env.DB.prepare("UPDATE subscribers SET status='active', confirmed_at=unixepoch() WHERE token = ?").bind(token).run();
  return renderNotice(c, { title: 'Aanmelding bevestigd', eyebrow: 'Nieuwsbrief', message: 'Je bent aangemeld voor updates over de Beroepenavond. Bedankt!' });
});

publicApp.get('/nieuwsbrief/uitschrijven', async (c) => {
  const token = c.req.query('token') ?? '';
  const sub = await c.env.DB.prepare('SELECT id FROM subscribers WHERE token = ?').bind(token).first();
  if (!sub) return renderNotice(c, { title: 'Link ongeldig', eyebrow: 'Nieuwsbrief', type: 'err', message: 'Deze afmeldlink is ongeldig.' });
  await c.env.DB.prepare("UPDATE subscribers SET status='unsubscribed' WHERE token = ?").bind(token).run();
  return renderNotice(c, { title: 'Uitgeschreven', eyebrow: 'Nieuwsbrief', message: 'Je ontvangt geen e-mails meer van ons. Jammer dat je gaat!' });
});

// ----------------------------------------------------------------------
// Nieuws-detail
// ----------------------------------------------------------------------

publicApp.get('/nieuws/:slug', async (c) => {
  const item = await renderNieuwsItem(c.env.DB, c.req.param('slug'));
  if (!item) return renderError(c, 404, 'Nieuwsbericht niet gevonden');
  const [settings, navItems] = await Promise.all([getSettings(c.env.DB), getNavPages(c.env.DB)]);
  return c.html(
    renderLayout({
      title: `${item.title} — Beroepenavond Nijmegen`,
      metaDescription: item.summary,
      navItems,
      activeSlug: '/nieuws',
      breadcrumbs: [{ label: 'Nieuws', href: '/nieuws' }, { label: item.title }],
      canonicalPath: `/nieuws/${c.req.param('slug')}`,
      ogImage: item.cover,
      hero: { eyebrow: 'Nieuws', title: item.title, lede: item.summary, compact: true },
      bodyHtml: item.html,
      settings,
    })
  );
});

// ----------------------------------------------------------------------
// Catch-all: pagina's (met dynamische uitbreidingen)
// ----------------------------------------------------------------------

publicApp.get('/*', async (c) => {
  const url = new URL(c.req.url);
  let slug = url.pathname.replace(/\/+$/, '') || '/';
  if (
    slug.startsWith('/admin') ||
    slug.startsWith('/api') ||
    slug.startsWith('/assets') ||
    slug.startsWith('/media') ||
    slug === '/robots.txt' ||
    slug === '/sitemap.xml' ||
    slug === '/favicon.ico' ||
    slug === '/favicon.svg'
  ) {
    return renderError(c, 404, 'Pagina niet gevonden');
  }
  if (slug === '/') return renderHome(c);

  const page = await getPage(c.env.DB, slug);
  if (!page) return renderError(c, 404, 'Pagina niet gevonden');

  const settings = await getSettings(c.env.DB);
  const q = c.req.query();

  // Dynamische pagina's: genereer extra content + eventuele notice.
  let append = '';
  let notice: { type: 'ok' | 'err'; text: string } | null = null;

  switch (slug) {
    case '/rooster':
      append = await renderRoosterMap(c.env.DB).catch(() => '');
      break;
    case '/beroepen':
    case '/uitleg-beroepen':
      append = await renderBeroepenCatalog(c.env.DB).catch(() => '');
      break;
    case '/voorlichters':
      append = await renderVoorlichters(c.env.DB).catch(() => '');
      break;
    case '/nieuws':
      append = await renderNieuwsList(c.env.DB).catch(() => '');
      break;
    case '/contact':
      if (q.sent) {
        notice = { type: 'ok', text: 'Bedankt! Je bericht is verstuurd. We nemen indien nodig contact op.' };
      } else {
        append = contactFormHtml(settings);
      }
      break;
    case '/aanmelden':
      if (q.sent) {
        notice = { type: 'ok', text: 'Bedankt voor je aanmelding! We nemen contact met je op met de details.' };
      } else {
        append = volunteerFormHtml(settings);
      }
      break;
    case '/nieuwsbrief':
      if (q.sent) notice = { type: 'ok', text: 'Bijna klaar! Check je mailbox en bevestig je aanmelding.' };
      else if (q.already) notice = { type: 'ok', text: 'Je bent al aangemeld voor de nieuwsbrief.' };
      break;
  }

  return renderPage(c, page, append, { notice });
});
