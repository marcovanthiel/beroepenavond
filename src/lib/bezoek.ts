/**
 * Leerlingenaantallen per beroep per editie (tabel beroep_bezoek, schema 032).
 *
 * Twee bronnen:
 *  - 'handmatig': statistiek van een eerdere editie, ingevoerd in beheer
 *    (beroepformulier of de bulk-invoerpagina). Wint altijd.
 *  - 'evaluatie': automatisch afgeleid uit de voorlichter-evaluaties van de
 *    avond zelf, zodat de aantallen voor volgend jaar meteen klaarstaan.
 *
 * De sessie-indeling gebruikt per beroep het meest recente jaar met een aantal
 * als verwachting (verwachtAantal) en kiest daar een passend lokaal bij.
 */
import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types';

export type BezoekBron = 'handmatig' | 'evaluatie';

export interface BezoekRij {
  beroep_id: number;
  jaar: number;
  aantal: number;
  bron: BezoekBron;
}

export interface Verwachting {
  aantal: number;
  jaar: number;
  bron: BezoekBron;
}

/** Alle aantallen, gegroepeerd per beroep, nieuwste jaar eerst. */
export async function loadBezoek(db: D1Database): Promise<Map<number, BezoekRij[]>> {
  const q = await db
    .prepare('SELECT beroep_id, jaar, aantal, bron FROM beroep_bezoek ORDER BY beroep_id, jaar DESC')
    .all<BezoekRij>();
  const m = new Map<number, BezoekRij[]>();
  for (const r of q.results ?? []) (m.get(r.beroep_id) ?? m.set(r.beroep_id, []).get(r.beroep_id)!).push(r);
  return m;
}

/** Verwacht aantal leerlingen voor een beroep = het meest recente jaar met een aantal. */
export function verwachtAantal(perBeroep: Map<number, BezoekRij[]>, beroepId: number): Verwachting | null {
  const rij = perBeroep.get(beroepId)?.[0];
  return rij ? { aantal: rij.aantal, jaar: rij.jaar, bron: rij.bron } : null;
}

/** Upsert-statement (bron handmatig overschrijft alles; evaluatie laat handmatig staan). */
function upsertStmt(db: D1Database, beroepId: number, jaar: number, aantal: number, bron: BezoekBron): D1PreparedStatement {
  const guard = bron === 'evaluatie' ? " WHERE beroep_bezoek.bron = 'evaluatie'" : '';
  return db
    .prepare(
      `INSERT INTO beroep_bezoek (beroep_id, jaar, aantal, bron, updated_at) VALUES (?, ?, ?, ?, unixepoch())
       ON CONFLICT(beroep_id, jaar) DO UPDATE SET aantal = excluded.aantal, bron = excluded.bron, updated_at = excluded.updated_at${guard}`
    )
    .bind(beroepId, jaar, aantal, bron);
}

/**
 * Verwerkt de invoervelden van één beroep (formulier): per jaar een veld
 * `<prefix><jaar>`. Leeg = rij verwijderen, getal = handmatig opslaan.
 * Onveranderde waarden worden niet aangeraakt (zo blijft bron 'evaluatie'
 * staan zolang niemand het getal wijzigt).
 */
export async function saveBezoekVelden(
  db: D1Database,
  beroepId: number,
  body: Record<string, unknown>,
  prefix = 'bezoek_'
): Promise<void> {
  const bestaand = new Map<number, BezoekRij>();
  for (const r of (await loadBezoek(db)).get(beroepId) ?? []) bestaand.set(r.jaar, r);
  const stmts: D1PreparedStatement[] = [];
  for (const [key, raw] of Object.entries(body)) {
    if (!key.startsWith(prefix)) continue;
    const jaar = parseInt(key.slice(prefix.length), 10);
    if (!Number.isFinite(jaar) || jaar < 2000 || jaar > 2100) continue;
    const s = typeof raw === 'string' ? raw.trim() : '';
    const oud = bestaand.get(jaar);
    if (s === '') {
      if (oud) stmts.push(db.prepare('DELETE FROM beroep_bezoek WHERE beroep_id = ? AND jaar = ?').bind(beroepId, jaar));
      continue;
    }
    const n = parseInt(s, 10);
    if (!Number.isFinite(n) || n < 0) continue;
    if (oud && oud.aantal === n) continue;
    stmts.push(upsertStmt(db, beroepId, jaar, n, 'handmatig'));
  }
  if (stmts.length) await db.batch(stmts);
}

/**
 * Bulk-invoer voor één jaar: `waarden` = beroepId -> ingevulde tekst.
 * Zelfde regels als saveBezoekVelden. Geeft het aantal gewijzigde rijen terug.
 */
