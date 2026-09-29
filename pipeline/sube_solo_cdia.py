# -*- coding: utf-8 -*-
"""Sube CREDITO_DIA y CREDITO_SEDES a la hoja. Son 116 mil filas, asi que va
aparte y en segundo plano: en chunks de 1200 son ~97 escrituras y la cuota de
Sheets es por minuto."""
import lib, json, io, make_sheet, time

T = json.load(io.open('tables_cdia.json', encoding='utf8'))
sid = make_sheet.get_or_create()
info = lib.ex('GOOGLESHEETS_GET_SPREADSHEET_INFO', {'spreadsheet_id': sid})
have = set(s['properties']['title'] for s in info['data'].get('sheets', []))

for name in ['CREDITO_SEDES', 'CREDITO_DIA']:
    rows = T[name]
    if name not in have:
        r = lib.ex('GOOGLESHEETS_ADD_SHEET',
                   {'spreadsheetId': sid, 'properties': {'title': name}})
        print('  addSheet %s %s' % (name, r.get('successful', r.get('successfull'))))
    t0 = time.time()
    ok = make_sheet.write_table(sid, name, rows)
    print('  %-16s %7d filas %s  (%.0fs)'
          % (name, len(rows) - 1, 'OK' if ok else 'FALLO', time.time() - t0))
print('listo')
