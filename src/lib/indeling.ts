/**
 * Automatische leerling-indeling (leerling-proces 2).
 *
 * Wijs de voorkeuren (student_picks) toe aan concrete sessies per ronde:
 * greedy in twee passen: eerste pass geeft elke leerling zijn hoogste
 * voorkeuren, tweede pass vult resterende vrije rondes met overgebleven
 * wensen. Er wordt rekening gehouden met geblokkeerde tijdblokken
 * (student_blocked_rounds) en lokaal-capaciteit (default 30).
 */
import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types';
import { genId } from './forms';

export type IndelingModus = 'proef' | 'definitief';

export interface VoorstelSessie {
  beroepId: number;
  naam: string;
  categorieId: string | null;
  categorieNaam: string | null;
  kleur: string | null;
  rondeId: string;
  rondeNo: number;
  rondeTijd: string;
  lokaalId: string;
  lokaalCode: string;
  speakerIds: string[];
  sprekerNamen: string[];
  voorkeurGevolgd: boolean | null; // null = geen voorkeur opgegeven
}

export interface OnplaatsbaarBeroep {
  beroepId: number;
  naam: string;
  reden: string;
  sprekerNamen: string[];
}

export interface IndelingVoorstel {
  modus: IndelingModus;
  sessies: VoorstelSessie[];
  onplaatsbaar: OnplaatsbaarBeroep[];
  stats: {
    beroepenMetVoorlichter: number;
    sessies: number;
    sprekers: number;
    rondes: number;
    lokalen: number;
    voorkeurGemist: number;
  };
}

interface SprekerRij { id: string; beroep_id: number; full_name: string }

/**
 * Berekent een voorstel voor de sessie-indeling ZONDER iets weg te schrijven
 * (preview). Eén beroep-met-voorlichter = één sessie; alle voorlichters van dat
 * beroep komen samen in dat lokaal.
 *
 * - modus 'proef': alle publieke (aangemelde) voorlichters tellen mee.
 * - modus 'definitief': alleen bevestigde voorlichters.
 *
 * Tijdvak per beroep = een ronde waarin ALLE voorlichters van dat beroep kunnen
 * (harde beschikbaarheid; doorsnede). Binnen de toegestane rondes weegt de
 * zachte voorkeur mee. Lokalen worden per ronde per vakgebied geclusterd.
 * Beroepen zonder gezamenlijk tijdvak (of waar alle tijdvakken vol zijn) komen
 * in de lijst 'onplaatsbaar' en moeten handmatig worden opgelost.
 */