export async function saveBezoekJaar(db: D1Database, jaar: number, waarden: Map<number, string>): Promise<number> {
  const alle = await loadBezoek(db);
  const stmts: D1PreparedStatement[] = [];
  for (const [beroepId, s] of waarden) {
    const oud = alle.get(beroepId)?.find((r) => r.jaar === jaar);
    if (s === '') {
      if (oud) stmts.push(db.prepare('DELETE FROM beroep_bezoek WHERE beroep_id = ? AND jaar = ?').bind(beroepId, jaar));
      continue;
    }
    const n = parseInt(s, 10);
    if (!Number.isFinite(n) || n < 0) continue;
    if (oud && oud.aantal === n) continue;
    stmts.push(upsertStmt(db, beroepId, jaar, n, 'handmatig'));
  }
  for (let i = 0; i < stmts.length; i += 50) await db.batch(stmts.slice(i, i + 50));
  return stmts.length;
}

/**
 * Leidt uit de evaluaties van een editie het aantal leerlingen per beroep af en
 * schrijft dat weg als bron 'evaluatie' (handmatige waarden blijven staan).
 *
 * Per sessie telt het hoogste getal dat een voorlichter opgaf (voorlichters van
 * hetzelfde beroep zaten samen in dat lokaal, dus hun tellingen zijn dezelfde
 * groep); de sessies van één beroep worden opgeteld. Had de voorlichter geen
 * sessie in het programma, dan telt zijn losse totaal. Idempotent; kan na elke
 * ingevulde evaluatie opnieuw draaien (optioneel beperkt tot één beroep).
 * Geeft het aantal beroepen terug waarvoor een aantal is weggeschreven.
 */
export async function verwerkEvaluatieAantallen(
  db: D1Database,
  eventId: string,
  jaar: number,
  alleenBeroepId?: number
): Promise<number> {
  const [evalsQ, sessiesQ] = await Promise.all([
    db
      .prepare(
        `SELECT e.counts, e.total_participants, sp.beroep_id
           FROM speaker_evaluations e JOIN speakers sp ON sp.id = e.speaker_id
          WHERE e.event_id = ? AND sp.beroep_id IS NOT NULL${alleenBeroepId != null ? ' AND sp.beroep_id = ?' : ''}`
      )
      .bind(...(alleenBeroepId != null ? [eventId, alleenBeroepId] : [eventId]))
      .all<{ counts: string | null; total_participants: number | null; beroep_id: number }>(),
    db.prepare('SELECT id, beroep_id FROM sessions_program WHERE event_id = ?').bind(eventId).all<{ id: string; beroep_id: number | null }>(),
  ]);
  const sessieBeroep = new Map<string, number>();
  for (const s of sessiesQ.results ?? []) if (s.beroep_id != null) sessieBeroep.set(s.id, s.beroep_id);

  const perSessie = new Map<number, Map<string, number>>(); // beroep -> sessie -> max aantal
  const losTotaal = new Map<number, number>(); // beroep -> max totaal (zonder sessies)
  for (const e of evalsQ.results ?? []) {
    let counts: Record<string, unknown> = {};
    try { counts = e.counts ? JSON.parse(e.counts) : {}; } catch { counts = {}; }
    let telde = false;
    for (const [sid, v] of Object.entries(counts)) {
      const n = typeof v === 'number' ? v : parseInt(String(v), 10);
      if (!Number.isFinite(n) || n < 0) continue;
      const beroep = sessieBeroep.get(sid) ?? e.beroep_id;
      const m = perSessie.get(beroep) ?? perSessie.set(beroep, new Map()).get(beroep)!;
      m.set(sid, Math.max(m.get(sid) ?? 0, n));
      telde = true;
    }
    if (!telde && e.total_participants != null && e.total_participants >= 0) {
      losTotaal.set(e.beroep_id, Math.max(losTotaal.get(e.beroep_id) ?? 0, e.total_participants));
    }
  }

  const stmts: D1PreparedStatement[] = [];
  const beroepen = new Set<number>([...perSessie.keys(), ...losTotaal.keys()]);
  for (const beroepId of beroepen) {
    const sessies = perSessie.get(beroepId);
    const aantal = sessies ? [...sessies.values()].reduce((a, b) => a + b, 0) : losTotaal.get(beroepId);
    if (aantal == null) continue;
    stmts.push(upsertStmt(db, beroepId, jaar, aantal, 'evaluatie'));
  }
  for (let i = 0; i < stmts.length; i += 50) await db.batch(stmts.slice(i, i + 50));
  return stmts.length;
}
