# -*- coding: utf-8 -*-
"""Trae las dos hojas CRUDAS que Code.gs necesita para calcular el embudo
de WhatsApp EN VIVO, respetando el filtro de fecha global (no un
precalculo fijo): LT_TEL_SEDES (id_internal->telefono) y LT_WA_EVENTOS
(telefono, fecha, tipo: leido|respondio), una fila por dia distinto -- el
mismo patron que ya usa RESCATE_WA_EMBUDO_DIA para no romper el filtro de
fecha global (ver seccion 13 de CLAUDE.md: los filtros globales tienen que
cortar sobre datos crudos con fecha, no sobre un agregado ya fijo)."""
import json, io, sys, re, collections

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

telPorSede = json.load(io.open('lt_tel_sedes.json', encoding='utf8'))
mensajes = json.load(io.open('lt_wa_native_mensajes.json', encoding='utf8'))
WELLI_TEL = '3245135673'

def norm(t):
    return re.sub(r'\D', '', str(t or ''))[-10:]

filasTel = [['id_internal', 'telefono']]
for iid, tel in telPorSede.items():
    filasTel.append([iid, tel])

porDia = collections.defaultdict(lambda: {'leido': False, 'respondio': False})
for m in mensajes:
    t = norm(m.get('telefono'))
    if not t or t == WELLI_TEL or not m.get('fecha'):
        continue
    fch = m['fecha'][:10]
    b = porDia[(t, fch)]
    if m['direccion'] == 'OUTGOING' and m['estado'] == 'READ':
        b['leido'] = True
    elif m['direccion'] == 'INCOMING':
        b['respondio'] = True

filasEv = [['telefono', 'fecha', 'tipo']]
for (t, fch), b in porDia.items():
    if b['leido']:
        filasEv.append([t, fch, 'leido'])
    if b['respondio']:
        filasEv.append([t, fch, 'respondio'])

print('LT_TEL_SEDES:', len(filasTel) - 1, 'filas')
print('LT_WA_EVENTOS:', len(filasEv) - 1, 'filas')

json.dump({'LT_TEL_SEDES': filasTel, 'LT_WA_EVENTOS': filasEv},
          io.open('tables_lt_wa_crudo.json', 'w', encoding='utf8'), ensure_ascii=False)
print('escrito tables_lt_wa_crudo.json')
