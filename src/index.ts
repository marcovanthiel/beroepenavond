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

// Content-Security-Policy: 'unsafe-inline' is nodig voor onze inline
// scripts/styles; Google Fonts + https/data-afbeeldingen (externe
// portretten) zijn toegestaan. Verkleint XSS-impact.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https:",
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ');

// 2. Security-headers + caching op alle Worker-responses.
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
  res.headers.set('Content-Security-Policy', CSP);
  res.headers.set('X-DNS-Prefetch-Control', 'on');

  // Caching-strategie per pad.
  const url = new URL(c.req.url);
  const path = url.pathname;
  if (path.startsWith('/admin')) {
    res.headers.set('Cache-Control', 'no-store'); // beheer nooit cachen
  } else if (path.startsWith('/assets/')) {
    res.headers.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=604800');
  } else if (path.startsWith('/media/')) {
    /* /media houdt zijn eigen Cache-Control uit serveMedia */
  } else if (c.req.method === 'GET' && res.status === 200 && !url.search) {
    // Publieke pagina's: kort edge-cachen, snel reviderend.
    res.headers.set('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600');
  }
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
// /sitemap.xml wordt dynamisch gegenereerd (zie hieronder), niet als asset.

// 4. Media uit R2 (publiek leesbaar): /media/<key>.
app.get('/media/*', async (c) => {
  const key = new URL(c.req.url).pathname.replace(/^\/media\//, '');
  if (!key) return renderError(c, 404, 'Niet gevonden');
  return serveMedia(c.env, key);
});

// 4b. Dynamische sitemap uit gepubliceerde pagina's + nieuws.
app.get('/sitemap.xml', async (c) => {
  const host = `https://${c.env.SITE_HOST}`;
  const [pages, news] = await Promise.all([
    c.env.DB.prepare('SELECT slug, updated_at FROM pages WHERE is_published = 1').all<{ slug: string; updated_at: number }>(),
    c.env.DB.prepare('SELECT slug, updated_at FROM announcements WHERE is_published = 1').all<{ slug: string; updated_at: number }>(),
  ]);
  const urls: { loc: string; lastmod?: number }[] = [];
  for (const p of pages.results ?? []) urls.push({ loc: host + p.slug, lastmod: p.updated_at });
  for (const n of news.results ?? []) urls.push({ loc: `${host}/nieuws/${n.slug}`, lastmod: n.updated_at });
  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map(
        (u) =>
          `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${new Date(u.lastmod * 1000).toISOString().slice(0, 10)}</lastmod>` : ''}</url>`
      )
      .join('\n') +
    `\n</urlset>\n`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
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
