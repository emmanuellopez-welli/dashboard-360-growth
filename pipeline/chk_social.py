# -*- coding: utf-8 -*-
"""Comparacion puntual: leads de Meta (198) contra deals de Social media en
HubSpot (181) para septiembre-2026. Pregunta de Emmanuel el 28-sep-2026."""
import collections
import datetime
import json

import lib

HS = 'ca_13P0RgH6oZrv'
PROPS = ['createdate', 'origen', 'hs_analytics_source',
         'hs_analytics_source_data_1', 'hs_analytics_source_data_2']


def proxy(ep):
    r = lib.C.tools.proxy(endpoint=ep, method='GET', connected_account_id=HS)
    d = getattr(r, 'data', r)
    if isinstance(d, str):
        d = json.loads(d)
    return d


def fbog(iso):
    if not iso:
        return ''
    d = datetime.datetime.strptime(iso[:19], '%Y-%m-%dT%H:%M:%S') - datetime.timedelta(hours=5)
    return d.strftime('%Y-%m-%d')


base = '/crm/v3/objects/deals?limit=100&properties=' + ','.join(PROPS)
desp, deals, pag = None, [], 0
while True:
    d = proxy(base + ('&after=' + desp if desp else ''))
    deals.extend(d.get('results') or [])
    pag += 1
    desp = (((d.get('paging') or {}).get('next') or {}).get('after'))
    if not desp:
        break
print('deals bajados: %d en %d paginas' % (len(deals), pag))

sep = []
for x in deals:
    p = x.get('properties') or {}
    f = fbog(p.get('createdate'))
    if f.startswith('2026-09'):
        sep.append((f, p))
print('creados en sep-2026: %d' % len(sep))

porOrigen = collections.Counter()
srcSocial = collections.Counter()
socialFuera = collections.Counter()
for f, p in sep:
    o = (p.get('origen') or '(vacio)').strip()
    porOrigen[o] += 1
    s = (p.get('hs_analytics_source') or '(sin source)')
    d1 = (p.get('hs_analytics_source_data_1') or '')
    if o.upper() == 'SOCIAL MEDIA':
        srcSocial[s] += 1
    elif 'facebook' in (s + d1).lower() or 'paid_social' in s.lower():
        socialFuera[(o, s, d1[:30])] += 1

print()
print('--- deals de sep por origen ---')
for o, n in porOrigen.most_common(12):
    print('  %-24s %d' % (o[:24], n))

print()
print('--- source de los deals de SOCIAL MEDIA ---')
for s, n in srcSocial.most_common():
    print('  %-32s %d' % (s[:32], n))

print()
print('--- deals que huelen a Facebook pero NO estan en Social media ---')
if socialFuera:
    for (o, s, d1), n in socialFuera.most_common():
        print('  origen=%-16s source=%-16s %-30s %d' % (o[:16], s[:16], d1, n))
else:
    print('  ninguno')
