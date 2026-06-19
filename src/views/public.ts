import type { Context } from 'hono';
import type { Env, PageRow } from '../env';
import { getNavPages, getSettings, interpolate } from '../lib/db';
import { renderMarkdown } from '../lib/markdown';
import { renderLayout } from './layout';

export async function renderPage(
  c: Context<{ Bindings: Env }>,
  page: PageRow,
  appendHtml = ''
) {
  const [settings, navItems] = await Promise.all([
    getSettings(c.env.DB),
    getNavPages(c.env.DB),
  ]);
  const bodyHtml =
    renderMarkdown(interpolate(page.body_md, settings)) + appendHtml;
  return c.html(
    renderLayout({
      title: page.title,
      metaDescription: page.meta_description,
      navItems,
      activeSlug: page.slug,
      hero: page.hero_title
        ? {
            eyebrow: page.hero_eyebrow,
            title: interpolate(page.hero_title, settings),
            lede: page.hero_lede ? interpolate(page.hero_lede, settings) : null,
            image: page.hero_image,
            compact: page.slug !== '/',
          }
        : null,
      bodyHtml,
      settings,
    })
  );
}

export async function renderError(
  c: Context<{ Bindings: Env }>,
  status: number,
  message: string
) {
  const [settings, navItems] = await Promise.all([
    getSettings(c.env.DB).catch(() => ({})),
    getNavPages(c.env.DB).catch(() => []),
  ]);
  const bodyHtml = `
    <p class="lede">${message}</p>
    <p><a href="/" class="btn btn--primary">Terug naar home</a></p>
  `;
  c.status(status as 404 | 500);
  return c.html(
    renderLayout({
      title: `${status} — ${c.env.SITE_NAME}`,
      navItems,
      activeSlug: '',
      hero: {
        eyebrow: `${status}`,
        title: status === 404 ? 'Pagina niet gevonden' : 'Er ging iets mis',
        compact: true,
      },
      bodyHtml,
      settings,
    })
  );
}
