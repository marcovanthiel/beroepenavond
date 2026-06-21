/**
 * Leerling-authenticatie via magic link (geen wachtwoord).
 * Volledig los van het beheer (eigen cookie `ba_student`, eigen tabellen).
 * De inloglink wordt per e-mail verstuurd (Resend); zolang het afzender-
 * domein nog niet geverifieerd is, wordt de link wel aangemaakt maar niet
 * bezorgd.
 */
import type { Context, MiddlewareHandler } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { Env } from '../env';
import { randomHex } from './auth';
import { getSettings } from './db';
import { mailConfig, sendEmail, emailShell } from './email';

export interface StudentRow {
  id: string;
  email: string;
  name: string | null;
  school: string | null;
  profiel: string | null;
  newsletter: number;
}
export type StudentEnv = { Bindings: Env; Variables: { student: StudentRow } };

const COOKIE = 'ba_student';
const SESSION_TTL = 60 * 60 * 24 * 30; // 30 dagen ingelogd
const TOKEN_TTL = 60 * 30; // magic link 30 min geldig

function esc(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function hmac(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

const norm = (e: string) => e.trim().toLowerCase();

/** Maakt (zo nodig) een leerling aan en stuurt een magic-link e-mail. */
export async function requestLogin(
  c: Context<StudentEnv>,
  data: { email: string; name?: string; school?: string; profiel?: string }
): Promise<{ ok: boolean; token: string; mailed: boolean }> {
  const email = norm(data.email);
  // Upsert: bestaande leerling hergebruiken, anders nieuw.
  let row = await c.env.DB.prepare('SELECT id FROM students WHERE email = ?').bind(email).first<{ id: string }>();
  let id = row?.id;
  if (!id) {
    id = `stu_${randomHex(12)}`;
    await c.env.DB.prepare('INSERT INTO students (id, email, name, school, profiel) VALUES (?, ?, ?, ?, ?)')
      .bind(id, email, data.name?.trim() || null, data.school?.trim() || null, data.profiel?.trim() || null)
      .run();
  } else if (data.name || data.school || data.profiel) {
    await c.env.DB.prepare('UPDATE students SET name = COALESCE(NULLIF(?,\'\'), name), school = COALESCE(NULLIF(?,\'\'), school), profiel = COALESCE(NULLIF(?,\'\'), profiel) WHERE id = ?')
      .bind(data.name?.trim() ?? '', data.school?.trim() ?? '', data.profiel?.trim() ?? '', id)
      .run();
  }
  const token = randomHex(24);
  const now = Math.floor(Date.now() / 1000);
  await c.env.DB.prepare('INSERT INTO student_tokens (token, student_id, expires_at) VALUES (?, ?, ?)')
    .bind(token, id, now + TOKEN_TTL)
    .run();

  let mailed = false;
  try {
    const settings = await getSettings(c.env.DB);
    const cfg = mailConfig(c.env, settings);
    const host = `https://${settings['site_host'] || 'inijmegen.com'}`;
    const link = `${host}/leerling/verify?token=${token}`;
    const inner = `
      <p>Hoi${data.name ? ' ' + esc(data.name) : ''},</p>
      <p>Klik op de knop om in te loggen bij jouw Beroepenavond-account:</p>
      <p><a href="${esc(link)}" style="background:#88bc1d;color:#15171a;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Inloggen</a></p>
      <p style="color:#8a9099;font-size:13px">De link is 30 minuten geldig. Niet aangevraagd? Negeer deze mail.</p>`;
    const res = await sendEmail(cfg, { to: email, subject: 'Jouw inloglink — Beroepenavond Nijmegen', html: emailShell('Inloggen', inner) });
    mailed = !!res.ok;
  } catch (e) {
    console.error('magic-mail faalde:', e);
  }
  return { ok: true, token, mailed };
}

/** Verifieert een magic-link token en logt de leerling in. */
export async function verifyToken(c: Context<StudentEnv>, token: string): Promise<StudentRow | null> {
  if (!token) return null;
  const now = Math.floor(Date.now() / 1000);
  const row = await c.env.DB.prepare('SELECT * FROM student_tokens WHERE token = ? AND used = 0 AND expires_at > ?')
    .bind(token, now)
    .first<{ token: string; student_id: string }>();
  if (!row) return null;
  await c.env.DB.prepare('UPDATE student_tokens SET used = 1 WHERE token = ?').bind(token).run();
  const loginId = randomHex(32);
  await c.env.DB.prepare('INSERT INTO student_logins (id, student_id, expires_at) VALUES (?, ?, ?)')
    .bind(loginId, row.student_id, now + SESSION_TTL)
    .run();
  await c.env.DB.prepare('UPDATE students SET last_login = ? WHERE id = ?').bind(now, row.student_id).run();
  const signed = `${loginId}.${await hmac(c.env.SESSION_SECRET, loginId)}`;
  setCookie(c, COOKIE, signed, { httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge: SESSION_TTL });
  // Direct ophalen op id — de zojuist gezette cookie zit nog niet in dit request.
  return (
    (await c.env.DB.prepare('SELECT id, email, name, school, profiel, newsletter FROM students WHERE id = ? LIMIT 1')
      .bind(row.student_id)
      .first<StudentRow>()) ?? null
  );
}

export async function getCurrentStudent(c: Context<StudentEnv>): Promise<StudentRow | null> {
  const raw = getCookie(c, COOKIE);
  if (!raw) return null;
  const idx = raw.lastIndexOf('.');
  if (idx < 0) return null;
  const loginId = raw.slice(0, idx);
  if (!safeEqual(raw.slice(idx + 1), await hmac(c.env.SESSION_SECRET, loginId))) return null;
  const now = Math.floor(Date.now() / 1000);
  return (
    (await c.env.DB.prepare(
      `SELECT s.id, s.email, s.name, s.school, s.profiel, s.newsletter
         FROM student_logins l JOIN students s ON s.id = l.student_id
        WHERE l.id = ? AND l.expires_at > ? LIMIT 1`
    )
      .bind(loginId, now)
      .first<StudentRow>()) ?? null
  );
}

export async function logoutStudent(c: Context<StudentEnv>): Promise<void> {
  const raw = getCookie(c, COOKIE);
  if (raw) {
    const loginId = raw.slice(0, raw.lastIndexOf('.'));
    if (loginId) await c.env.DB.prepare('DELETE FROM student_logins WHERE id = ?').bind(loginId).run();
  }
  deleteCookie(c, COOKIE, { path: '/' });
}

export const requireStudent: MiddlewareHandler<StudentEnv> = async (c, next) => {
  const s = await getCurrentStudent(c);
  if (!s) return c.redirect('/leerling', 302);
  c.set('student', s);
  return next();
};
