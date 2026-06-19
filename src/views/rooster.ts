/**
 * Interactieve plattegrond voor de publieke /rooster-pagina.
 * Rendert per verdieping een SVG met de achtergrond-afbeelding en
 * klikbare lokaal-polygons. Klik → modal met de sessies in dat lokaal.
 *
 * Geeft '' terug als er nog geen plattegrond met getekende lokalen is,
 * zodat de pagina dan gewoon de placeholdertekst toont.
 */
import type { D1Database } from '@cloudflare/workers-types';
import { getActiveEvent } from '../lib/db';

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface ShapePts { x: number; y: number; }

function parseShape(s: string | null): ShapePts[] | null {
  if (!s) return null;
  try {
    const o = JSON.parse(s);
    if (o.shape === 'polygon' && o.points) {
      return String(o.points)
        .trim()
        .split(/\s+/)
        .map((p: string) => {
          const [x, y] = p.split(',').map(Number);
          return { x, y };
        });
    }
    if (o.shape === 'rect') {
      return [
        { x: o.x, y: o.y },
        { x: o.x + o.w, y: o.y },
        { x: o.x + o.w, y: o.y + o.h },
        { x: o.x, y: o.y + o.h },
      ];
    }
  } catch {
    /* ignore */
  }
  return null;
}

function centroid(pts: ShapePts[]) {
  const x = pts.reduce((a, p) => a + p.x, 0) / pts.length;
  const y = pts.reduce((a, p) => a + p.y, 0) / pts.length;
  return { x, y };
}

interface SessionInfo {
  profession: string;
  title: string | null;
  catName: string | null;
  catColor: string | null;
  round: string | null;
  speakers: string[];
}

