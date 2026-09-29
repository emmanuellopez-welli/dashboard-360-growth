# -*- coding: utf-8 -*-
"""
Dos datos que definen el diseno de la alerta:

  1. Cobertura de las propiedades que dicen QUIEN creo la sede, y el mapa de
     user_id -> nombre (los user ids de HubSpot NO son los owner ids).
  2. Cuantos dias hay que esperar antes de alertar. Si se alerta el mismo
     dia, casi todo seria falso positivo: los dos sistemas no siempre
     estampan el mismo dia. El umbral sale de la distribucion real.
"""
import io
import json
import collections

import lib

HS = 'ca_13P0RgH6oZrv'
PROPS = ['nombre_sede', 'id_internal', 'hs_createdate',
         'hs_created_by_user_id', 'hs_object_source_user_id',
         'hs_object_source', 'hs_object_source_label', 'hubspot_owner_id']


def proxy(ep, method='GET', body=None):
    kw = dict(endpoint=ep, method=method, connected_account_id=HS)
    if body is not None:
        kw['body'] = body
    r = lib.C.tools.proxy(**kw)
    d = getattr(r, 'data', r)
    if isinstance(d, str):
        d = json.loads(d)
    return d


# --- 1. owners: id de owner y su userId -------------------------------
ow = proxy('/crm/v3/owners?limit=200')
por_user, por_owner = {}, {}
for o in ow.get('results') or []:
    nom = ((o.get('firstName') or '') + ' ' + (o.get('lastName') or '')).strip()
    nom = nom or o.get('email') or '?'
    if o.get('userId'):
        por_user[str(o['userId'])] = nom
    por_owner[str(o.get('id'))] = nom
print('owners: %d con userId, %d por owner id' % (len(por_user), len(por_owner)))

# --- 2. las sedes de 2026 con esas propiedades ------------------------
body = {'filterGroups': [{'filters': [
            {'propertyName': 'hs_object_id', 'operator': 'GTE', 'value': '0'}]}],
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
d26 = [x for x in sedes
       if str((x.get('properties') or {}).get('hs_createdate') or '')
       .startswith('2026')]
print('%d sedes en total · %d creadas en 2026' % (len(sedes), len(d26)))

print('\nCOBERTURA de las propiedades de creador (sobre las de 2026)')
for c in ('hs_created_by_user_id', 'hs_object_source_user_id',
          'hs_object_source_label', 'hubspot_owner_id'):
    n = sum(1 for x in d26 if (x.get('properties') or {}).get(c))
    print('   %-28s %4d de %d  (%.0f%%)' % (c, n, len(d26),
                                            100.0 * n / len(d26)))

print('\nQUE VALORES trae hs_created_by_user_id, resuelto a nombre')
c = collections.Counter()
for x in d26:
    p = x.get('properties') or {}
    uid = str(p.get('hs_created_by_user_id') or '')
    c[por_user.get(uid, '(user ' + uid + ' sin owner)' if uid else '(vacio)')] += 1
for k, v in c.most_common(12):
    print('   %4d  %s' % (v, k))

print('\nCOMO se creo (hs_object_source_label)')
for k, v in collections.Counter(
        str((x.get('properties') or {}).get('hs_object_source_label') or '(vacio)')
        for x in d26).most_common(8):
    print('   %4d  %s' % (v, k))

json.dump({'por_user': por_user, 'por_owner': por_owner},
          io.open('owners_user.json', 'w', encoding='utf8'), ensure_ascii=False)
json.dump([{'id': x['id'], **(x.get('properties') or {})} for x in sedes],
          io.open('sedes_creador.json', 'w', encoding='utf8'),
          ensure_ascii=False)
