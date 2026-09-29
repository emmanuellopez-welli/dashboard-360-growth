# -*- coding: utf-8 -*-
"""Sube RESCATE_APROB_MSJ a la hoja y a sheet_data.json."""
import lib, json, io, make_sheet

T = json.load(io.open('tables_aprob_msj.json', encoding='utf8'))
sid = make_sheet.get_or_create()
info = lib.ex('GOOGLESHEETS_GET_SPREADSHEET_INFO', {'spreadsheet_id': sid})
have = set(s['properties']['title'] for s in info['data'].get('sheets', []))

for name, rows in T.items():
    if name not in have:
        r = lib.ex('GOOGLESHEETS_ADD_SHEET',
                   {'spreadsheetId': sid, 'properties': {'title': name}})
        print('  addSheet', name, r.get('successful', r.get('successfull')))
    ok = make_sheet.write_table(sid, name, rows)
    print('  %-20s %6d filas %s' % (name, len(rows) - 1, 'OK' if ok else 'FALLO'))

D = json.load(io.open('sheet_data.json', encoding='utf8'))
D.update(T)
json.dump(D, io.open('sheet_data.json', 'w', encoding='utf8'), ensure_ascii=False)
print('sheet_data.json ahora tiene %d hojas' % len(D))
