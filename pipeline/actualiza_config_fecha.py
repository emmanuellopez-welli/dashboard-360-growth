# -*- coding: utf-8 -*-
"""Actualiza CONFIG.ultima_actualizacion -- el pipeline de Python refresca
las TABLAS pero nunca este campo, que es lo que el header del tablero
muestra como 'Datos actualizados'. Sin esto, un refresh 100% real se ve
viejo (Emmanuel lo detecto el 17-sep-2026: la etiqueta decia 2-sep con
todo el resto ya fresco a hoy)."""
import lib, json, io, datetime

ahora = datetime.datetime.now().strftime('%Y-%m-%d %H:%M')
sid = lib.C.tools.execute  # noop, solo para dejar lib importado
import make_sheet
sid = make_sheet.get_or_create()

info = lib.ex('GOOGLESHEETS_GET_SPREADSHEET_INFO', {'spreadsheet_id': sid})
cfgSheetId = None
for s in info['data'].get('sheets', []):
    if s['properties']['title'] == 'CONFIG':
        cfgSheetId = s['properties']['sheetId']
        break
print('CONFIG sheetId:', cfgSheetId)

# Leer la hoja CONFIG para saber en que fila esta 'ultima_actualizacion'
d = json.load(io.open('sheet_data.json', encoding='utf8'))
filas = d['CONFIG']
fila_idx = None
for i, r in enumerate(filas):
    if r and r[0] == 'ultima_actualizacion':
        fila_idx = i
        break
print('fila (0-indexed, con header):', fila_idx, '-> valor viejo:', filas[fila_idx][1])

r = lib.ex('GOOGLESHEETS_BATCH_UPDATE', {
    'spreadsheet_id': sid,
    'sheet_name': 'CONFIG',
    'first_cell_location': 'B%d' % (fila_idx + 1),
    'values': [[ahora]]
})
print('escrito:', ahora, '->', r.get('successful', r.get('successfull')))

filas[fila_idx][1] = ahora
d['CONFIG'] = filas
json.dump(d, io.open('sheet_data.json', 'w', encoding='utf8'), ensure_ascii=False)
print('sheet_data.json local actualizado tambien')
