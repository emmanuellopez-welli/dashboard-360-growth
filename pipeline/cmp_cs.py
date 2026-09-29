# -*- coding: utf-8 -*-
"""Cuatro propiedades dicen casi lo mismo sobre la salida de CS. Antes de
   cablear una hay que ver cual esta llena y si concuerdan: elegir la que
   suena bien y esta vacia rompe el mapa en silencio."""
import json, collections
import lib

HS = 'ca_13P0RgH6oZrv'
CAMPOS = ['fecha_salida_pipeline_cs', 'fecha_salida_cs',
          'fecha_entrada_farmer', 'fecha_graduacion_farmer',
          'cs_fecha_entrada', 'pipeline', 'nombre_sede', 'id_internal']


def buscar():
    out, after = [], None
    while True:
        body = {'limit': 200, 'properties': CAMPOS,
                'filterGroups': [{'filters': [
                    {'propertyName': 'hs_object_id', 'operator': 'GTE',
                     'value': '0'}]}]}
        if after:
            body['after'] = after
        r = lib.C.tools.proxy(endpoint='/crm/v3/objects/2-50958246/search',
                              method='POST', connected_account_id=HS,
                              body=body)
        d = getattr(r, 'data', None) or r.model_dump()
        while isinstance(d, dict) and 'results' not in d and 'data' in d:
            d = d['data']
        out.extend(d.get('results', []))
        after = ((d.get('paging') or {}).get('next') or {}).get('after')
        if not after:
            break
    return out


filas = buscar()
print('%d sedes' % len(filas))
llenos = collections.Counter()
for x in filas:
    p = x.get('properties') or {}
    for c in CAMPOS[:5]:
        if str(p.get(c) or '').strip():
            llenos[c] += 1
print('\n%-30s %7s %7s' % ('propiedad', 'llenas', '%'))
for c in CAMPOS[:5]:
    print('%-30s %7d %6.1f%%' % (c, llenos[c], 100*llenos[c]/len(filas)))

# concuerdan entre si?
def d10(v): return str(v or '')[:10]
pares = [('fecha_salida_pipeline_cs', 'fecha_salida_cs'),
         ('fecha_salida_pipeline_cs', 'fecha_entrada_farmer'),
         ('fecha_salida_pipeline_cs', 'fecha_graduacion_farmer'),
         ('fecha_salida_cs', 'fecha_entrada_farmer')]
print('\nconcordancia sobre las sedes donde AMBAS estan llenas:')
for a, b in pares:
    n = ig = mes = dif = 0
    for x in filas:
        p = x.get('properties') or {}
        va, vb = d10(p.get(a)), d10(p.get(b))
        if len(va) != 10 or len(vb) != 10:
            continue
        n += 1
        if va == vb: ig += 1
        elif va[:7] == vb[:7]: mes += 1
        else: dif += 1
    print('  %-28s vs %-26s n=%4d  iguales %4d (%5.1f%%)  mismo mes %3d  distinto MES %4d'
          % (a, b, n, ig, 100*ig/max(1, n), mes, dif))

# y de las que estan en CS hoy, cuantas tienen salida (no deberian)
enCS = [x for x in filas
        if 'customer success' in str((x.get('properties') or {}).get('pipeline') or '').lower()]
print('\nsedes con pipeline de Customer Success hoy: %d' % len(enCS))
for c in ['fecha_salida_pipeline_cs', 'fecha_salida_cs', 'fecha_entrada_farmer']:
    k = sum(1 for x in enCS if str((x.get('properties') or {}).get(c) or '').strip())
    print('   con %-28s %d' % (c, k))

json.dump([{k: (x.get('properties') or {}).get(k) for k in CAMPOS}
           for x in filas], open('cs_props.json', 'w'), ensure_ascii=False)
print('\nguardado cs_props.json')
