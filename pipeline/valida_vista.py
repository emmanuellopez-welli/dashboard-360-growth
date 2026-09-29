# -*- coding: utf-8 -*-
"""
Valida la vista welli-data.data_ops.v_datos_hubspot antes de usarla.

El campo que interesa es fecha_minima_admin_hubspot: debería ser la más
temprana entre la creación en HubSpot y la vinculación en la plataforma.

Cuatro pruebas, en orden. No sirve pasar a las cosechas si falla alguna:

  1. ESQUEMA Y COBERTURA. Cuántas filas, cuántas con el campo lleno, y
     cuál es la llave para cruzar.
  2. ¿ES DE VERDAD EL MÍNIMO? Se recalcula desde las dos fechas fuente y se
     compara fila por fila. Si difiere, hay que ver por qué antes de nada.
  3. CONTRA MI CÁLCULO. Sede por sede contra la fecha unificada que ya
     calcula el tablero. Cualquier diferencia es una definición distinta.
  4. EL TEST QUE DECIDE. Sedes con solicitudes ANTERIORES a su propia
     cosecha, que es imposible. Referencia: 6,0% con hs_createdate, 0,4%
     con vinculación, 0,4% con mi fecha unificada. Si la vista da más de
     ~1%, algo se corrió.

Y solo al final, las cosechas de 2026 con las cuatro definiciones.
"""
import io
import json
import collections

import rq

VISTA = '`welli-data.data_ops.v_datos_hubspot`'
LOC = 'us-central1'
PROY = 'welli-data'


def q(sql):
    return rq.q(sql, proy=PROY, loc=LOC)


def linea():
    print('\n' + '=' * 68)


# ---------------------------------------------------------------- 1
linea()
print('1 · ESQUEMA Y COBERTURA')
cols = q("""
SELECT column_name, data_type
FROM `welli-data.data_ops.INFORMATION_SCHEMA.COLUMNS`
WHERE table_name = 'v_datos_hubspot'
ORDER BY ordinal_position
""")
print('%d columnas:' % len(cols))
for c in cols:
    print('    %-42s %s' % (c['column_name'], c['data_type']))
nombres = {c['column_name'] for c in cols}

CAMPO = 'fecha_minima_admin_hubspot'
if CAMPO not in nombres:
    print('\nOJO: la vista no tiene %s. Nombres parecidos:' % CAMPO)
    for n in sorted(nombres):
        if 'fecha' in n.lower() or 'min' in n.lower():
            print('    ' + n)
    raise SystemExit(1)

# La llave de cruce: se busca entre los candidatos habituales.
LLAVES = ['id_internal', 'id_clinica', 'id_sede', 'hs_object_id',
          'id_hubspot', 'id']
llave = next((k for k in LLAVES if k in nombres), None)
print('\nllave de cruce detectada: %s' % (llave or 'NINGUNA de ' + str(LLAVES)))

r = q("""
SELECT COUNT(*) AS filas,
       COUNTIF(%s IS NOT NULL) AS con_fecha,
       CAST(MIN(DATE(%s)) AS STRING) AS desde,
       CAST(MAX(DATE(%s)) AS STRING) AS hasta
FROM %s
""" % (CAMPO, CAMPO, CAMPO, VISTA))[0]
print('filas %s · con %s: %s · rango %s a %s'
      % (r['filas'], CAMPO, r['con_fecha'], r['desde'], r['hasta']))

# ---------------------------------------------------------------- 2
linea()
print('2 · ¿ES DE VERDAD EL MINIMO DE LAS DOS FECHAS?')
# Se detectan las dos fechas fuente dentro de la propia vista, si están.
fa = [n for n in nombres if 'hubspot' in n.lower() and 'fecha' in n.lower()
      and n != CAMPO]
fb = [n for n in nombres if ('admin' in n.lower() or 'vincul' in n.lower()
                             or 'creat' in n.lower()) and n != CAMPO]
print('candidatas a fecha de HubSpot: %s' % (fa or '(ninguna en la vista)'))
print('candidatas a fecha del admin:  %s' % (fb or '(ninguna en la vista)'))
if fa and fb:
    a, b = fa[0], fb[0]
    r = q("""
    SELECT COUNT(*) AS n,
           COUNTIF(DATE(%s) = LEAST(DATE(%s), DATE(%s))) AS es_minimo,
           COUNTIF(DATE(%s) > LEAST(DATE(%s), DATE(%s))) AS mayor,
           COUNTIF(DATE(%s) < LEAST(DATE(%s), DATE(%s))) AS menor
    FROM %s
    WHERE %s IS NOT NULL AND %s IS NOT NULL AND %s IS NOT NULL
    """ % (CAMPO, a, b, CAMPO, a, b, CAMPO, a, b, VISTA, CAMPO, a, b))[0]
    n = int(r['n'])
    print('sobre %d filas con las tres fechas:' % n)
    print('   coincide con LEAST(%s, %s): %s (%.2f%%)'
          % (a, b, r['es_minimo'], 100.0 * int(r['es_minimo']) / max(1, n)))
    print('   la vista es MAYOR que el mínimo: %s' % r['mayor'])
    print('   la vista es MENOR que el mínimo: %s' % r['menor'])
