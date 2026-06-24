/**
 * Authenticatie & sessiebeheer voor het admin-paneel.
 *
 * - Wachtwoorden: PBKDF2-HMAC-SHA256 via WebCrypto (geen externe dep).
 *   Opslagformaat: `pbkdf2$<iteraties>$<salt-b64>$<hash-b64>`.
 * - Sessies: random id in de `sessions`-tabel (D1). De cookie bevat
 *   `<sessionId>.<hmac>` zodat een gestolen/gefabriceerde cookie zonder
 *   het SESSION_SECRET niet te vervalsen is.
 */
import type { Context, MiddlewareHandler } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { D1Database } from '@cloudflare/workers-types';
import type { Env, UserRow } from '../env';

export type AdminEnv = { Bindings: Env; Variables: { user: UserRow } };

const COOKIE_NAME = 'ba_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 dagen
const PBKDF2_ITERATIONS = 100_000;

// ----------------------------------------------------------------------
// Encoding-helpers
// ----------------------------------------------------------------------

const enc = new TextEncoder();

function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Timing-safe vergelijking van twee strings van gelijke lengte. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ----------------------------------------------------------------------
// Wachtwoord-hashing
// ----------------------------------------------------------------------

async function pbkdf2(
  password: string,
  salt: Uint8Array,
  iterations: number
): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return bufToB64(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${bufToB64(salt.buffer)}$${hash}`;
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = parseInt(parts[1], 10);
  if (!Number.isFinite(iterations)) return false;
  const salt = b64ToBytes(parts[2]);
  const hash = await pbkdf2(password, salt, iterations);
  return safeEqual(hash, parts[3]);
}

// ----------------------------------------------------------------------
// Cookie-signing (HMAC-SHA256)
// ----------------------------------------------------------------------

async function hmac(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(value));
  return bufToB64(sig).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function signCookie(secret: string, sessionId: string): Promise<string> {
  return `${sessionId}.${await hmac(secret, sessionId)}`;
}

async function unsignCookie(
  secret: string,
  cookie: string
): Promise<string | null> {
  const idx = cookie.lastIndexOf('.');
  if (idx < 0) return null;
  const sessionId = cookie.slice(0, idx);
  const sig = cookie.slice(idx + 1);
  const expected = await hmac(secret, sessionId);
  return safeEqual(sig, expected) ? sessionId : null;
}

// ----------------------------------------------------------------------
// Sessies
// ----------------------------------------------------------------------

export async function createSession(
  c: Context<AdminEnv>,
  userId: string
): Promise<void> {
  const sessionId = randomHex(32);
  const now = Math.floor(Date.now() / 1000);
  await c.env.DB.prepare(
    'INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)'
  )
    .bind(sessionId, userId, now + SESSION_TTL_SECONDS, now)
    .run();
  const cookie = await signCookie(c.env.SESSION_SECRET, sessionId);
  setCookie(c, COOKIE_NAME, cookie, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function destroySession(c: Context<AdminEnv>): Promise<void> {
  const raw = getCookie(c, COOKIE_NAME);
  if (raw) {
    const sessionId = await unsignCookie(c.env.SESSION_SECRET, raw);
    if (sessionId) {
      await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?')
        .bind(sessionId)
        .run();
    }
  }
  deleteCookie(c, COOKIE_NAME, { path: '/' });
}

/** Leest de actieve gebruiker uit de sessie-cookie, of null. */
export async function getCurrentUser(
  c: Context<AdminEnv>
): Promise<UserRow | null> {
  const raw = getCookie(c, COOKIE_NAME);
  if (!raw) return null;
  const sessionId = await unsignCookie(c.env.SESSION_SECRET, raw);
  if (!sessionId) return null;
  const now = Math.floor(Date.now() / 1000);
  const row = await c.env.DB.prepare(
    `SELECT u.* FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.id = ? AND s.expires_at > ?
      LIMIT 1`
  )
    .bind(sessionId, now)
    .first<UserRow>();
  return row ?? null;
}

/** Middleware: vereist een ingelogde gebruiker, anders redirect naar login. */
export const requireAuth: MiddlewareHandler<AdminEnv> = async (c, next) => {
  const user = await getCurrentUser(c);
  if (!user) {
    const to = encodeURIComponent(new URL(c.req.url).pathname);
    return c.redirect(`/admin/login?next=${to}`, 302);
  }
  c.set('user', user);
  return next();
};

// ----------------------------------------------------------------------
// Users & audit
// ----------------------------------------------------------------------

export async function countUsers(db: D1Database): Promise<number> {
  const row = await db
    .prepare('SELECT COUNT(*) AS n FROM users')
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export async function findUserByEmail(
  db: D1Database,
  email: string
): Promise<UserRow | null> {
  const row = await db
    .prepare('SELECT * FROM users WHERE email = ? LIMIT 1')
    .bind(email.trim().toLowerCase())
    .first<UserRow>();
  return row ?? null;
}

export async function createUser(
  db: D1Database,
  data: { email: string; name: string; role: string; password: string }
): Promise<string> {
  const id = `usr_${randomHex(12)}`;
  const pw_hash = await hashPassword(data.password);
  await db
    .prepare(
      'INSERT INTO users (id, email, name, role, pw_hash) VALUES (?, ?, ?, ?, ?)'
    )
    .bind(id, data.email.trim().toLowerCase(), data.name.trim(), data.role, pw_hash)
    .run();
  return id;
}

/** Schrijft een regel naar audit_log; faalt stil (logging mag nooit blokkeren). */
export async function logAudit(
  c: Context<AdminEnv>,
  action: string,
  entityType?: string,
  entityId?: string,
  metadata?: unknown
): Promise<void> {
  try {
    const user = c.get('user');
    const ip = c.req.header('cf-connecting-ip') ?? null;
    await c.env.DB.prepare(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, metadata, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(
        user?.id ?? null,
        action,
        entityType ?? null,
        entityId ?? null,
        metadata ? JSON.stringify(metadata) : null,
        ip
      )
      .run();
  } catch (e) {
    console.error('audit_log faalde:', e);
  }
}

// ----------------------------------------------------------------------
// Passwordless login: 6-cijferige e-mailcodes (alleen voor bestaande users)
// ----------------------------------------------------------------------

const CODE_TTL_SECONDS = 60 * 10; // 10 minuten geldig
const CODE_MAX_ATTEMPTS = 5;

export function genCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return String(n).padStart(6, '0');
}

async function sha256hex(s: string): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', enc.encode(s));
  return Array.from(new Uint8Array(h), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Sla (gehasht) een nieuwe inlogcode op voor dit e-mailadres (één actieve per e-mail). */
export async function setLoginCode(
  db: D1Database,
  email: string,
  code: string
): Promise<void> {
  const e = email.trim().toLowerCase();
  const now = Math.floor(Date.now() / 1000);
  const hash = await sha256hex(`${code}:${e}`);
  await db
    .prepare(
      `INSERT INTO admin_login_codes (email, code_hash, expires_at, attempts, created_at)
       VALUES (?, ?, ?, 0, ?)
       ON CONFLICT(email) DO UPDATE SET
         code_hash = excluded.code_hash,
         expires_at = excluded.expires_at,
         attempts = 0,
         created_at = excluded.created_at`
    )
    .bind(e, hash, now + CODE_TTL_SECONDS, now)
    .run();
}

/** Controleer een ingevoerde code; verbruikt 'm bij succes, telt pogingen bij fout. */
export async function verifyLoginCode(
  db: D1Database,
  email: string,
  code: string
): Promise<boolean> {
  const e = email.trim().toLowerCase();
  const now = Math.floor(Date.now() / 1000);
  const row = await db
    .prepare('SELECT code_hash, expires_at, attempts FROM admin_login_codes WHERE email = ?')
    .bind(e)
    .first<{ code_hash: string; expires_at: number; attempts: number }>();
  if (!row) return false;
  if (row.expires_at < now || row.attempts >= CODE_MAX_ATTEMPTS) {
    await db.prepare('DELETE FROM admin_login_codes WHERE email = ?').bind(e).run();
    return false;
  }
  const hash = await sha256hex(`${code.trim()}:${e}`);
  if (!safeEqual(hash, row.code_hash)) {
    await db.prepare('UPDATE admin_login_codes SET attempts = attempts + 1 WHERE email = ?').bind(e).run();
    return false;
  }
  await db.prepare('DELETE FROM admin_login_codes WHERE email = ?').bind(e).run();
  return true;
}

export { randomHex };
