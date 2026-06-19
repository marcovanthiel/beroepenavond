/**
 * D1-helpers en query-wrappers.
 */
import type { D1Database } from '@cloudflare/workers-types';
import type { PageRow, SettingsMap } from '../env';

export interface EventRow {
  id: string;
  year: number;
  title: string;
  date: string;
  venue_name: string;
  venue_address: string | null;
  intro_md: string | null;
  is_active: number;
}

/** De actieve editie (is_active=1), of de meest recente, of null. */
export async function getActiveEvent(
  db: D1Database
): Promise<EventRow | null> {
  const row = await db
    .prepare(
      'SELECT * FROM events ORDER BY is_active DESC, year DESC LIMIT 1'
    )
    .first<EventRow>();
  return row ?? null;
}

export async function getSettings(db: D1Database): Promise<SettingsMap> {
  const res = await db.prepare('SELECT key, value FROM settings').all<{
    key: string;
    value: string;
  }>();
  const map: SettingsMap = {};
  for (const r of res.results ?? []) map[r.key] = r.value;
  return map;
}

export async function getNavPages(db: D1Database): Promise<PageRow[]> {
  const res = await db
    .prepare(
      'SELECT slug, title, nav_label, nav_order FROM pages ' +
        'WHERE is_published = 1 ORDER BY nav_order ASC'
    )
    .all<PageRow>();
  return res.results ?? [];
}

export async function getPage(
  db: D1Database,
  slug: string
): Promise<PageRow | null> {
  const res = await db
    .prepare(
      'SELECT * FROM pages WHERE slug = ? AND is_published = 1 LIMIT 1'
    )
    .bind(slug)
    .first<PageRow>();
  return res ?? null;
}

/** Vervangt {{key}}-placeholders in een string door waarden uit settings. */
export function interpolate(text: string, settings: SettingsMap): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_m, key) => settings[key] ?? '');
}

export interface CategoryWithBeroepen {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  beroepen: { id: number; name: string; slug: string | null }[];
}

/** Haalt categorieën met hun beroepen in één pass (kleine dataset, dus 1 query). */
export async function getCategoriesWithBeroepen(
  db: D1Database
): Promise<CategoryWithBeroepen[]> {
  const cats = await db
    .prepare(
      'SELECT id, name, color, sort_order FROM categories ORDER BY sort_order ASC'
    )
    .all<{ id: string; name: string; color: string; sort_order: number }>();
  const ber = await db
    .prepare(
      'SELECT id, category_id, name, slug FROM beroepen ORDER BY category_id, sort_order ASC'
    )
    .all<{ id: number; category_id: string; name: string; slug: string | null }>();
  const byCat = new Map<string, CategoryWithBeroepen['beroepen']>();
  for (const b of ber.results ?? []) {
    const list = byCat.get(b.category_id) ?? [];
    list.push({ id: b.id, name: b.name, slug: b.slug });
    byCat.set(b.category_id, list);
  }
  return (cats.results ?? []).map((c) => ({
    ...c,
    beroepen: byCat.get(c.id) ?? [],
  }));
}
