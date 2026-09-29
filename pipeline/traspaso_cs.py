# -*- coding: utf-8 -*-
"""
La pelea Growth/CS contra Farmer no se resuelve eligiendo una fecha de
cosecha. Se resuelve con la fecha del TRASPASO, que es el evento que de
verdad divide la responsabilidad.

BI ya tiene fecha_entrega_cs (28,6% llena) y el corte antes/despues.
HubSpot tiene fecha_entrada_farmer y cs_fecha_entrada. Si esas dos fechas
concuerdan, el problema de atribucion se cierra sin que nadie ceda su fecha
de cosecha: cada sede se parte en SU propio traspaso.

Este script mide: cobertura de cada campo y si concuerdan.
"""
import io
import json
import collections

import lib

HS = 'ca_13P0RgH6oZrv'
PROPS = ['nombre_sede', 'id_internal', 'fecha_entrada_farmer',
         'cs_fecha_entrada', 'fecha_capacitado', 'fecha_entrada_auto',
         'hs_createdate']


def proxy(ep, method='GET', body=None):
    kw = dict(endpoint=ep, method=method, connected_account_id=HS)
    if body is not None:
        kw['body'] = body
    r = lib.C.tools.proxy(**kw)
    d = getattr(r, 'data', r)
    if isinstance(d, str):
        d = json.loads(d)
    return d


body = {'filterGroups': [{'filters': [{'propertyName': 'hs_object_id',
                                       'operator': 'GTE', 'value': '0'}]}],
        'properties': PROPS, 'limit': 100}
after, sedes = None, []
while True:
    b = dict(body)
    if after:
        b['after'] = after
    d = proxy('/crm/v3/objects/2-50958246/search', 'POST', b)
    sedes.extend(d.get('results') or [])
    after = (((d.get('paging') or {}).get('next') or {}).get('after'))
    if not after:
        break
print('%d sedes leidas en vivo' % len(sedes))
json.dump(sedes, io.open('sedes_traspaso.json', 'w', encoding='utf8'),
          ensure_ascii=False)

por_uuid = {}
cob = collections.Counter()
for x in sedes:
    p = x.get('properties') or {}
    iid = str(p.get('id_internal') or '').strip()
    for c in ('fecha_entrada_farmer', 'cs_fecha_entrada', 'fecha_capacitado',
              'fecha_entrada_auto'):
        if p.get(c):
            cob[c] += 1
    if iid:
        por_uuid[iid] = p

print('\nCOBERTURA EN HUBSPOT (de %d sedes)' % len(sedes))
for c, n in cob.most_common():
    print('   %-24s %5d  (%.1f%%)' % (c, n, 100.0 * n / len(sedes)))

# --- contra la hoja de BI ------------------------------------------------
import openpyxl
XL = ('c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/'
      'Cosechas 2026 sedes tablero360 (2).xlsx')
wb = openpyxl.load_workbook(XL, data_only=True)
h = wb['Farmer']
cab = [c.value for c in h[1]]
ci = {c: i for i, c in enumerate(cab) if c}

comp = collections.Counter()
ej = []
for r in h.iter_rows(min_row=2, values_only=True):
    u = str(r[ci['id_clinica']] or '').strip()
    bi = str(r[ci['fecha_entrega_cs']] or '')[:10]
    if not u or u not in por_uuid:
        continue
    p = por_uuid[u]
    hsf = str(p.get('fecha_entrada_farmer') or '')[:10]
    if not bi and not hsf:
        comp['ninguna de las dos tiene fecha'] += 1
    elif bi and not hsf:
        comp['solo BI tiene fecha'] += 1
    elif hsf and not bi:
        comp['solo HubSpot tiene fecha'] += 1
    elif bi == hsf:
        comp['IGUALES'] += 1
    elif bi[:7] == hsf[:7]:
        comp['mismo mes, distinto dia'] += 1
    else:
        comp['distintas'] += 1
        if len(ej) < 10:
            ej.append((str(r[ci['nombre_comercial']])[:32], bi, hsf))

tot = sum(comp.values())
print('\nfecha_entrega_cs (BI) contra fecha_entrada_farmer (HubSpot), '
      '%d sedes cruzables' % tot)
for k, n in comp.most_common():
    print('   %5d  %5.1f%%  %s' % (n, 100.0 * n / tot, k))
if ej:
    print('\n   ejemplos distintos:')
    for n, a, b2 in ej:
        print('      %-32s BI %s | HubSpot %s' % (n, a, b2))
