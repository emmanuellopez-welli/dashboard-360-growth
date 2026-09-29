# -*- coding: utf-8 -*-
"""Paso 1: decodifica los 5 workflows de Long Tail y arma la lista real de
piezas (email content_id / whatsapp rootMicId) en orden, con el dia
aproximado de envio. Fuente de verdad: la propia definicion del workflow en
HubSpot (automation/v4/flows), no el nombre de la pieza en LT_CADENCIA."""
import lib, json, io

HS = 'ca_13P0RgH6oZrv'
WORKFLOWS = {
    '1872026920': '[Growth] 04 Vuelve a aplicar',
    '1872023650': '[Growth] 02 Que paciente si pasa',
    '1872023651': '[Growth] 05 Reconocimiento',
    '1872026919': 'LT 03 Tu trabajo si sirve',
    '1872026911': '[Growth] 01 Estrena tu primer paciente',
}

def proxy(ep):
    r = lib.C.tools.proxy(endpoint=ep, method='GET', connected_account_id=HS)
    d = getattr(r, 'data', r)
    if isinstance(d, str):
        d = json.loads(d)
    return d

DELTA_DIAS = {'MINUTES': 1.0 / 1440, 'HOURS': 1.0 / 24, 'DAYS': 1}

todas = []
for wid, wname in WORKFLOWS.items():
    r = proxy('/automation/v4/flows/%s' % wid)
    acciones = r.get('actions', [])
    print('%s (%s): %d acciones' % (wid, wname, len(acciones)))
    tipos = set(a.get('actionTypeId') for a in acciones)
    print('   tipos:', tipos)
    dia = 0.0
    orden = 0
    for a in acciones:
        t = a.get('actionTypeId')
        f = a.get('fields') or {}
        if t == '0-1':
            delta = f.get('delta') or 0
            unidad = f.get('time_unit') or 'DAYS'
            dia += float(delta) * DELTA_DIAS.get(unidad, 1)
        elif t == '0-4':
            orden += 1
            todas.append({'workflow_id': wid, 'workflow': wname, 'orden': orden,
                           'canal': 'Email', 'dia': round(dia, 1),
                           'ref': str(f.get('content_id') or '')})
        elif t == '0-230189361':
            orden += 1
            todas.append({'workflow_id': wid, 'workflow': wname, 'orden': orden,
                           'canal': 'WhatsApp', 'dia': round(dia, 1),
                           'ref': str(f.get('rootMicId') or '')})

json.dump(todas, io.open('lt_piezas_raw.json', 'w', encoding='utf8'), ensure_ascii=False, indent=1)
print()
print('total piezas encontradas:', len(todas))
