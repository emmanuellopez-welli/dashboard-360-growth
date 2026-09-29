# -*- coding: utf-8 -*-
"""Busca en el esquema del objeto Sedes cualquier propiedad que pueda
significar "deshabilitada". No adivino el nombre: leo el catalogo."""
import lib, json, re
HS = 'ca_13P0RgH6oZrv'

def proxy(ep):
    r = lib.C.tools.proxy(endpoint=ep, method='GET', connected_account_id=HS)
    d = getattr(r, 'data', r)
    if isinstance(d, str):
        d = json.loads(d)
    return d

d = proxy('/crm/v3/properties/2-50958246')
props = d.get('results') or []
print('%d propiedades en el objeto Sedes' % len(props))
pat = re.compile(r'habilit|deshab|estado|activ|inactiv|enabled|disabled|baja|cerrad|bloque|suspend|vigen|status',
                 re.I)
for p in props:
    n, lab, t = p.get('name',''), p.get('label',''), p.get('type','')
    if pat.search(n) or pat.search(lab):
        ops = [o.get('label') for o in (p.get('options') or [])][:12]
        print('  %-42s %-34s %-10s %s' % (n, lab[:34], t, ops))
