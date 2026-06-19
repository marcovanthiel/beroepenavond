import type { D1Database, Fetcher } from '@cloudflare/workers-types';

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  // Vars uit wrangler.toml
  SITE_NAME: string;
  SITE_HOST: string;
  ORGANIZATION: string;
  LOCATION_NAME: string;
  EVENT_DATE: string;
  EVENT_TITLE: string;
  CONTACT_EMAIL: string;
}

export interface PageRow {
  slug: string;
  title: string;
  meta_description: string | null;
  hero_eyebrow: string | null;
  hero_title: string | null;
  hero_lede: string | null;
  hero_image: string | null;
  body_md: string;
  nav_order: number;
  nav_label: string | null;
  is_published: number;
}

export interface SettingsMap {
  [key: string]: string;
}
