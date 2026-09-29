# -*- coding: utf-8 -*-
"""Donde esta marcado CreditUp. La hipotesis a descartar: que origen=CREDITOP
   en la SEDE sea el canal por el que llego la clinica (11 clinicas) y no el
   canal por el que entro cada SOLICITUD (que es lo que el negocio quiere
   excluir del rescate)."""
import json, re
import lib

HS = 'ca_13P0RgH6oZrv'


def props(obj):
    r = lib.C.tools.proxy(endpoint='/crm/v3/properties/' + obj, method='GET',
                          connected_account_id=HS)
    d = getattr(r, 'data', None) or r.model_dump()
    while isinstance(d, dict) and 'results' not in d and 'data' in d:
        d = d['data']
    return d.get('results', []) if isinstance(d, dict) else []


PAT = re.compile(r'credit\s*_?(op|up)|canal|fuente|source|convenio|agregador|'
                 r'tablet|marketplace|competen', re.I)

for obj, nombre in [('2-50958246', 'Sedes'), ('deals', 'Deals'),
                    ('contacts', 'Contactos')]:
    try:
        P = props(obj)
    except Exception as e:
        print('%s: no se pudo leer (%s)' % (nombre, str(e)[:80]))
        continue
    print('\n=== %s · %d propiedades ===' % (nombre, len(P)))
    for p in P:
        n, l = p.get('name', ''), p.get('label') or ''
        if PAT.search(n + ' ' + l):
            print('   %-42s %-40s %s' % (n[:41], l[:39], p.get('type')))
            # si es enumeracion, ver si CREDITOP esta entre las opciones
            ops = p.get('options') or []
            hits = [o.get('label') or o.get('value') for o in ops
                    if re.search(r'credit\s*_?(op|up)', str(o), re.I)]
            if hits:
                print('        OPCIONES CON CREDITUP: %s' % hits)

# Y las opciones completas de la propiedad de origen de la sede
for p in props('2-50958246'):
    if p.get('name') in ('origen', 'fuente_de_origen', 'origen_sede'):
        print('\n=== opciones de %s ===' % p['name'])
        for o in (p.get('options') or []):
            print('   %-34s %s' % (o.get('label'), o.get('value')))
