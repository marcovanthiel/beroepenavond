/**
 * D1-helpers en query-wrappers.
 */
import type { D1Database } from '@cloudflare/workers-types';
import type { PageRow, SettingsMap } from '../env';

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
