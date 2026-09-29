# -*- coding: utf-8 -*-
"""Que propiedad de HubSpot dice QUIEN creo la sede, y con que cobertura."""
import lib, json, re, collections
HS = 'ca_13P0RgH6oZrv'

def proxy(ep, method='GET', body=None):
    kw = dict(endpoint=ep, method=method, connected_account_id=HS)
    if body is not None:
        kw['body'] = body
    r = lib.C.tools.proxy(**kw)
    d = getattr(r, 'data', r)
    if isinstance(d, str):
        d = json.loads(d)
    return d

d = proxy('/crm/v3/properties/2-50958246')
pat = re.compile(r'creat|owner|user|autor|asesor', re.I)
print('PROPIEDADES CANDIDATAS PARA "QUIEN CREO"')
for p in d.get('results') or []:
    n, lab = p.get('name', ''), p.get('label', '')
    if pat.search(n):
        print('   %-40s %-34s %s' % (n, lab[:34], p.get('type')))
