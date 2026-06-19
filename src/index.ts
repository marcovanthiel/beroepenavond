/**
 * Worker-entrypoint voor beroepenavondnijmegen via inijmegen.com.
 *
 * Architectuur:
 *   - Publieke site: server-side gerenderd uit D1 (pages + settings)
 *   - Admin: nog te bouwen onder /admin/* (login + CRUD)
 *   - Statische assets (CSS, JS, hero-foto's) via ASSETS-binding
 *   - Plattegrond + sessies komen later
 */
import { Hono } from 'hono';
import type { Env } from './env';
import { publicApp } from './routes/public';
import { renderError } from './views/public';

const app = new Hono<{ Bindings: Env }>();

// 1. www → apex (canonical).
app.use('*', async (c, next) => {
  const url = new URL(c.req.url);
  if (url.hostname === `www.${c.env.SITE_HOST}`) {
    url.hostname = c.env.SITE_HOST;
    return c.redirect(url.toString(), 301);
  }
  return next();
});

// 2. Security-headers op alle Worker-responses.
app.use('*', async (c, next) => {
  await next();
  const h = c.res.headers;
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('X-Frame-Options', 'SAMEORIGIN');
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  h.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
});

// 3. Statische assets via de ASSETS-binding.
app.get('/assets/*', (c) => c.env.ASSETS.fetch(c.req.raw));
app.get('/robots.txt', (c) => c.env.ASSETS.fetch(c.req.raw));
app.get('/favicon.ico', (c) => c.env.ASSETS.fetch(c.req.raw));
app.get('/favicon.svg', (c) => c.env.ASSETS.fetch(c.req.raw));

// 4. Publieke site.
app.route('/', publicApp);

// 5. Fallback 404.
app.notFound(async (c) => renderError(c, 404, 'Pagina niet gevonden'));

// 6. Error handler.
app.onError((err, c) => {
  console.error('Worker error:', err);
  return renderError(c, 500, 'Er ging iets mis op de server.');
});

export default {
  fetch: app.fetch,
};
