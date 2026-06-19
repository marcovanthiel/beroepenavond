import { Hono } from 'hono';
import type { Env } from '../env';
import { getPage } from '../lib/db';
import { renderHome } from '../views/home';
import { renderError, renderPage } from '../views/public';
import { renderRoosterMap } from '../views/rooster';

export const publicApp = new Hono<{ Bindings: Env }>();

// Catch-all voor publieke pagina's. Slug-lookup in D1; bij geen match
// returnt 404. We strip de trailing slash zodat `/introductie/` net zo
// werkt als `/introductie`.
publicApp.get('/*', async (c) => {
  const url = new URL(c.req.url);
  let slug = url.pathname.replace(/\/+$/, '') || '/';
  // Reserved-paths overslaan (admin, api, assets — die hebben eigen routes)
  if (
    slug.startsWith('/admin') ||
    slug.startsWith('/api') ||
    slug.startsWith('/assets') ||
    slug === '/robots.txt' ||
    slug === '/favicon.ico' ||
    slug === '/favicon.svg'
  ) {
    return renderError(c, 404, 'Pagina niet gevonden');
  }
  // Homepage krijgt een eigen renderer met mannetje-bg en accordions.
  if (slug === '/') return renderHome(c);
  const page = await getPage(c.env.DB, slug);
  if (!page) return renderError(c, 404, 'Pagina niet gevonden');
  // De roosterpagina krijgt de interactieve plattegrond onder de tekst.
  if (slug === '/rooster') {
    const map = await renderRoosterMap(c.env.DB).catch(() => '');
    return renderPage(c, page, map);
  }
  return renderPage(c, page);
});