export async function berekenBeroepIndeling(
  db: D1Database,
  eventId: string,
  modus: IndelingModus
): Promise<IndelingVoorstel> {
  const sprekerFilter = modus === 'definitief' ? 'is_public = 1 AND confirmed = 1' : 'is_public = 1';
  const [rondesQ, lokalenQ, catsQ, beroepenQ, sprekersQ, prefsQ] = await Promise.all([
    db.prepare('SELECT id, round_no, start_time, end_time FROM rounds WHERE event_id = ? ORDER BY round_no').bind(eventId).all<{ id: string; round_no: number; start_time: string | null; end_time: string | null }>(),
    db.prepare("SELECT id, code, floor, smartboard, capacity FROM classrooms WHERE event_id = ? AND in_use = 1 ORDER BY smartboard DESC, capacity IS NULL, capacity DESC, floor, code").bind(eventId).all<{ id: string; code: string; floor: string | null; smartboard: number; capacity: number | null }>(),
    db.prepare('SELECT id, name, color, sort_order FROM categories ORDER BY sort_order').all<{ id: string; name: string; color: string | null; sort_order: number }>(),
    db.prepare(`SELECT b.id AS beroep_id, b.name, b.category_id FROM beroepen b WHERE EXISTS (SELECT 1 FROM speakers s WHERE s.beroep_id = b.id AND ${sprekerFilter}) ORDER BY b.category_id, b.sort_order, b.name`).all<{ beroep_id: number; name: string; category_id: string | null }>(),
    db.prepare(`SELECT id, beroep_id, full_name FROM speakers WHERE ${sprekerFilter} AND beroep_id IS NOT NULL ORDER BY beroep_id, full_name`).all<SprekerRij>(),
    db.prepare('SELECT speaker_id, round_id, status FROM speaker_round_prefs').all<{ speaker_id: string; round_id: string; status: string }>(),
  ]);

  const rondes = rondesQ.results ?? [];
  const lokalen = lokalenQ.results ?? [];
  const beroepen = beroepenQ.results ?? [];
  if (!rondes.length) throw new Error('Er zijn nog geen rondes (tijdvakken). Maak die eerst aan bij Rondes.');
  if (!lokalen.length) throw new Error('Er zijn geen lokalen die op "in gebruik" staan.');

  const catById = new Map(catsQ.results?.map((c) => [c.id, c]) ?? []);
  const rondeById = new Map(rondes.map((r) => [r.id, r]));
  const capPerRonde = lokalen.length;

  const sprekersPerBeroep = new Map<number, SprekerRij[]>();
  for (const s of sprekersQ.results ?? []) {
    (sprekersPerBeroep.get(s.beroep_id) ?? sprekersPerBeroep.set(s.beroep_id, []).get(s.beroep_id)!).push(s);
  }
  // beschikbaarheid/voorkeur per spreker
  const nietKan = new Map<string, Set<string>>(); // speaker -> rondes 'nee'
  const voorkeur = new Map<string, Set<string>>(); // speaker -> rondes 'voorkeur'
  for (const p of prefsQ.results ?? []) {
    const m = p.status === 'voorkeur' ? voorkeur : nietKan;
    (m.get(p.speaker_id) ?? m.set(p.speaker_id, new Set()).get(p.speaker_id)!).add(p.round_id);
  }

  // Per beroep: toegestane rondes (doorsnede beschikbaarheid) + voorkeurscore.
  interface Kandidaat { beroep: { beroep_id: number; name: string; category_id: string | null }; sprekers: SprekerRij[]; toegestaan: string[]; heeftVoorkeur: boolean; prefScore: (r: string) => number; }
  const kandidaten: Kandidaat[] = [];
  const onplaatsbaar: OnplaatsbaarBeroep[] = [];
  for (const b of beroepen) {
    const sprekers = sprekersPerBeroep.get(b.beroep_id) ?? [];
    const namen = sprekers.map((s) => s.full_name);
    const toegestaan = rondes
      .map((r) => r.id)
      .filter((rid) => sprekers.every((s) => !nietKan.get(s.id)?.has(rid)));
    const heeftVoorkeur = sprekers.some((s) => (voorkeur.get(s.id)?.size ?? 0) > 0);
    const prefScore = (rid: string) => sprekers.reduce((n, s) => n + (voorkeur.get(s.id)?.has(rid) ? 1 : 0), 0);
    if (!toegestaan.length) {
      onplaatsbaar.push({ beroepId: b.beroep_id, naam: b.name, reden: 'Geen tijdvak waarin alle voorlichters kunnen', sprekerNamen: namen });
      continue;
    }
    kandidaten.push({ beroep: b, sprekers, toegestaan, heeftVoorkeur, prefScore });
  }

  // Pass A: rondekeuze. Meest beperkte beroepen eerst (minste toegestane rondes).
  kandidaten.sort((a, b) => a.toegestaan.length - b.toegestaan.length);
  const perRonde = new Map<string, Kandidaat[]>();
  rondes.forEach((r) => perRonde.set(r.id, []));
  const gekozenRonde = new Map<number, string>();
  for (const k of kandidaten) {
    const opties = k.toegestaan.filter((rid) => (perRonde.get(rid)?.length ?? 0) < capPerRonde);
    if (!opties.length) {
      onplaatsbaar.push({ beroepId: k.beroep.beroep_id, naam: k.beroep.name, reden: 'Alle beschikbare tijdvakken zitten vol', sprekerNamen: k.sprekers.map((s) => s.full_name) });
      continue;
    }
    // Kies: hoogste voorkeurscore, dan de minst gevulde ronde (balans).
    opties.sort((r1, r2) => k.prefScore(r2) - k.prefScore(r1) || (perRonde.get(r1)!.length - perRonde.get(r2)!.length));
    const rid = opties[0];
    perRonde.get(rid)!.push(k);
    gekozenRonde.set(k.beroep.beroep_id, rid);
  }

  // Pass B: lokaaltoewijzing per ronde, geclusterd op vakgebied.
  const catOrder = (id: string | null): number => (id ? catById.get(id)?.sort_order ?? 999 : 999);
  const sessies: VoorstelSessie[] = [];
  let voorkeurGemist = 0;
  const gebruikteLokalen = new Set<string>();
  for (const r of rondes) {
    const lijst = (perRonde.get(r.id) ?? []).slice().sort(
      (a, b) => catOrder(a.beroep.category_id) - catOrder(b.beroep.category_id) || a.beroep.name.localeCompare(b.beroep.name, 'nl')
    );
    lijst.forEach((k, i) => {
      const lok = lokalen[i];
      gebruikteLokalen.add(lok.id);
      const cat = k.beroep.category_id ? catById.get(k.beroep.category_id) : null;
      const gevolgd = k.heeftVoorkeur ? k.prefScore(r.id) > 0 : null;
      if (gevolgd === false) voorkeurGemist++;
      sessies.push({
        beroepId: k.beroep.beroep_id,
        naam: k.beroep.name,
        categorieId: k.beroep.category_id,
        categorieNaam: cat?.name ?? null,
        kleur: cat?.color ?? null,
        rondeId: r.id,
        rondeNo: r.round_no,
        rondeTijd: r.start_time ? `${r.start_time}${r.end_time ? ` tot ${r.end_time}` : ''}` : '',
        lokaalId: lok.id,
        lokaalCode: lok.code,
        speakerIds: k.sprekers.map((s) => s.id),
        sprekerNamen: k.sprekers.map((s) => s.full_name),
        voorkeurGevolgd: gevolgd,
      });
    });
  }
  sessies.sort((a, b) => a.rondeNo - b.rondeNo || a.lokaalCode.localeCompare(b.lokaalCode, 'nl', { numeric: true }));

  return {
    modus,
    sessies,
    onplaatsbaar,
    stats: {
      beroepenMetVoorlichter: beroepen.length,
      sessies: sessies.length,
      sprekers: sessies.reduce((n, s) => n + s.speakerIds.length, 0),
      rondes: rondes.length,
      lokalen: gebruikteLokalen.size,
      voorkeurGemist,
    },
  };
}