else:
    print('(las fechas fuente no están en la vista: se valida contra las '
          'tablas originales en el paso 3)')

# ---------------------------------------------------------------- 3
linea()
print('3 · CONTRA MI CALCULO, SEDE POR SEDE')
H = json.load(io.open('sheet_data.json', encoding='utf8'))
S = H['SEDES']
sx = {c: i for i, c in enumerate(S[0])}
P = H['PLATAFORMA_SEDES']
px = {c: i for i, c in enumerate(P[0])}
plat = {str(x[px['id_sede']]).strip(): str(x[px['created']] or '')[:10]
        for x in P[1:]}
crea = {}
for x in json.load(io.open('sedes_traspaso.json', encoding='utf8')):
    p = x.get('properties') or {}
    u = str(p.get('id_internal') or '').strip()
    if u:
        crea[u] = str(p.get('hs_createdate') or '')[:10]
mio = {}
for u in set(list(plat) + list(crea)):
    fc, fv = crea.get(u, ''), plat.get(u, '')
    if len(fc) == 10 and len(fv) == 10:
        mio[u] = min(fc, fv)
    elif len(fc) == 10:
        mio[u] = fc
    elif len(fv) == 10:
        mio[u] = fv
print('mi fecha unificada calculada para %d sedes' % len(mio))

suyo = {}
for x in q('SELECT %s AS k, CAST(DATE(%s) AS STRING) AS f FROM %s'
           % (llave, CAMPO, VISTA)):
    k = str(x['k'] or '').strip()
    if k:
        suyo[k] = str(x['f'] or '')
print('la vista trae %d llaves' % len(suyo))

comunes = set(mio) & set(suyo)
print('llaves en común: %d' % len(comunes))
if not comunes:
    print('OJO: no cruzan. La llave de la vista (%s) no es el UUID de '
          'plataforma; hay que mapear.' % llave)
else:
    c = collections.Counter()
    ej = []
    for u in comunes:
        if suyo[u] == mio[u]:
            c['idénticas'] += 1
        elif suyo[u][:7] == mio[u][:7]:
            c['mismo mes, distinto día'] += 1
        else:
            c['distinto MES'] += 1
            if len(ej) < 10:
                ej.append((u, mio[u], suyo[u], crea.get(u, '-'),
                           plat.get(u, '-')))
    tot = sum(c.values())
    for k, v in c.most_common():
        print('   %6d  %5.1f%%  %s' % (v, 100.0 * v / tot, k))
    if ej:
        print('\n   ejemplos que cambian de mes (uuid · mía · suya · hs · admin):')
        for u, a, b, h, p2 in ej:
            print('      %s  %s  %s   hs=%s admin=%s' % (u[:8], a, b, h, p2))

# ---------------------------------------------------------------- 4
linea()
print('4 · EL TEST QUE DECIDE: solicitudes ANTES de la propia cosecha')
A = H['ACT_SEDE_MES']
ax = {c: i for i, c in enumerate(A[0])}
act = collections.defaultdict(dict)
for x in A[1:]:
    u = str(x[ax['id_sede']]).strip()
    m = str(x[ax['mes']] or '')[:7]
    if u and len(m) == 7:
        act[u][m] = float(x[ax['solicitudes']] or 0)


def offs(a, b):
    return (int(b[:4]) * 12 + int(b[5:7])) - (int(a[:4]) * 12 + int(a[5:7]))


def test(nombre, fechas):
    n = mal = 0
    for u, f in fechas.items():
        if len(f) < 7 or f[:7] < '2026-01':
            continue
        n += 1
        if any(offs(f[:7], m) < 0 and v > 0 for m, v in act.get(u, {}).items()):
            mal += 1
    print('   %-38s %5d cosechas · %4d imposibles · %5.1f%%'
          % (nombre, n, mal, 100.0 * mal / max(1, n)))


test('hs_createdate (el viejo)', crea)
test('vinculación (plataforma)', plat)
test('mi fecha unificada', mio)
test('la vista · ' + CAMPO, {u: suyo[u] for u in comunes} if comunes else {})

# ---------------------------------------------------------------- 5
linea()
print('5 · COSECHAS 2026 CON CADA DEFINICION')


def cos(fechas):
    c = collections.Counter()
    for f in fechas.values():
        if len(f) >= 7 and f[:7] >= '2026-01':
            c[f[:7]] += 1
    return c


defs = [('HubSpot', cos(crea)), ('vinculación', cos(plat)),
        ('mi unificada', cos(mio)),
        ('la vista', cos({u: suyo[u] for u in comunes}) if comunes else
         collections.Counter())]
meses = sorted({m for _, c in defs for m in c})
print('%-10s %s' % ('cosecha', ''.join('%14s' % d[0] for d in defs)))
tot = [0] * len(defs)
for m in meses:
    fila = ''
    for i, (_, c) in enumerate(defs):
        fila += '%14d' % c.get(m, 0)
        tot[i] += c.get(m, 0)
    print('%-10s %s' % (m, fila))
print('%-10s %s' % ('TOTAL', ''.join('%14d' % t for t in tot)))
