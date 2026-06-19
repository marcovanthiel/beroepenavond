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
import { adminApp } from './routes/admin';
import { renderError } from './views/public';
import { serveMedia } from './lib/media';

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
//    ASSETS.fetch() en c.redirect() returnen responses met immutable
//    headers. Daarom wrappen we de respons altijd in een nieuwe Response.
app.use('*', async (c, next) => {
  await next();
  const orig = c.res;
  const res = new Response(orig.body, {
    status: orig.status,
    statusText: orig.statusText,
    headers: new Headers(orig.headers),
  });
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'SAMEORIGIN');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  c.res = res;
});

// 3. Statische assets via de ASSETS-binding.
//    Note: ASSETS.fetch wil een URL of Request — c.req.raw kan op de
//    runtime een al-gelezen Request zijn, dus we sturen een verse URL.
const serveAsset = (c: { env: Env; req: { url: string } }) =>
  c.env.ASSETS.fetch(new Request(c.req.url));
app.get('/assets/*', serveAsset);
app.get('/robots.txt', serveAsset);
app.get('/favicon.ico', serveAsset);
app.get('/favicon.svg', serveAsset);
app.get('/sitemap.xml', serveAsset);

// 4. Media uit R2 (publiek leesbaar): /media/<key>.
app.get('/media/*', async (c) => {
  const key = new URL(c.req.url).pathname.replace(/^\/media\//, '');
  if (!key) return renderError(c, 404, 'Niet gevonden');
  return serveMedia(c.env, key);
});

// 5. Beheer-paneel.
app.route('/admin', adminApp);

// 6. Publieke site (catch-all, laatste).
app.route('/', publicApp);

// 7. Fallback 404.
app.notFound(async (c) => renderError(c, 404, 'Pagina niet gevonden'));

// 8. Error handler.
app.onError((err, c) => {
  console.error('Worker error:', err);
  return renderError(c, 500, 'Er ging iets mis op de server.');
});

export default {
  fetch: app.fetch,
};