export async function renderRoosterMap(db: D1Database): Promise<string> {
  const ev = await getActiveEvent(db);
  if (!ev) return '';

  const [fps, rooms, sess, spk] = await Promise.all([
    db.prepare('SELECT id, floor_slug, floor_label, image_url, viewbox FROM floorplans WHERE event_id = ? ORDER BY sort_order')
      .bind(ev.id)
      .all<{ id: string; floor_slug: string; floor_label: string; image_url: string; viewbox: string }>(),
    db.prepare("SELECT id, code, name, map_shape, map_floor FROM classrooms WHERE event_id = ? AND map_shape IS NOT NULL AND map_shape <> ''")
      .bind(ev.id)
      .all<{ id: string; code: string; name: string | null; map_shape: string; map_floor: string | null }>(),
    db.prepare(
      `SELECT s.id, s.profession, s.title, s.classroom_id,
              cat.name AS catName, cat.color AS catColor,
              r.round_no AS round_no, r.start_time AS start_time, r.end_time AS end_time
         FROM sessions_program s
         LEFT JOIN categories cat ON cat.id = s.category_id
         LEFT JOIN rounds r ON r.id = s.round_id
        WHERE s.event_id = ? AND s.is_public = 1 AND s.classroom_id IS NOT NULL`
    )
      .bind(ev.id)
      .all<{ id: string; profession: string; title: string | null; classroom_id: string; catName: string | null; catColor: string | null; round_no: number | null; start_time: string | null; end_time: string | null }>(),
    db.prepare(
      `SELECT ss.session_id, sp.full_name
         FROM session_speakers ss JOIN speakers sp ON sp.id = ss.speaker_id
        WHERE sp.is_public = 1 ORDER BY ss.sort_order`
    ).all<{ session_id: string; full_name: string }>(),
  ]);

  const floors = fps.results ?? [];
  const roomRows = rooms.results ?? [];
  if (floors.length === 0 || roomRows.length === 0) return '';

  // sprekers per sessie
  const speakersBySession = new Map<string, string[]>();
  for (const r of spk.results ?? []) {
    const list = speakersBySession.get(r.session_id) ?? [];
    list.push(r.full_name);
    speakersBySession.set(r.session_id, list);
  }

  // sessies per lokaal + categorie-legenda
  const byRoom = new Map<string, SessionInfo[]>();
  const legend = new Map<string, string>(); // name → color
  for (const s of sess.results ?? []) {
    const info: SessionInfo = {
      profession: s.profession,
      title: s.title,
      catName: s.catName,
      catColor: s.catColor,
      round: s.round_no ? `Ronde ${s.round_no}${s.start_time ? ` · ${s.start_time}–${s.end_time}` : ''}` : null,
      speakers: speakersBySession.get(s.id) ?? [],
    };
    const list = byRoom.get(s.classroom_id) ?? [];
    list.push(info);
    byRoom.set(s.classroom_id, list);
    if (s.catName) legend.set(s.catName, s.catColor ?? '#88bc1d');
  }

  // JSON voor de modal (client)
  const roomData: Record<string, { code: string; name: string | null; sessions: SessionInfo[] }> = {};
  for (const r of roomRows) {
    roomData[r.id] = { code: r.code, name: r.name, sessions: byRoom.get(r.id) ?? [] };
  }

  const floorPanels = floors
    .map((f, idx) => {
      const polys = roomRows
        .filter((r) => (r.map_floor ?? floors[0].floor_slug) === f.floor_slug)
        .map((r) => {
          const pts = parseShape(r.map_shape);
          if (!pts || pts.length < 3) return '';
          const hasSessions = (byRoom.get(r.id) ?? []).length > 0;
          const color = (byRoom.get(r.id) ?? [])[0]?.catColor ?? '#88bc1d';
          const c = centroid(pts);
          const pointsAttr = pts.map((p) => `${p.x},${p.y}`).join(' ');
          return `<g class="map-room ${hasSessions ? '' : 'map-room--empty'}" data-room-id="${esc(r.id)}" tabindex="0" role="button" aria-label="Lokaal ${esc(r.code)}">
            <polygon points="${pointsAttr}" style="--room-color:${esc(color)}"></polygon>
            <text x="${c.x}" y="${c.y}" text-anchor="middle" dominant-baseline="middle">${esc(r.code)}</text>
          </g>`;
        })
        .join('');
      return `<div class="map-panel" data-floor="${esc(f.floor_slug)}" ${idx === 0 ? '' : 'hidden'}>
        <svg viewBox="${esc(f.viewbox)}" class="map-svg" xmlns="http://www.w3.org/2000/svg">
          ${f.image_url ? `<image href="${esc(f.image_url)}" x="0" y="0" width="100%" height="100%" preserveAspectRatio="xMidYMid meet"></image>` : ''}
          ${polys}
        </svg>
      </div>`;
    })
    .join('');

  const tabs =
    floors.length > 1
      ? `<div class="map-tabs">${floors
          .map((f, i) => `<button type="button" class="map-tab ${i === 0 ? 'active' : ''}" data-floor="${esc(f.floor_slug)}">${esc(f.floor_label)}</button>`)
          .join('')}</div>`
      : '';

  const legendHtml = legend.size
    ? `<div class="map-legend">${Array.from(legend.entries())
        .map(([name, color]) => `<span class="map-legend__item"><span class="map-legend__dot" style="background:${esc(color)}"></span>${esc(name)}</span>`)
        .join('')}</div>`
    : '';

  return `
<style>
  .map-section { margin-top: 8px; }
  .map-tabs { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:14px; }
  .map-tab { padding:8px 16px; border:1px solid #d8dde1; background:#fff; border-radius:999px; font:inherit; cursor:pointer; }
  .map-tab.active { background:#88bc1d; border-color:#88bc1d; color:#15171a; font-weight:500; }
  .map-panel { border:1px solid #e3e6ea; border-radius:12px; overflow:hidden; background:#fafbfc; }
  .map-svg { display:block; width:100%; height:auto; }
  .map-room { cursor:pointer; }
  .map-room polygon { fill:color-mix(in srgb, var(--room-color) 30%, transparent); stroke:var(--room-color); stroke-width:2; transition:fill .15s; }
  .map-room:hover polygon, .map-room:focus polygon { fill:color-mix(in srgb, var(--room-color) 55%, transparent); outline:none; }
  .map-room text { font:600 13px 'DM Sans',sans-serif; fill:#15171a; pointer-events:none; }
  .map-room--empty polygon { fill:rgba(150,150,150,.18); stroke:#aab; }
  .map-room--empty text { fill:#667; }
  .map-legend { display:flex; flex-wrap:wrap; gap:14px; margin:16px 0; font-size:14px; }
  .map-legend__dot { display:inline-block; width:13px; height:13px; border-radius:3px; margin-right:6px; vertical-align:middle; }
  .map-modal { position:fixed; inset:0; background:rgba(0,0,0,.5); display:none; align-items:center; justify-content:center; padding:20px; z-index:50; }
  .map-modal.open { display:flex; }
  .map-modal__card { background:#fff; border-radius:14px; max-width:520px; width:100%; max-height:85vh; overflow-y:auto; padding:24px 26px; }
  .map-modal__head { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:8px; }
  .map-modal__head h3 { margin:0; font-size:22px; }
  .map-modal__close { background:none; border:none; font-size:26px; line-height:1; cursor:pointer; color:#666; }
  .map-sessie { border-top:1px solid #eee; padding:14px 0; }
  .map-sessie:first-child { border-top:none; }
  .map-sessie__cat { display:inline-block; font-size:12px; font-weight:600; padding:2px 9px; border-radius:999px; color:#fff; margin-bottom:6px; }
  .map-sessie h4 { margin:0 0 3px; font-size:17px; }
  .map-sessie__meta { color:#667; font-size:14px; }
</style>
<div class="map-section">
  ${tabs}
  ${floorPanels}
  ${legendHtml}
</div>
<div class="map-modal" id="mapModal" aria-hidden="true">
  <div class="map-modal__card" role="dialog" aria-modal="true" aria-labelledby="mapModalTitle">
    <div class="map-modal__head">
      <h3 id="mapModalTitle"></h3>
      <button type="button" class="map-modal__close" id="mapModalClose" aria-label="Sluiten">&times;</button>
    </div>
    <div id="mapModalBody"></div>
  </div>
</div>
<script type="application/json" id="map-data">${JSON.stringify(roomData)}</script>
<script src="/assets/js/floorplan-view.js" defer></script>`;
}
