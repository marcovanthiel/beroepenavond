/**
 * Lichtgewicht spamfilter voor de publieke formulieren (contact / aanmelden /
 * nieuwsbrief). Geen externe service: een scorend heuristiek bovenop de bestaande
 * honeypot. Sterke signalen (100) = direct spam; zwakke signalen (2) hebben er
 * minstens twee nodig, zodat losse toevalstreffers geen echte berichten blokkeren.
 *
 * Drempel = 3. Bij spam doet de route alsof het gelukt is (geen opslag/mail),
 * zodat bots niets leren.
 */
import { str } from './forms';

// Links / BBCode / verdachte TLD's — bijna nooit in een echt contactbericht.
const URL_RE = /(https?:\/\/|www\.|\[url|<a\s|\b[a-z0-9-]+\.(ru|cn|xyz|top|click|loan)\b)/i;
// Niet-Latijns schrift: Cyrillisch, Hebreeuws, Arabisch, CJK, Hangul.
const NONLATIN_RE = /[Ѐ-ӿ֐-׿؀-ۿ　-鿿가-힯]/;
// Willekeurig ogend e-mail-lokaaldeel zoals "zekisuquc419".
const RAND_LOCAL_RE = /^[a-z]{5,}\d{2,}$/i;

export interface SpamResult {
  spam: boolean;
  score: number;
  reasons: string[];
}

export function spamScore(b: Record<string, unknown>): SpamResult {
  const name = str(b.name);
  const email = str(b.email);
  const local = (email.split('@')[0] || '');
  const blob = `${str(b.message)} ${str(b.subject)} ${str(b.profession)} ${str(b.organization)}`.trim();

  let score = 0;
  const reasons: string[] = [];
  const add = (n: number, r: string) => { score += n; reasons.push(r); };

  // sterke signalen
  if (str(b.website) !== '') add(100, 'honeypot');
  if (URL_RE.test(blob) || URL_RE.test(name)) add(100, 'url');
  if (NONLATIN_RE.test(blob) || NONLATIN_RE.test(name)) add(100, 'nonlatin');

  // zwakke signalen (≥2 nodig)
  if (name && !/\s/.test(name) && /[a-z][A-Z]/.test(name)) add(2, 'camelname'); // "RobertTic"
  if (RAND_LOCAL_RE.test(local)) add(2, 'randemail');                            // "zekisuquc419"
  if (blob.length > 0 && blob.length < 12) add(1, 'short');

  return { score, reasons, spam: score >= 3 };
}

/** True als de inzending vrijwel zeker spam is. */
export function isSpam(b: Record<string, unknown>): boolean {
  return spamScore(b).spam;
}

/**
 * Verifieert een Cloudflare Turnstile-token serverside (siteverify).
 * - Geen secret geconfigureerd => true (Turnstile staat uit, niet blokkeren).
 * - Token ontbreekt => false (bv. bot die rechtstreeks POST).
 * - Netwerkfout => true (fail-open, zodat een Turnstile-storing echte bezoekers
 *   niet blokkeert; het heuristiek-filter blijft sowieso actief).
 */
export async function verifyTurnstile(secret: string | undefined, token: string, ip?: string): Promise<boolean> {
  if (!secret) return true;
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set('remoteip', ip);
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const data = (await res.json()) as { success?: boolean };
    return !!data.success;
  } catch {
    return true;
  }
}
