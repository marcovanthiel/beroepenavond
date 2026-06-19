import type { D1Database, Fetcher, R2Bucket } from '@cloudflare/workers-types';

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  // R2-bucket voor uploads (spreker-portretten, plattegrond-afbeeldingen).
  // Optioneel getypeerd zodat code blijft werken als de binding ontbreekt.
  ASSETS_R2?: R2Bucket;
  // Secret (wrangler secret put / .dev.vars) voor het signen van
  // sessie-cookies met HMAC-SHA256.
  SESSION_SECRET: string;
  // Resend API-key voor uitgaande e-mail (optioneel: zonder key worden
  // inzendingen wél opgeslagen, maar geen mail verstuurd).
  RESEND_API_KEY?: string;
  // Vars uit wrangler.toml
  SITE_NAME: string;
  SITE_HOST: string;
  ORGANIZATION: string;
  LOCATION_NAME: string;
  EVENT_DATE: string;
  EVENT_TITLE: string;
  CONTACT_EMAIL: string;
}

export interface UserRow {
  id: string;
  email: string;
  name: string;
  role: string; // 'admin' | 'editor'
  pw_hash: string;
  created_at: number;
  updated_at: number;
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
