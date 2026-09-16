# -*- coding: utf-8 -*-
"""Genereert schema/029: geeft de dienstruimten (die in 027 bewust GEEN
map_shape kregen) alsnog hun klikvlak, zodat ze op de publieke plattegrond
zichtbaar zijn (de viewer dimt de niet-gebruikte ruimten).

Coordinaten komen uit dezelfde generator/framing als 027, dus ze vallen exact
over de achtergrond. Idempotent: UPDATE per lokaal. Verandert in_use NIET.
"""
import json, os
from rooms import FLOORS
from gen import framed

HERE = os.path.dirname(os.path.abspath(__file__))
DEST = os.path.join(HERE, '..', '..', 'schema', '029_lokaal_shapes.sql')

L = [
    "-- 029_lokaal_shapes.sql",
    "-- Dienstruimten (kantoren, bergingen, techniek) kregen in 027 geen",
    "-- map_shape, waardoor ze niet op de publieke plattegrond stonden. Marco",
    "-- wil ze wel tonen, maar gedimd (de viewer dimt in_use = 0). Hier krijgen",
    "-- ze alsnog hun klikvlak; in_use blijft ongemoeid (028 bepaalt dat).",
    "-- Coordinaten uit dezelfde framing als 027. Idempotent.",
    "",
]
n = 0
for fl in FLOORS:
    g = framed(fl)
    for r in g['rooms']:
        if r['kind'] != 'dienst':
            continue
        shape = json.dumps({"shape": "rect", "x": r['x'], "y": r['y'], "w": r['w'], "h": r['h']},
                           separators=(',', ':'))
        L.append(f"UPDATE classrooms SET map_shape = '{shape}', map_floor = '{g['slug']}' "
                 f"WHERE id = 'cr_mcn_{r['code']}' AND (map_shape IS NULL OR map_shape = '');")
        n += 1
L.append("")
open(DEST, 'w').write('\n'.join(L))
print(f"029 geschreven: {n} dienstruimten van klikvlak voorzien -> {DEST}")
