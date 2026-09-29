# -*- coding: utf-8 -*-
"""Cruce de las dos definiciones de 'deshabilitada' y el peso que tienen
en el tablero: cosechas 2026, origen y plata."""
import json, io, collections
sedes = json.load(io.open('sedes_deshab.json', encoding='utf8'))
DES_STAGE = '1327734139'

def n(v):
    try: return float(v)
    except Exception: return 0.0

A, B = set(), set()          # A = etapa Deshabilitado ; B = fb_deshabilitado
for x in sedes:
    p = x.get('properties') or {}
    if p.get('hs_pipeline_stage') == DES_STAGE: A.add(x['id'])
    if str(p.get('fb_deshabilitado')).lower() == 'true': B.add(x['id'])

print('etapa Deshabilitado : %d' % len(A))
print('fb_deshabilitado    : %d' % len(B))
print('en ambas            : %d' % len(A & B))
print('solo etapa          : %d' % len(A - B))
print('solo fb             : %d' % len(B - A))
print('union               : %d' % len(A | B))

U = A | B
print('\nDe la union, por cosecha (mes de hs_createdate):')
c = collections.Counter()
ori = collections.Counter()
plata = 0.0
apps = 0
for x in sedes:
    if x['id'] not in U: continue
    p = x.get('properties') or {}
    c[str(p.get('hs_createdate') or '')[:7]] += 1
    ori[(p.get('origen') or '(sin origen)').upper()] += 1
    plata += n(p.get('monto_total_desembolsado'))
    apps += int(n(p.get('aplicaciones')))
for k in sorted(c):
    if k >= '2025-12': print('   %s  %d' % (k, c[k]))
print('   2026 total: %d' % sum(v for k, v in c.items() if k[:4] == '2026'))
print('\nPor origen (union):')
for k, v in ori.most_common(14): print('   %5d  %s' % (v, k))
print('\nHistorico de las deshabilitadas: %d apps, $%s desembolsados'
      % (apps, format(int(plata), ',d').replace(',', '.')))

# Las 'A revisar / Deshabilitar' son otra cosa: aun no lo estan.
rev = [x for x in sedes
       if (x.get('properties') or {}).get('hs_pipeline_stage') == '1218096404']
print('\n(solo referencia) sedes en "A revisar / Deshabilitar": %d' % len(rev))
