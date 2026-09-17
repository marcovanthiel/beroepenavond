/**
 * Gedeelde helpers voor de tijdvak-beschikbaarheid/voorkeur van voorlichters
 * (tabel speaker_round_prefs; status 'nee' = kan niet/hard, 'voorkeur' = zacht).
 * Gebruikt door het aanmeldformulier + portaal (proces.ts), het beheer
 * (admin/speakers.ts) en de overdracht van een aanmelding naar een voorlichter
 * (admin/inbox.ts).
 */
import type { D1Database } from '@cloudflare/workers-types';
import { getActiveEvent } from './db';

export interface RondeRij { id: string; round_no: number; start_time: string | null; end_time: string | null }

export async function loadRondes(db: D1Database): Promise<RondeRij[]> {
  const ev = await getActiveEvent(db);
  if (!ev) return [];
  const r = await db
    .prepare('SELECT id, round_no, start_time, end_time FROM rounds WHERE event_id = ? ORDER BY round_no')
    .bind(ev.id)
    .all<RondeRij>();
  return r.results ?? [];
}

export async function loadSpeakerPrefs(db: D1Database, speakerId: string | null): Promise<Record<string, string>> {
  if (!speakerId) return {};
  const r = await db.prepare('SELECT round_id, status FROM speaker_round_prefs WHERE speaker_id = ?').bind(speakerId).all<{ round_id: string; status: string }>();
  const m: Record<string, string> = {};
  for (const x of r.results ?? []) m[x.round_id] = x.status;
  return m;
}

/** Haalt de tijdvak-keuze uit een form-body (velden ronde_<id> = nee|voorkeur). */
export function prefsFromBody(rondes: RondeRij[], body: Record<string, unknown>): Record<string, string> {
  const m: Record<string, string> = {};
  for (const r of rondes) {
    const v = String(body[`ronde_${r.id}`] ?? '').trim();
    if (v === 'nee' || v === 'voorkeur') m[r.id] = v;
  }
  return m;
}

/** Zet de beschikbaarheid van een voorlichter op precies deze map (vervangt). */
export async function applyPrefsMap(db: D1Database, speakerId: string, map: Record<string, string>): Promise<void> {
  await db.prepare('DELETE FROM speaker_round_prefs WHERE speaker_id = ?').bind(speakerId).run();
  const entries = Object.entries(map).filter(([, v]) => v === 'nee' || v === 'voorkeur');
  if (!entries.length) return;
  const stmts = entries.map(([rid, st]) => db.prepare('INSERT INTO speaker_round_prefs (speaker_id, round_id, status) VALUES (?, ?, ?)').bind(speakerId, rid, st));
  await db.batch(stmts);
}

export async function saveSpeakerPrefs(db: D1Database, speakerId: string, rondes: RondeRij[], body: Record<string, unknown>): Promise<void> {
  await applyPrefsMap(db, speakerId, prefsFromBody(rondes, body));
}
