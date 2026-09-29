# -*- coding: utf-8 -*-
"""
Que cambia si la cosecha se define por la fecha de la PLATAFORMA
(institucion_medica.created, lo que BI llama fecha_vinculacion) en vez de por
hs_createdate de HubSpot.

Los dos campos miden eventos distintos:
  hs_createdate            cuando se creo la ficha en el CRM
  plataforma.created       cuando la sede quedo vinculada y pudo operar

Para un mapa de cohortes manda el segundo: una sede no puede radicar una
solicitud antes de tener cuenta. Con hs_createdate, M0 puede caer meses antes
o despues de que la sede existiera de verdad.
"""
import io
import json
import collections

H = json.load(io.open('sheet_data.json', encoding='utf8'))
S = H['SEDES']
sx = {c: i for i, c in enumerate(S[0])}
P = H['PLATAFORMA_SEDES']
px = {c: i for i, c in enumerate(P[0])}
A = H['ACT_SEDE_MES']
ax = {c: i for i, c in enumerate(A[0])}

plat = {}
for r in P[1:]:
    k = str(r[px['id_sede']]).strip()
    if k:
        plat[k] = {'pais': str(r[px['pais']] or 'COL'),
                   'creado': str(r[px['created']] or '')[:7]}

act = collections.defaultdict(dict)
for r in A[1:]:
    k = str(r[ax['id_sede']]).strip()
    m = str(r[ax['mes']] or '')[:7]
    if k and len(m) == 7:
        act[k][m] = {'sol': float(r[ax['solicitudes']] or 0),
                     'des': float(r[ax['desembolsos']] or 0),
                     'monto': float(r[ax['monto']] or 0)}

def offs(a, b):
    return (int(b[:4]) * 12 + int(b[5:7])) - (int(a[:4]) * 12 + int(a[5:7]))

# Universo: mismas reglas que el Excel, salvo la definicion de cosecha.
filas = []
for r in S[1:]:
    if 'deshabilitad' in str(r[sx['pipeline']] or '').lower():
        continue
    iid = str(r[sx['id_internal']] or '').strip()
    if not iid or iid not in plat or plat[iid]['pais'] != 'COL':
        continue
    filas.append({'iid': iid, 'nombre': str(r[sx['nombre_sede']] or ''),
                  'hs': str(r[sx['cosecha']] or '')[:7],
                  'pl': plat[iid]['creado']})

def conteo(clave):
    c = collections.Counter()
    for f in filas:
        m = f[clave]
        if len(m) == 7 and m >= '2026-01':
            c[m] += 1
    return c

ch, cp = conteo('hs'), conteo('pl')
meses = sorted(set(list(ch) + list(cp)))
print('SEDES POR COSECHA 2026 · dos definiciones')
print('   %-10s %10s %10s %9s' % ('cosecha', 'HubSpot', 'plataforma', 'delta'))
for m in meses:
    a, b = ch.get(m, 0), cp.get(m, 0)
    print('   %-10s %10d %10d %+9d' % (m, a, b, b - a))
print('   %-10s %10d %10d %+9d'
      % ('TOTAL', sum(ch.values()), sum(cp.values()),
         sum(cp.values()) - sum(ch.values())))

# Cuantas cambian de cosecha
mov = collections.Counter()
for f in filas:
    if len(f['hs']) != 7 or len(f['pl']) != 7:
        mov['sin una de las dos fechas'] += 1
    elif f['hs'] == f['pl']:
        mov['misma cosecha'] += 1
    else:
        mov['cambian de cosecha'] += 1
print('\nDE LAS %d SEDES DEL UNIVERSO' % len(filas))
for k, n in mov.most_common():
    print('   %5d  %s' % (n, k))

# El test que decide: actividad ANTES de la cosecha. Si la fecha de
# plataforma es la correcta, casi no deberia existir.
def antes(clave):
    n = pre = 0
    for f in filas:
        m = f[clave]
        if len(m) != 7 or m < '2026-01':
            continue
        n += 1
        if any(offs(m, k) < 0 and v['sol'] > 0
               for k, v in act.get(f['iid'], {}).items()):
            pre += 1
    return n, pre

print('\nEL TEST QUE DECIDE: sedes con solicitudes ANTES de su propia cosecha')
print('(una sede no puede radicar antes de existir, asi que el numero bajo gana)')
for etq, clave in (('HubSpot (hs_createdate)', 'hs'),
                   ('plataforma (fecha_vinculacion)', 'pl')):
    n, pre = antes(clave)
    print('   %-32s %4d de %4d  = %.1f%%' % (etq, pre, n, 100.0 * pre / max(1, n)))
