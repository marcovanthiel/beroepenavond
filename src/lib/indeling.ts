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

export interface BeroepIndelingResultaat {
  beroepen: number;
  sessies: number;
  sprekers: number;
  rondes: number;
  lokalen: number;
  nietGeplaatst: number;
}

/**
 * Automatische programma-indeling: verdeelt de beroepen (workshops) over de
 * rondes en lokalen. Eén beroep = één workshop = één sessie; alle publieke
 * sprekers van dat beroep worden aan die sessie gekoppeld (sommige beroepen
 * hebben meerdere sprekers). Elk beroep komt één keer voor.
 *
 * Verdeling: beroepen gesorteerd op categorie (zodat categorieën over de
 * rondes gespreid worden), dan ronde = index % aantalRondes en lokaal =
 * floor(index / aantalRondes). Zo krijgt elke ronde andere lokalen (geen
 * dubbele boeking) en zijn de categorieën gemengd. Lokalen worden gekozen met
 * de smartboard-/theorielokalen eerst. Herdraaibaar: de oude sessies (en de
 * daarvan afhankelijke leerling-indeling) worden eerst gewist.
 */
export async function maakBeroepIndeling(db: D1Database, eventId: string): Promise<BeroepIndelingResultaat> {
  const [rondesQ, lokalenQ, beroepenQ, sprekersQ] = await Promise.all([
    db.prepare('SELECT id FROM rounds WHERE event_id = ? ORDER BY round_no').bind(eventId).all<{ id: string }>(),
    db
      .prepare(
        "SELECT id FROM classrooms WHERE event_id = ? AND in_use = 1 ORDER BY smartboard DESC, capacity IS NULL, capacity DESC, floor, code"
      )
      .bind(eventId)
      .all<{ id: string }>(),
    db
      .prepare(
        "SELECT b.id AS beroep_id, b.name, b.category_id FROM beroepen b WHERE EXISTS (SELECT 1 FROM speakers s WHERE s.beroep_id = b.id AND s.is_public = 1) ORDER BY b.category_id, b.name"
      )
      .all<{ beroep_id: number; name: string; category_id: number | null }>(),
    db
      .prepare('SELECT id, beroep_id FROM speakers WHERE is_public = 1 AND beroep_id IS NOT NULL ORDER BY beroep_id, full_name')
      .all<{ id: string; beroep_id: number }>(),
  ]);

  const rondes = (rondesQ.results ?? []).map((r) => r.id);
  const lokalen = (lokalenQ.results ?? []).map((r) => r.id);
  const beroepen = beroepenQ.results ?? [];
  if (!rondes.length) throw new Error('Er zijn nog geen rondes. Maak die eerst aan bij Rondes.');
  if (!lokalen.length) throw new Error('Er zijn geen lokalen die op "in gebruik" staan.');

  const sprekersPerBeroep = new Map<number, string[]>();
  for (const s of sprekersQ.results ?? []) {
    (sprekersPerBeroep.get(s.beroep_id) ?? sprekersPerBeroep.set(s.beroep_id, []).get(s.beroep_id)!).push(s.id);
  }

  const R = rondes.length;

  // Opschonen (herdraaibaar). session_speakers en de leerling-indeling hangen
  // aan de sessies, dus die eerst weg.
  await db
    .prepare('DELETE FROM session_speakers WHERE session_id IN (SELECT id FROM sessions_program WHERE event_id = ?)')
    .bind(eventId)
    .run();
  await db.prepare('DELETE FROM student_schedule WHERE event_id = ?').bind(eventId).run();
  await db.prepare('DELETE FROM sessions_program WHERE event_id = ?').bind(eventId).run();

  const sesInsert = db.prepare(
    'INSERT INTO sessions_program (id, event_id, category_id, classroom_id, round_id, beroep_id, profession, title, description_md, is_public, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, 1, unixepoch(), unixepoch())'
  );
  const spkInsert = db.prepare('INSERT INTO session_speakers (session_id, speaker_id, sort_order) VALUES (?, ?, ?)');

  const stmts: D1PreparedStatement[] = [];
  let sessies = 0;
  let sprekers = 0;
  let nietGeplaatst = 0;
  const gebruikteLokalen = new Set<string>();
  for (let i = 0; i < beroepen.length; i++) {
    const roomIdx = Math.floor(i / R);
    if (roomIdx >= lokalen.length) {
      nietGeplaatst++;
      continue;
    }
    const b = beroepen[i];
    const roundId = rondes[i % R];
    const roomId = lokalen[roomIdx];
    gebruikteLokalen.add(roomId);
    const sid = genId('ses');
    stmts.push(sesInsert.bind(sid, eventId, b.category_id ?? null, roomId, roundId, b.beroep_id, b.name));
    sessies++;
    for (const [idx, spId] of (sprekersPerBeroep.get(b.beroep_id) ?? []).entries()) {
      stmts.push(spkInsert.bind(sid, spId, idx));
      sprekers++;
    }
  }
  for (let i = 0; i < stmts.length; i += 50) {
    await db.batch(stmts.slice(i, i + 50));
  }

  return { beroepen: beroepen.length, sessies, sprekers, rondes: R, lokalen: gebruikteLokalen.size, nietGeplaatst };
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
