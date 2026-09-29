# -*- coding: utf-8 -*-
"""Los 365 deals de EVENTO en julio-2026 son 10x el volumen normal de ese
origen. Antes de presentarlos hay que saber si son reales o una carga
masiva mal atribuida: se miran las fechas de creacion dia por dia."""
import collections
import datetime
import json

import lib

HS = 'ca_13P0RgH6oZrv'
PROPS = ['createdate', 'origen', 'hubspot_owner_id', 'pipeline', 'dealname',
         'hs_is_closed_won']


def fechaBogota(iso):
    if not iso or len(iso) < 19:
        return str(iso or '')[:10]
    dt = datetime.datetime.strptime(iso[:19], '%Y-%m-%dT%H:%M:%S')
    return (dt - datetime.timedelta(hours=5)).strftime('%Y-%m-%d')


def proxy(ep):
    r = lib.C.tools.proxy(endpoint=ep, method='GET', connected_account_id=HS)
    d = getattr(r, 'data', r)
    if isinstance(d, str):
        d = json.loads(d)
    if isinstance(d, dict) and d.get('status') == 'error':
        raise RuntimeError('HubSpot: ' + str(d.get('message'))[:200])
    return d


base = '/crm/v3/objects/deals?limit=100&properties=' + ','.join(PROPS)
after, deals, pag = None, [], 0
while True:
    ep = base + ('&after=' + after if after else '')
    d = proxy(ep)
    deals.extend(d.get('results') or [])
    pag += 1
    after = ((d.get('paging') or {}).get('next') or {}).get('after')
    if not after:
        break
print('%d deals leidos en %d paginas' % (len(deals), pag))

porDia = collections.Counter()
porDiaOwner = collections.defaultdict(collections.Counter)
nombres = collections.defaultdict(list)
for x in deals:
    pr = x.get('properties') or {}
    o = (pr.get('origen') or '').strip().upper()
    if o != 'EVENTO':
        continue
    f = fechaBogota(pr.get('createdate'))
    if not f.startswith('2026-07'):
        continue
    porDia[f] += 1
    porDiaOwner[f][str(pr.get('hubspot_owner_id') or '')] += 1
    if len(nombres[f]) < 3:
        nombres[f].append(pr.get('dealname') or '')

print('\nEVENTO creados en julio-2026, por dia:')
for f in sorted(porDia):
    dueños = len(porDiaOwner[f])
    print('  %s  %4d deals  · %d dueños distintos  · ej: %s'
          % (f, porDia[f], dueños, ' | '.join(str(n)[:34] for n in nombres[f])))
print('\ntotal julio EVENTO:', sum(porDia.values()))