/**
 * Schrijft een berekend voorstel weg naar sessions_program + session_speakers
 * (volledige herbouw voor de editie). De leerling-indeling hangt aan de sessies
 * en wordt daarom ook gewist.
 */
export async function pasBeroepIndelingToe(db: D1Database, eventId: string, voorstel: IndelingVoorstel): Promise<number> {
  await db.prepare('DELETE FROM session_speakers WHERE session_id IN (SELECT id FROM sessions_program WHERE event_id = ?)').bind(eventId).run();
  await db.prepare('DELETE FROM student_schedule WHERE event_id = ?').bind(eventId).run();
  await db.prepare('DELETE FROM sessions_program WHERE event_id = ?').bind(eventId).run();

  const sesInsert = db.prepare(
    'INSERT INTO sessions_program (id, event_id, category_id, classroom_id, round_id, beroep_id, profession, title, description_md, is_public, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, 1, unixepoch(), unixepoch())'
  );
  const spkInsert = db.prepare('INSERT INTO session_speakers (session_id, speaker_id, sort_order) VALUES (?, ?, ?)');
  const stmts: D1PreparedStatement[] = [];
  for (const s of voorstel.sessies) {
    const sid = genId('ses');
    stmts.push(sesInsert.bind(sid, eventId, s.categorieId ?? null, s.lokaalId, s.rondeId, s.beroepId, s.naam));
    s.speakerIds.forEach((spId, idx) => stmts.push(spkInsert.bind(sid, spId, idx)));
  }
  for (let i = 0; i < stmts.length; i += 50) await db.batch(stmts.slice(i, i + 50));
  return voorstel.sessies.length;
}

