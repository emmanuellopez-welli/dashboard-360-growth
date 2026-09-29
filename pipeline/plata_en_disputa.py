# -*- coding: utf-8 -*-
"""
Cuanta plata cambia de equipo segun el reloj que se use.

La regla operativa hoy: M0, M1 y M2 son de Growth/Customer Success; del M3 en
adelante es de Farmer. Pero M0 depende de la fecha de cosecha, y los dos
equipos usan una distinta. Esto mide el tamano real del desacuerdo en pesos.

Tres escenarios:
  A  cosecha = hs_createdate            (el reloj de Growth)
  B  cosecha = plataforma.created       (el reloj de BI / fecha_vinculacion)
  C  corte por el TRASPASO real de cada sede (fecha_entrada_farmer),
     que es lo que propongo: no depende de ningun reloj compartido
"""
import io
import json
import collections
import datetime

H = json.load(io.open('sheet_data.json', encoding='utf8'))
S = H['SEDES']; sx = {c: i for i, c in enumerate(S[0])}
P = H['PLATAFORMA_SEDES']; px = {c: i for i, c in enumerate(P[0])}
A = H['ACT_SEDE_MES']; ax = {c: i for i, c in enumerate(A[0])}

plat = {}
for r in P[1:]:
    k = str(r[px['id_sede']]).strip()
    if k:
        plat[k] = {'pais': str(r[px['pais']] or 'COL'),
                   'creado': str(r[px['created']] or '')[:10]}

# El traspaso real, en vivo de HubSpot
tras = {}
for x in json.load(io.open('sedes_traspaso.json', encoding='utf8')):
    p = x.get('properties') or {}
    u = str(p.get('id_internal') or '').strip()
    if u:
        tras[u] = str(p.get('fecha_entrada_farmer') or '')[:10]

act = collections.defaultdict(dict)
for r in A[1:]:
    k = str(r[ax['id_sede']]).strip()
    m = str(r[ax['mes']] or '')[:7]
    if k and len(m) == 7:
        act[k][m] = float(r[ax['monto']] or 0)


def mes(s):
    return s[:7] if len(s) >= 7 else ''


def offs(a, b):
    return (int(b[:4]) * 12 + int(b[5:7])) - (int(a[:4]) * 12 + int(a[5:7]))


sedes = []
for r in S[1:]:
    if 'deshabilitad' in str(r[sx['pipeline']] or '').lower():
        continue
    u = str(r[sx['id_internal']] or '').strip()
    if not u or u not in plat or plat[u]['pais'] != 'COL':
        continue
    sedes.append({'u': u, 'nombre': str(r[sx['nombre_sede']] or ''),
                  'hs': mes(str(r[sx['cosecha']] or '')),
                  'pl': mes(plat[u]['creado']),
                  'tr': mes(tras.get(u, ''))})

f = lambda v: '$' + format(int(round(v / 1e6)), ',d').replace(',', '.') + ' M'


def reparto(clave):
    """Plata 2026 de cada equipo con la regla M0-M2 = CS, M3+ = Farmer."""
    cs = fa = sin = 0.0
    for s in sedes:
        c = s[clave]
        if len(c) != 7 or c < '2026-01':
            # Sedes de cosecha vieja: todo su 2026 cae en M3+ -> Farmer
            for m, v in act.get(s['u'], {}).items():
                if m >= '2026-01':
                    fa += v
            continue
        for m, v in act.get(s['u'], {}).items():
            if m < '2026-01':
                continue
            k = offs(c, m)
            if k < 0:
                sin += v
            elif k <= 2:
                cs += v
            else:
                fa += v
    return cs, fa, sin


def reparto_traspaso():
    """Corte por el traspaso real de cada sede."""
    cs = fa = sin = 0.0
    for s in sedes:
        t = s['tr']
        for m, v in act.get(s['u'], {}).items():
            if m < '2026-01':
                continue
            if len(t) != 7:
                sin += v
            elif m < t:
                cs += v
            else:
                fa += v
    return cs, fa, sin


print('PLATA DESEMBOLSADA 2026 · a quien se le atribuye')
print('   %-38s %14s %14s %14s' % ('escenario', 'Growth/CS', 'Farmer',
                                   'sin clasificar'))
a = reparto('hs')
b = reparto('pl')
c = reparto_traspaso()
print('   %-38s %14s %14s %14s'
      % ('A · reloj de Growth (hs_createdate)', f(a[0]), f(a[1]), f(a[2])))
print('   %-38s %14s %14s %14s'
      % ('B · reloj de BI (fecha_vinculacion)', f(b[0]), f(b[1]), f(b[2])))
print('   %-38s %14s %14s %14s'
      % ('C · traspaso real de cada sede', f(c[0]), f(c[1]), f(c[2])))
print()
print('   La disputa entre A y B vale %s para Growth/CS' % f(abs(a[0] - b[0])))
tot = a[0] + a[1] + a[2]
print('   sobre un total de %s, o sea el %.1f%% de la plata del ano'
      % (f(tot), 100.0 * abs(a[0] - b[0]) / tot))

# Cuantas sedes cambian de lado
lado = collections.Counter()
for s in sedes:
    for clave, etq in (('hs', 'A'), ('pl', 'B')):
        pass
    ha, hb = s['hs'], s['pl']
    if len(ha) == 7 and len(hb) == 7 and ha != hb:
        lado['cosecha distinta entre los dos relojes'] += 1
print('\n   %d sedes tienen cosecha distinta segun el reloj'
      % lado['cosecha distinta entre los dos relojes'])
print('   %d sedes tienen fecha de traspaso en HubSpot (%.0f%% del universo)'
      % (sum(1 for s in sedes if len(s['tr']) == 7),
         100.0 * sum(1 for s in sedes if len(s['tr']) == 7) / len(sedes)))
