# -*- coding: utf-8 -*-
"""Genereert de SVG-plattegronden, de D1-migratie en het lokalenregister.

Elke bouwlaag krijgt een eigen, strak bijgesneden coordinatenstelsel dat
bij 0,0 begint. De achtergrond-SVG en de klikvlakken in classrooms.map_shape
gebruiken datzelfde stelsel, zodat ze in de viewer exact over elkaar vallen.
"""
import json, os, csv, copy
from rooms import FLOORS

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')
os.makedirs(OUT, exist_ok=True)

INK = '#1f2937'
SOFT = '#9aa5b1'
GREY = '#6b7280'
LIME = '#88bc1d'
PAD = 16

FILL = {'les': '#ffffff', 'open': '#fcfdfe', 'bijz': '#f5f8f0', 'dienst': '#eef1f4'}
STROKE = {'les': (INK, 1.8, None), 'open': (SOFT, 1.3, '7 5'),
          'bijz': (INK, 1.5, None), 'dienst': (SOFT, 1.2, None)}
FAC_LABEL = {'trap': 'TRAP', 'lift': 'LIFT', 'wc': 'WC', 'berging': 'BERGING'}


def esc(s):
    return (str(s).replace('&', '&amp;').replace('<', '&lt;')
            .replace('>', '&gt;').replace('"', '&quot;'))


def framed(fl):
    """Verschuift alle geometrie zodat de bouwlaag bij 0,0 begint."""
    xs, ys = [], []
    for x, y in fl['outline']:
        xs.append(x); ys.append(y)
    for r in fl['rooms']:
        xs += [r['x'], r['x'] + r['w']]; ys += [r['y'], r['y'] + r['h']]
    for f in fl.get('facilities', []):
        xs += [f['x'], f['x'] + f['w']]; ys += [f['y'], f['y'] + f['h']]
    ox, oy = min(xs) - PAD, min(ys) - PAD
    w, h = max(xs) - ox + PAD, max(ys) - oy + PAD + 24   # ruimte voor het bijschrift
    g = copy.deepcopy(fl)
    g['outline'] = [(x - ox, y - oy) for x, y in fl['outline']]
    g['corridors'] = [(x - ox, y - oy, cw, ch) for (x, y, cw, ch) in fl.get('corridors', [])]
    g['voids'] = [(x - ox, y - oy, cw, ch) for (x, y, cw, ch) in fl.get('voids', [])]
    for r in g['rooms']:
        r['x'] -= ox; r['y'] -= oy
    for f in g.get('facilities', []):
        f['x'] -= ox; f['y'] -= oy
    g['w'], g['h'] = round(w), round(h)
    g['viewbox'] = f"0 0 {round(w)} {round(h)}"
    return g


def facility(f):
    t = f['t']
    x, y, w, h = f['x'], f['y'], f['w'], f['h']
    out = []
    if t == 'ingang':
        out.append(f'<g><circle cx="{x}" cy="{y}" r="10" fill="{LIME}"/>'
                   f'<path d="M{x-4.5} {y-5} L{x+4.5} {y} L{x-4.5} {y+5} Z" fill="#ffffff"/>'
                   f'<text x="{x+16}" y="{y+5}" font-size="14" font-weight="700" fill="{INK}">ingang</text></g>')
        return '\n'.join(out)
    out.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="2" '
               f'fill="#e4e9ee" stroke="{SOFT}" stroke-width="1.1"/>')
    if t == 'trap':
        step = h / 6
        yy = y + step
        while yy < y + h - 1:
            out.append(f'<line x1="{x+2}" y1="{yy:.1f}" x2="{x+w-2}" y2="{yy:.1f}" stroke="{SOFT}" stroke-width="0.9"/>')
            yy += step
    if t == 'lift':
        out.append(f'<line x1="{x+2}" y1="{y+2}" x2="{x+w-2}" y2="{y+h-2}" stroke="{SOFT}" stroke-width="0.9"/>')
        out.append(f'<line x1="{x+w-2}" y1="{y+2}" x2="{x+2}" y2="{y+h-2}" stroke="{SOFT}" stroke-width="0.9"/>')
    lab = FAC_LABEL[t]
    if t == 'berging' and w < 62:
        lab = 'BERG'
    fs = 10 if w >= 42 else 8
    if w >= 30:
        out.append(f'<text x="{x+w/2}" y="{y+h/2+3.5}" font-size="{fs}" fill="{GREY}" '
                   f'text-anchor="middle" letter-spacing="0.8">{lab}</text>')
    return '\n'.join(out)


