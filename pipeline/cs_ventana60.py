# -*- coding: utf-8 -*-
"""
El traspaso, medido bien.

Dos correcciones a lo que calcule antes:
  1. Customer Success arranco alrededor de feb-mar 2026. Las cosechas
     anteriores nunca tuvieron CS, asi que meterlas en "solo el 34,4% se
     traspasa dentro de M2" ensucia el numero: no es que CS se demorara,
     es que CS no existia.
  2. La regla real no es "M0 a M2" sino una ventana de 60 DIAS desde que la
     sede entra a CS. Medirlo en meses de calendario introduce hasta 30 dias
     de error por sede.

Se mide entonces: cuando arranco CS de verdad, y de las sedes que SI
pasaron por CS, cuantas salieron dentro de los 60 dias.
"""
import io
import json
import datetime
import collections

HOY = datetime.date(2026, 9, 4)
H = json.load(io.open('sheet_data.json', encoding='utf8'))
S = H['SEDES']
sx = {c: i for i, c in enumerate(S[0])}
P = H['PLATAFORMA_SEDES']
px = {c: i for i, c in enumerate(P[0])}
vinc = {str(r[px['id_sede']]).strip(): str(r[px['created']] or '')[:10]
        for r in P[1:]}


def d(s):
    try:
        return datetime.date(*map(int, str(s)[:10].split('-')))
    except Exception:
        return None


filas = []
for r in S[1:]:
    u = str(r[sx['id_internal']] or '').strip()
    filas.append({
        'u': u, 'nombre': str(r[sx['nombre_sede']] or ''),
        'vinc': d(vinc.get(u)),
        'cs': d(r[sx['cs_fecha_entrada']]),
        'fa': d(r[sx['fecha_entrada_farmer']]),
        'desh': 'deshabilitad' in str(r[sx['pipeline']] or '').lower(),
    })

# --- 1. cuando arranco CS de verdad --------------------------------------
print('CUANDO ARRANCO CUSTOMER SUCCESS · sedes que entraron a CS por mes')
c = collections.Counter(x['cs'].strftime('%Y-%m') for x in filas if x['cs'])
acum = 0
for m in sorted(c):
    acum += c[m]
    print('   %s  %4d sedes   acumulado %5d' % (m, c[m], acum))

# --- 2. la ventana de 60 dias, solo sobre quien paso por CS --------------
print('\nLA VENTANA DE 60 DIAS · solo sedes que SI entraron a CS')
print('%-10s %7s %9s %10s %10s %9s %9s'
      % ('cosecha', 'sedes', 'con CS', 'ya salio', 'en <=60d', '% de las',
         'aun en CS'))
print('%-10s %7s %9s %10s %10s %9s %9s'
      % ('', '', '', 'de CS', '', 'que salio', ''))
por = collections.defaultdict(lambda: {'n': 0, 'cs': 0, 'salio': 0,
                                       'en60': 0, 'abierto': 0, 'dias': []})
for x in filas:
    if x['desh'] or not x['vinc']:
        continue
    m = x['vinc'].strftime('%Y-%m')
    if m < '2026-01' or m > '2026-07':
        continue
    b = por[m]
    b['n'] += 1
    if not x['cs']:
        continue
    b['cs'] += 1
    if x['fa'] and x['fa'] >= x['cs']:
        dd = (x['fa'] - x['cs']).days
        b['salio'] += 1
        b['dias'].append(dd)
        if dd <= 60:
            b['en60'] += 1
    else:
        b['abierto'] += 1

tot = {'cs': 0, 'salio': 0, 'en60': 0, 'abierto': 0, 'dias': []}
for m in sorted(por):
    b = por[m]
    for k in ('cs', 'salio', 'en60', 'abierto'):
        tot[k] += b[k]
    tot['dias'] += b['dias']
    pct = (100.0 * b['en60'] / b['salio']) if b['salio'] else 0
    print('%-10s %7d %9d %10d %10d %8.0f%% %9d'
          % (m, b['n'], b['cs'], b['salio'], b['en60'], pct, b['abierto']))
pct = (100.0 * tot['en60'] / tot['salio']) if tot['salio'] else 0
print('%-10s %7s %9d %10d %10d %8.0f%% %9d'
      % ('TOTAL', '', tot['cs'], tot['salio'], tot['en60'], pct,
         tot['abierto']))

if tot['dias']:
    ds = sorted(tot['dias'])
    print('\nDias en CS de las que ya salieron (n=%d):' % len(ds))
    print('   mediana %d · promedio %.0f · p75 %d · p90 %d · max %d'
          % (ds[len(ds) // 2], sum(ds) / len(ds), ds[int(len(ds) * .75)],
             ds[int(len(ds) * .90)], ds[-1]))
    print('   dentro de 60d: %.0f%%   ·   dentro de 90d: %.0f%%'
          % (100.0 * sum(1 for v in ds if v <= 60) / len(ds),
             100.0 * sum(1 for v in ds if v <= 90) / len(ds)))

# --- 3. el numero que le di antes, corregido ----------------------------
print('\nEL NUMERO CORREGIDO')
print('   Antes dije: "solo el 34,4% de los traspasos ocurre dentro de M2".')
print('   Ese conteo incluia cosechas sin CS y medía meses, no dias.')
print('   Sobre las sedes que SI pasaron por CS y ya salieron: %.0f%% salio'
      % pct)
print('   dentro de los 60 dias de diseño.')
