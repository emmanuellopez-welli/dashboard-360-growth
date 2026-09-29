# -*- coding: utf-8 -*-
"""Paso 5: telefono de cada sede tocada por Long Tail (para poder cruzar
contra eventos_hilos), via propiedades numero_de_telefono/whatsapp del
objeto Sedes de HubSpot."""
import lib, json, io, sys, re

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
HS = 'ca_13P0RgH6oZrv'

def proxy(ep, method='GET', body=None):
    r = lib.C.tools.proxy(endpoint=ep, method=method, body=body, connected_account_id=HS)
    d = getattr(r, 'data', r)
    if isinstance(d, str):
        d = json.loads(d)
    return d

d = json.load(io.open('sheet_data.json', encoding='utf8'))
hS = d['SEDES'][0]
iId = hS.index('id'); iInt = hS.index('id_internal')
hsDe = {r[iInt]: r[iId] for r in d['SEDES'][1:] if r[iInt] and r[iId]}

hT = d['LT_TOUCHES'][0]
iSede = hT.index('id_sede')
tocadas = sorted(set(r[iSede] for r in d['LT_TOUCHES'][1:] if r[iSede]))
print('sedes tocadas:', len(tocadas))

hsIds = [hsDe[iid] for iid in tocadas if iid in hsDe]
print('con id de HubSpot:', len(hsIds))

def norm(t):
    return re.sub(r'\D', '', str(t or ''))[-10:]

telDe = {}
for i in range(0, len(hsIds), 100):
    lote = hsIds[i:i + 100]
    r = proxy('/crm/v3/objects/2-50958246/batch/read', 'POST',
               {'properties': ['numero_de_telefono', 'whatsapp'],
                'inputs': [{'id': x} for x in lote]})
    for res in (r.get('results') or []):
        hid = str(res.get('id'))
        p = res.get('properties') or {}
        t = norm(p.get('numero_de_telefono')) or norm(p.get('whatsapp'))
        if t:
            telDe[hid] = t

print('con telefono:', len(telDe))
idInternalDeHs = {v: k for k, v in hsDe.items()}
telPorSede = {idInternalDeHs[hid]: t for hid, t in telDe.items() if hid in idInternalDeHs}
json.dump(telPorSede, io.open('lt_tel_sedes.json', 'w', encoding='utf8'), ensure_ascii=False)
print('escrito lt_tel_sedes.json (id_internal -> telefono)')
