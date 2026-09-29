# -*- coding: utf-8 -*-
"""
Prueba de la regla propuesta para fecha_final antes de construirla.

Regla: fecha_final = la mas TEMPRANA entre hs_createdate y fecha_vinculacion.
El primer evento, sin importar que sistema lo vio primero.

Se prueban cuatro relojes con el mismo test que ya uso el negocio para
decidir: sedes con solicitudes registradas ANTES de su propia cosecha. Es
imposible — una sede no puede radicar antes de existir — asi que el reloj
con menos casos imposibles es el que describe mejor la realidad.

Ese test es el que hizo que adoptaramos la fecha de vinculacion (6,0% con
HubSpot contra 0,4% con vinculacion). Si MIN lo empeora, la regla estaria
cerrando la brecha con BI al precio de volver a romper la medicion.
"""
import io
import json
import datetime
import collections

H = json.load(io.open('sheet_data.json', encoding='utf8'))
S = H['SEDES']
sx = {c: i for i, c in enumerate(S[0])}
P = H['PLATAFORMA_SEDES']
px = {c: i for i, c in enumerate(P[0])}
A = H['ACT_SEDE_MES']
ax = {c: i for i, c in enumerate(A[0])}

plat = {str(r[px['id_sede']]).strip():
        {'pais': str(r[px['pais']] or 'COL'),
         'vinc': str(r[px['created']] or '')[:10]} for r in P[1:]}
crea = {}
for x in json.load(io.open('sedes_traspaso.json', encoding='utf8')):
    p = x.get('properties') or {}
    u = str(p.get('id_internal') or '').strip()
    if u:
        crea[u] = str(p.get('hs_createdate') or '')[:10]

act = collections.defaultdict(dict)
for r in A[1:]:
    u = str(r[ax['id_sede']]).strip()
    m = str(r[ax['mes']] or '')[:7]
    if u and len(m) == 7:
        act[u][m] = float(r[ax['solicitudes']] or 0)


def offs(a, b):
    return (int(b[:4]) * 12 + int(b[5:7])) - (int(a[:4]) * 12 + int(a[5:7]))


sedes = []
for r in S[1:]:
    if 'deshabilitad' in str(r[sx['pipeline']] or '').lower():
        continue
    u = str(r[sx['id_internal']] or '').strip()
    if not u or u not in plat or plat[u]['pais'] != 'COL':
        continue
    fc, fv = crea.get(u, ''), plat[u]['vinc']
    if len(fc) != 10 or len(fv) != 10:
        continue
    sedes.append({'u': u, 'nombre': str(r[sx['nombre_sede']] or ''),
                  'crm': fc, 'vinc': fv,
                  'min': min(fc, fv), 'max': max(fc, fv)})
print('%d sedes con las dos fechas' % len(sedes))

RELOJES = [('hs_createdate (el viejo)', 'crm'),
           ('fecha_vinculacion (el de BI)', 'vinc'),
           ('fecha_final = la MAS TEMPRANA', 'min'),
           ('la mas TARDIA (de referencia)', 'max')]

print('\nTEST · sedes con solicitudes ANTES de su propia cosecha (imposible)')
print('%-34s %8s %8s %8s' % ('reloj', 'cosechas', 'imposibles', '%'))
for etq, k in RELOJES:
    n = mal = 0
    for s in sedes:
        m = s[k][:7]
        if m < '2026-01':
            continue
        n += 1
        if any(offs(m, mm) < 0 and v > 0 for mm, v in act.get(s['u'], {}).items()):
            mal += 1
    print('%-34s %8d %8d %7.1f%%' % (etq, n, mal, 100.0 * mal / max(1, n)))

print('\nCOSECHAS 2026 bajo cada reloj')
print('%-10s %10s %10s %12s' % ('cosecha', 'HubSpot', 'vinculacion',
                                'fecha_final'))
cs = {k: collections.Counter() for _, k in RELOJES}
for s in sedes:
    for _, k in RELOJES:
        cs[k][s[k][:7]] += 1
meses = sorted({m for k in ('crm', 'vinc', 'min') for m in cs[k]
                if m >= '2026-01'})
tot = collections.Counter()
for m in meses:
    print('%-10s %10d %10d %12d'
          % (m, cs['crm'][m], cs['vinc'][m], cs['min'][m]))
    for k in ('crm', 'vinc', 'min'):
        tot[k] += cs[k][m]
print('%-10s %10d %10d %12d' % ('TOTAL 2026', tot['crm'], tot['vinc'],
                                tot['min']))

# Cuantas se irian a 2025 con la regla nueva
a2025 = [s for s in sedes if s['min'][:7] < '2026-01' and s['crm'][:7] >= '2026-01']
carga = collections.Counter(s['min'][:7] for s in a2025)
print('\nSedes que HOY estan en una cosecha 2026 y con fecha_final se irian a 2025: %d'
      % len(a2025))
for m in sorted(carga):
    print('   -> %s   %3d sedes%s' % (m, carga[m],
          '   OJO: es el mes de la carga inicial de HubSpot, que el tablero excluye'
          if m == '2025-10' else ''))