def wrap(text, n):
    words, lines, cur = text.split(), [], ''
    for w in words:
        if len(cur) + len(w) + 1 <= n:
            cur = (cur + ' ' + w).strip()
        else:
            lines.append(cur); cur = w
    if cur:
        lines.append(cur)
    return lines


def svg_floor(g, labels=False):
    W, H = g['w'], g['h']
    p = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{g["viewbox"]}" width="{W}" height="{H}" '
         f'font-family="\'DM Sans\',\'Helvetica Neue\',Arial,sans-serif">',
         f'<rect x="0" y="0" width="{W}" height="{H}" fill="#ffffff"/>']
    pts = ' '.join(f'{x},{y}' for x, y in g['outline'])
    p.append(f'<polygon points="{pts}" fill="#f7fafb"/>')
    for (x, y, w, h) in g['corridors']:
        p.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="#e6ecf1"/>')
    for (x, y, w, h) in g['voids']:
        p.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="#f0f2f4" '
                 f'stroke="{SOFT}" stroke-width="1" stroke-dasharray="4 4"/>')
    for f in g.get('facilities', []):
        p.append(facility(f))
    for r in g['rooms']:
        st, sw, dash = STROKE[r['kind']]
        d = f' stroke-dasharray="{dash}"' if dash else ''
        p.append(f'<rect x="{r["x"]}" y="{r["y"]}" width="{r["w"]}" height="{r["h"]}" rx="1.5" '
                 f'fill="{FILL[r["kind"]]}" stroke="{st}" stroke-width="{sw}"{d}/>')
    p.append(f'<polygon points="{pts}" fill="none" stroke="{INK}" stroke-width="3.2" stroke-linejoin="round"/>')
    if labels:
        for r in g['rooms']:
            cx, cy = r['x'] + r['w'] / 2, r['y'] + r['h'] / 2
            wide = r['w'] >= 62 and r['h'] >= 50
            fs = 18 if wide else (13 if min(r['w'], r['h']) >= 34 else 10)
            if wide:
                nfs = 9.5 if r['w'] >= 100 else (8.2 if r['w'] >= 78 else 7.2)
                lines = wrap(r['name'], 17 if r['w'] >= 100 else (15 if r['w'] >= 78 else 14))[:2]
                extra = 1 if r.get('m2') and r['h'] >= 86 else 0
                block = len(lines) + extra
                top = cy - (block * 11) / 2 + 2
                p.append(f'<text x="{cx}" y="{top}" font-size="{fs}" font-weight="700" fill="{INK}" '
                         f'text-anchor="middle">{esc(r["code"])}</text>')
                for i, ln in enumerate(lines):
                    p.append(f'<text x="{cx}" y="{top + 15 + i*11}" font-size="{nfs}" fill="{GREY}" '
                             f'text-anchor="middle">{esc(ln)}</text>')
                if extra:
                    p.append(f'<text x="{cx}" y="{top + 15 + len(lines)*11}" font-size="9" fill="{SOFT}" '
                             f'text-anchor="middle">{r["m2"]} m2</text>')
            else:
                p.append(f'<text x="{cx}" y="{cy + fs/3}" font-size="{fs}" font-weight="700" fill="{INK}" '
                         f'text-anchor="middle">{esc(r["code"])}</text>')
    p.append(f'<g transform="translate({W-24},{H-30})">'
             f'<path d="M0 -15 L4.5 4 L0 0.5 L-4.5 4 Z" fill="{INK}"/>'
             f'<text x="0" y="15" font-size="10" fill="{GREY}" text-anchor="middle">N</text></g>')
    p.append(f'<text x="4" y="{H-6}" font-size="11.5" fill="{GREY}">Montessori College Nijmegen, '
             f'{esc(g["label"])}</text>')
    p.append('</svg>')
    return '\n'.join(p)