export interface IndelingResultaat {
  leerlingen: number;
  plaatsingen: number;
  onvervuldeWensen: number;
  zonderEnkelePlek: number;
}

const DEFAULT_CAPACITEIT = 30;

export async function maakIndeling(db: D1Database, eventId: string): Promise<IndelingResultaat> {
  const [rondesQ, sessiesQ, picksQ, blokkadesQ, studentenQ] = await Promise.all([
    db.prepare('SELECT id FROM rounds WHERE event_id = ? ORDER BY round_no').bind(eventId).all<{ id: string }>(),
    db.prepare(
      `SELECT s.id, s.beroep_id, s.round_id, COALESCE(cl.capacity, ${DEFAULT_CAPACITEIT}) AS capaciteit
       FROM sessions_program s LEFT JOIN classrooms cl ON cl.id = s.classroom_id
       WHERE s.event_id = ? AND s.is_public = 1 AND s.beroep_id IS NOT NULL AND s.round_id IS NOT NULL`
    ).bind(eventId).all<{ id: string; beroep_id: number; round_id: string; capaciteit: number }>(),
    db.prepare('SELECT student_id, beroep_id, rowid AS volgorde FROM student_picks ORDER BY student_id, rowid').all<{ student_id: string; beroep_id: number; volgorde: number }>(),
    db.prepare('SELECT student_id, round_id FROM student_blocked_rounds').all<{ student_id: string; round_id: string }>(),
    db.prepare('SELECT id FROM students').all<{ id: string }>(),
  ]);

  const rondes = (rondesQ.results ?? []).map((r) => r.id);
  const sessies = sessiesQ.results ?? [];

  // beroep → sessies (per ronde), met bezetting-teller.
  const perBeroep = new Map<number, { id: string; round_id: string; capaciteit: number; bezet: number }[]>();
  for (const s of sessies) {
    (perBeroep.get(s.beroep_id) ?? perBeroep.set(s.beroep_id, []).get(s.beroep_id)!)
      .push({ id: s.id, round_id: s.round_id, capaciteit: s.capaciteit, bezet: 0 });
  }

  const geblokkeerd = new Map<string, Set<string>>();
  for (const b of blokkadesQ.results ?? []) {
    (geblokkeerd.get(b.student_id) ?? geblokkeerd.set(b.student_id, new Set()).get(b.student_id)!).add(b.round_id);
  }

  const wensen = new Map<string, number[]>();
  for (const p of picksQ.results ?? []) {
    (wensen.get(p.student_id) ?? wensen.set(p.student_id, []).get(p.student_id)!).push(p.beroep_id);
  }

  // Toewijzing: student → (ronde → sessie).
  const toewijzing = new Map<string, Map<string, string>>();
  const vervuld = new Map<string, Set<number>>();
  const studenten = (studentenQ.results ?? []).map((s) => s.id).filter((id) => (wensen.get(id) ?? []).length);

  // Twee passen: pass 0 = ieders 1e/2e/... wens om beurten (fair), door te
  // itereren op wens-index; pass 1 gebeurt impliciet doordat we per
  // wens-index alle studenten langsgaan.
  const maxWensen = Math.max(0, ...studenten.map((id) => wensen.get(id)!.length));
  for (let w = 0; w < maxWensen; w++) {
    for (const stu of studenten) {
      const lijst = wensen.get(stu)!;
      if (w >= lijst.length) continue;
      const beroep = lijst[w];
      const klaar = vervuld.get(stu) ?? vervuld.set(stu, new Set()).get(stu)!;
      if (klaar.has(beroep)) continue;
      const mijn = toewijzing.get(stu) ?? toewijzing.set(stu, new Map()).get(stu)!;
      if (mijn.size >= rondes.length) continue;
      const blokkades = geblokkeerd.get(stu);
      const opties = (perBeroep.get(beroep) ?? []).filter(
        (s) => s.bezet < s.capaciteit && !mijn.has(s.round_id) && !blokkades?.has(s.round_id)
      );
      if (!opties.length) continue;
      // Kies de sessie met de meeste restcapaciteit (spreidt de drukte).
      opties.sort((a, b2) => (b2.capaciteit - b2.bezet) - (a.capaciteit - a.bezet));
      const gekozen = opties[0];
      gekozen.bezet++;
      mijn.set(gekozen.round_id, gekozen.id);
      klaar.add(beroep);
    }
  }

  // Wegschrijven (indeling is herdraaibaar: oude indeling weg).
  await db.prepare('DELETE FROM student_schedule WHERE event_id = ?').bind(eventId).run();
  const inserts: string[] = [];
  for (const [stu, mijn] of toewijzing) {
    for (const [ronde, sessie] of mijn) {
      inserts.push(`('${stu.replace(/'/g, "''")}', '${eventId.replace(/'/g, "''")}', '${ronde.replace(/'/g, "''")}', '${sessie.replace(/'/g, "''")}')`);
    }
  }
  for (let i = 0; i < inserts.length; i += 50) {
    await db.prepare(
      `INSERT INTO student_schedule (student_id, event_id, round_id, session_id) VALUES ${inserts.slice(i, i + 50).join(',')}`
    ).run();
  }

  let plaatsingen = 0;
  let zonder = 0;
  for (const stu of studenten) {
    const n = toewijzing.get(stu)?.size ?? 0;
    plaatsingen += n;
    if (!n) zonder++;
  }
  const totaalWensen = studenten.reduce((a, id) => a + new Set(wensen.get(id)).size, 0);
  return {
    leerlingen: studenten.length,
    plaatsingen,
    onvervuldeWensen: Math.max(0, totaalWensen - plaatsingen),
    zonderEnkelePlek: zonder,
  };
}

