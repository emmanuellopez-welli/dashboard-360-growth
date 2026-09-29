# -*- coding: utf-8 -*-
"""Sube DESEMBOLSO_RESCATE_DIA a la hoja y a sheet_data.json.
Reemplaza (borra) DESEMBOLSO_GENERAL_DIA, que quedo mal definido: traia
TODA la empresa en vez de solo lo que es resultado de rescate."""
import lib, json, io, make_sheet

T = json.load(io.open('tables_desembolso_rescate.json', encoding='utf8'))
sid = make_sheet.get_or_create()
info = lib.ex('GOOGLESHEETS_GET_SPREADSHEET_INFO', {'spreadsheet_id': sid})
have = {s['properties']['title']: s['properties']['sheetId']
        for s in info['data'].get('sheets', [])}

VIEJA = 'DESEMBOLSO_GENERAL_DIA'
if VIEJA in have:
    lib.ex('GOOGLESHEETS_BATCH_UPDATE', {
        'spreadsheetId': sid,
        'requests': [{'deleteSheet': {'sheetId': have[VIEJA]}}]
    })
    print('  borrada la hoja vieja', VIEJA)

for name, rows in T.items():
    if name not in have:
        r = lib.ex('GOOGLESHEETS_ADD_SHEET',
                   {'spreadsheetId': sid, 'properties': {'title': name}})
        print('  addSheet', name, r.get('successful', r.get('successfull')))
    ok = make_sheet.write_table(sid, name, rows)
    print('  %-24s %6d filas %s' % (name, len(rows) - 1, 'OK' if ok else 'FALLO'))

D = json.load(io.open('sheet_data.json', encoding='utf8'))
D.pop(VIEJA, None)
D.update(T)
json.dump(D, io.open('sheet_data.json', 'w', encoding='utf8'), ensure_ascii=False)
print('sheet_data.json ahora tiene %d hojas' % len(D))
