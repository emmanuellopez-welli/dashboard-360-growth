# -*- coding: utf-8 -*-
"""Busca la propiedad de SALIDA del pipeline de Customer Success en el
   objeto Sedes (2-50958246). El usuario la llama "fecha salida pipeline CS";
   hay que encontrar el nombre interno real antes de usarla."""
import json, re
import lib

HS = 'ca_13P0RgH6oZrv'


def proxy(endpoint, method='GET', params=None, body=None):
    args = {'endpoint': endpoint, 'method': method,
            'connected_account_id': HS}
    if params:
        args['parameters'] = [{'name': k, 'value': str(v), 'in': 'query'}
                              for k, v in params.items()]
    if body:
        args['body'] = body
    r = lib.C.tools.proxy(**args)
    # ToolProxyResponse es un modelo pydantic, no un dict.
    return getattr(r, 'data', None) or (r.model_dump() if hasattr(r, 'model_dump') else r)


d = proxy('/crm/v3/properties/2-50958246')
while isinstance(d, dict) and 'results' not in d and 'data' in d:
    d = d['data']
props = d['results'] if isinstance(d, dict) else d
print('%d propiedades en el objeto Sedes' % len(props))

PAT = re.compile(r'salida|exit|egres|cs|customer|farmer|pipeline', re.I)
hits = []
for p in props:
    n, l = p.get('name', ''), p.get('label', '') or ''
    if PAT.search(n) or PAT.search(l):
        hits.append((n, l, p.get('type'), p.get('fieldType')))
print('\n%-46s %-46s %s' % ('nombre interno', 'etiqueta', 'tipo'))
for n, l, t, f in sorted(hits):
    print('%-46s %-46s %s/%s' % (n[:45], l[:45], t, f))

# Y las de fecha, que es lo que buscamos
print('\n--- solo las de tipo fecha con "sal" o "cs" ---')
for p in props:
    n, l = p.get('name', ''), p.get('label', '') or ''
    if p.get('type') not in ('date', 'datetime'):
        continue
    if re.search(r'salida|cs|farmer', n + ' ' + l, re.I):
        print('%-46s %-46s %s' % (n[:45], l[:45], p.get('type')))