/** Leesbaar rooster voor een leerling (voor mail + dashboard). */
export async function studentRooster(
  db: D1Database,
  studentId: string,
  eventId: string
): Promise<{ ronde: number | null; tijd: string; beroep: string; lokaal: string }[]> {
  const rows = await db.prepare(
    `SELECT r.round_no, r.start_time, r.end_time, b.name AS beroep, cl.code AS lokaal
     FROM student_schedule ss
     JOIN sessions_program s ON s.id = ss.session_id
     LEFT JOIN rounds r ON r.id = ss.round_id
     LEFT JOIN beroepen b ON b.id = s.beroep_id
     LEFT JOIN classrooms cl ON cl.id = s.classroom_id
     WHERE ss.student_id = ? AND ss.event_id = ?
     ORDER BY r.round_no`
  ).bind(studentId, eventId).all<{ round_no: number | null; start_time: string | null; end_time: string | null; beroep: string | null; lokaal: string | null }>();
  return (rows.results ?? []).map((r) => ({
    ronde: r.round_no,
    tijd: r.start_time ? `${r.start_time}${r.end_time ? ` tot ${r.end_time}` : ''}` : '',
    beroep: r.beroep ?? 'onbekend',
    lokaal: r.lokaal ?? 'volgt',
  }));
}
