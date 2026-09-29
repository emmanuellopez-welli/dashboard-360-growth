# -*- coding: utf-8 -*-
"""Subidor generico: python sube_generico.py <archivo.json>
Sube todas las tablas de ese json a la hoja y las mete en sheet_data.json.

24-sep-2026: GOOGLESHEETS_GET_SPREADSHEET_INFO sobre una hoja de 85 pestanas
empezo a devolver una respuesta truncada por el proxy de Composio (siempre
el MISMO offset de corte, ~14.6 MB, sin importar el payload) -- con esta
hoja ya grande, un solo intento sin reintento tumbaba TODA la subida de ese
archivo. Se le agrega el mismo patron de reintento que ya usa write_table."""
import lib, json, io, sys, time, make_sheet

archivo = sys.argv[1]
T = json.load(io.open(archivo, encoding='utf8'))
sid = make_sheet.get_or_create()

info = None
for intento in range(5):
    try:
        info = lib.ex('GOOGLESHEETS_GET_SPREADSHEET_INFO', {'spreadsheet_id': sid})
        break
    except Exception as e:
        print('  retry GOOGLESHEETS_GET_SPREADSHEET_INFO:', str(e)[:120])
        time.sleep(4)
if info is None:
    raise RuntimeError('GOOGLESHEETS_GET_SPREADSHEET_INFO fallo 5 veces seguidas')
have = set(s['properties']['title'] for s in info['data'].get('sheets', []))

for name, rows in T.items():
    if name not in have:
        r = lib.ex('GOOGLESHEETS_ADD_SHEET',
                   {'spreadsheetId': sid, 'properties': {'title': name}})
        print('  addSheet', name, r.get('successful', r.get('successfull')))
    ok = make_sheet.write_table(sid, name, rows)
    print('  %-16s %6d filas %s' % (name, len(rows) - 1, 'OK' if ok else 'FALLO'))

D = json.load(io.open('sheet_data.json', encoding='utf8'))
D.update(T)
json.dump(D, io.open('sheet_data.json', 'w', encoding='utf8'), ensure_ascii=False)
print('sheet_data.json ahora tiene %d hojas' % len(D))
