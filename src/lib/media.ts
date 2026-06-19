/**
 * Upload naar en serveren vanuit R2 (binding ASSETS_R2).
 *
 * Objecten worden via de Worker-route GET /media/<key> publiek
 * geserveerd. Als de R2-binding ontbreekt (lokaal zonder bucket) falen
 * uploads met een nette melding i.p.v. een harde crash.
 */
import type { Env } from '../env';
import { randomHex } from './auth';

const ALLOWED = new Map<string, string>([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
  ['image/svg+xml', 'svg'],
]);

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

export function r2Available(env: Env): boolean {
  return Boolean(env.ASSETS_R2);
}

export class UploadError extends Error {}

/**
 * Slaat een geüploade File op in R2 onder `<prefix>/<rand>.<ext>` en
 * geeft de publieke /media-URL terug. Niet-afbeeldingen worden geweigerd.
 */
export async function uploadImage(
  env: Env,
  file: File,
  prefix: string
): Promise<string> {
  if (!env.ASSETS_R2) {
    throw new UploadError(
      'R2-bucket niet gekoppeld — uploaden kan nog niet (gebruik een externe URL).'
    );
  }
  const ext = ALLOWED.get(file.type);
  if (!ext) {
    throw new UploadError(
      'Alleen JPG, PNG, WEBP, GIF of SVG zijn toegestaan.'
    );
  }
  if (file.size > MAX_BYTES) {
    throw new UploadError('Bestand is te groot (max. 8 MB).');
  }
  const key = `${prefix}/${randomHex(12)}.${ext}`;
  const buf = await file.arrayBuffer();
  await env.ASSETS_R2.put(key, buf, {
    httpMetadata: { contentType: file.type },
  });
  return `/media/${key}`;
}

/** Verwijdert een object op basis van een /media-URL of kale key. */
export async function deleteMedia(env: Env, urlOrKey: string): Promise<void> {
  if (!env.ASSETS_R2 || !urlOrKey) return;
  const key = urlOrKey.replace(/^\/media\//, '');
  if (!key || key.startsWith('http')) return;
  try {
    await env.ASSETS_R2.delete(key);
  } catch (e) {
    console.error('R2 delete faalde:', e);
  }
}

/** Serveert een R2-object als HTTP-respons (publiek, met cache). */
export async function serveMedia(env: Env, key: string): Promise<Response> {
  if (!env.ASSETS_R2) return new Response('Niet beschikbaar', { status: 404 });
  const obj = await env.ASSETS_R2.get(key);
  if (!obj) return new Response('Niet gevonden', { status: 404 });
  const headers = new Headers();
  obj.writeHttpMetadata(headers as unknown as Headers);
  headers.set('etag', obj.httpEtag);
  headers.set('Cache-Control', 'public, max-age=86400');
  return new Response(obj.body as unknown as BodyInit, { headers });
}
