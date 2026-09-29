# -*- coding: utf-8 -*-
"""El 24% de cobertura de fecha_salida_pipeline_cs no dice nada por si solo.
   Lo que decide es si el hueco esta en las sedes que NUNCA pasaron por CS
   (irrelevante) o en las que si (rompe el mapa)."""
import json, collections
import lib

HS = 'ca_13P0RgH6oZrv'
CAMPOS = ['fecha_salida_pipeline_cs', 'fecha_salida_cs',
          'fecha_entrada_farmer', 'cs_fecha_entrada', 'pipeline',
          'id_internal', 'hs_createdate']


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


F = buscar()
def g(x, k): return str((x.get('properties') or {}).get(k) or '').strip()
def d10(x, k): return g(x, k)[:10]

print('pipelines distintos:')
for p, n in collections.Counter(g(x, 'pipeline') for x in F).most_common(12):
    print('   %-46s %d' % (p[:45] or '(vacio)', n))

# El universo que importa: las que ENTRARON a CS alguna vez
enCS = [x for x in F if len(d10(x, 'cs_fecha_entrada')) == 10]
print('\nsedes que alguna vez entraron a CS: %d' % len(enCS))
for c in ['fecha_salida_pipeline_cs', 'fecha_salida_cs', 'fecha_entrada_farmer']:
    k = sum(1 for x in enCS if len(d10(x, c)) == 10)
    print('   con %-28s %4d  (%5.1f%%)' % (c, k, 100*k/len(enCS)))

# Y de las que NO entraron a CS, cuantas tienen salida (seria un dato sucio)
noCS = [x for x in F if len(d10(x, 'cs_fecha_entrada')) != 10]
print('\nsedes que NUNCA entraron a CS: %d' % len(noCS))
for c in ['fecha_salida_pipeline_cs', 'fecha_salida_cs', 'fecha_entrada_farmer']:
    k = sum(1 for x in noCS if len(d10(x, c)) == 10)
    print('   con %-28s %4d  (%5.1f%%)  <- salida sin entrada' % (c, k, 100*k/len(noCS)))

# Cobertura por mes de entrada a CS: la operacion arranco ~feb-2026
print('\nCOBERTURA POR MES DE ENTRADA A CS')
por = collections.defaultdict(lambda: collections.Counter())
for x in enCS:
    m = d10(x, 'cs_fecha_entrada')[:7]
    por[m]['n'] += 1
    for c in ['fecha_salida_pipeline_cs', 'fecha_salida_cs', 'fecha_entrada_farmer']:
        if len(d10(x, c)) == 10:
            por[m][c] += 1
print('%-9s %5s %14s %14s %14s' % ('mes CS', 'n', 'salida_pipe', 'salida_cs', 'entrada_farmer'))
for m in sorted(por):
    if m < '2025-01':
        continue
    b = por[m]
    print('%-9s %5d %8d %4.0f%% %8d %4.0f%% %8d %4.0f%%'
          % (m, b['n'],
             b['fecha_salida_pipeline_cs'], 100*b['fecha_salida_pipeline_cs']/b['n'],
             b['fecha_salida_cs'], 100*b['fecha_salida_cs']/b['n'],
             b['fecha_entrada_farmer'], 100*b['fecha_entrada_farmer']/b['n']))

# Coherencia: la salida tiene que ser DESPUES de la entrada
print('\nSALIDA ANTERIOR A LA ENTRADA (imposible):')
for c in ['fecha_salida_pipeline_cs', 'fecha_salida_cs', 'fecha_entrada_farmer']:
    n = mal = 0
    for x in enCS:
        e, s = d10(x, 'cs_fecha_entrada'), d10(x, c)
        if len(s) != 10: continue
        n += 1
        if s < e: mal += 1
    print('   %-28s %4d medidas · %3d imposibles (%4.1f%%)'
          % (c, n, mal, 100*mal/max(1, n)))
