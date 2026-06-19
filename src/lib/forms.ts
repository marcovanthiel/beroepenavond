/**
 * Kleine helpers voor het verwerken van admin-formulieren.
 */
import type { Context } from 'hono';
import type { AdminEnv } from './auth';
import { randomHex } from './auth';

export function genId(prefix: string): string {
  return `${prefix}_${randomHex(8)}`;
}

/** Trimt een form-waarde naar string ('' als afwezig). */
export function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** Lege string → null (voor optionele kolommen). */
export function strOrNull(v: unknown): string | null {
  const s = str(v);
  return s === '' ? null : s;
}

/** Checkbox/aanwezigheid → 1/0. */
export function bool(v: unknown): number {
  return v === '1' || v === 'on' || v === true ? 1 : 0;
}

/** Heel getal of null. */
export function intOrNull(v: unknown): number | null {
  const s = str(v);
  if (s === '') return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

export function intOr(v: unknown, fallback: number): number {
  const n = intOrNull(v);
  return n === null ? fallback : n;
}

function withFlash(path: string, key: 'ok' | 'err', msg: string): string {
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}${key}=${encodeURIComponent(msg)}`;
}

export function redirectOk(c: Context<AdminEnv>, path: string, msg: string) {
  return c.redirect(withFlash(path, 'ok', msg), 302);
}

export function redirectErr(c: Context<AdminEnv>, path: string, msg: string) {
  return c.redirect(withFlash(path, 'err', msg), 302);
}