def main():
    frames = [framed(fl) for fl in FLOORS]
    register = []
    for g in frames:
        open(os.path.join(OUT, f'{g["slug"]}.svg'), 'w').write(svg_floor(g, labels=False))
        open(os.path.join(OUT, f'{g["slug"]}-genummerd.svg'), 'w').write(svg_floor(g, labels=True))
        for r in g['rooms']:
            register.append(dict(bouwlaag=g['label'], slug=g['slug'], code=r['code'],
                                 naam=r['name'], m2=r['m2'] or '', soort=r['kind'],
                                 x=r['x'], y=r['y'], w=r['w'], h=r['h']))
    with open(os.path.join(OUT, 'lokalen.csv'), 'w', newline='') as fh:
        wr = csv.DictWriter(fh, fieldnames=list(register[0].keys()))
        wr.writeheader(); wr.writerows(register)

    L = ["-- 027_plattegronden.sql",
         "-- Plattegronden Montessori College Nijmegen, bouwdeel BC, bouwlaag 0 tot en met 4.",
         "-- Gedigitaliseerd uit de scan 'Beuk nummering ruimtes definitief'",
         "-- (clipL2R interieurarchitecten, tek. B100 t/m B105, update 30 oktober 2013).",
         "-- Achtergrond per bouwlaag: /assets/plattegrond/<slug>.svg",
         "-- Klikvlakken staan als rect in classrooms.map_shape, in hetzelfde",
         "-- coordinatenstelsel als de viewBox van die bouwlaag.",
         "",
         "DELETE FROM classrooms WHERE id LIKE 'cr_mcn_%';",
         "DELETE FROM floorplans WHERE id LIKE 'fp_mcn_%';",
         ""]
    for g in frames:
        L += ["INSERT INTO floorplans (id, event_id, floor_slug, floor_label, image_url, viewbox, sort_order)",
              f"  SELECT 'fp_mcn_{g['slug']}', id, '{g['slug']}', '{g['label']}',",
              f"         '/assets/plattegrond/{g['slug']}.svg', '{g['viewbox']}', {g['sort']}",
              "    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;"]
    L.append("")
    for g in frames:
        L.append(f"-- {g['label']}: {g['note']}")
        for r in g['rooms']:
            shape = json.dumps({"shape": "rect", "x": r['x'], "y": r['y'], "w": r['w'], "h": r['h']},
                               separators=(',', ':'))
            name = r['name'].replace("'", "''")
            if r.get('m2'):
                name = f"{name} ({r['m2']} m2)"
            L += ["INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes)",
                  f"  SELECT 'cr_mcn_{r['code']}', id, '{r['code']}', '{name}', '{g['label']}', NULL,",
                  f"         '{shape}', '{g['slug']}', '{r['kind']}'",
                  "    FROM events ORDER BY is_active DESC, year DESC LIMIT 1;"]
        L.append("")
    open(os.path.join(OUT, '027_plattegronden.sql'), 'w').write('\n'.join(L) + '\n')
    print('lokalen:', len(register))
    for g in frames:
        print(f"  {g['label']}: {len(g['rooms'])} lokalen, "
              f"{sum(1 for r in g['rooms'] if r['kind'] == 'les')} lesruimten, viewBox {g['viewbox']}")


if __name__ == '__main__':
    main()
