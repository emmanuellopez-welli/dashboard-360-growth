# -*- coding: utf-8 -*-
"""Esquema real de las cuatro tablas de welli-growth.rescate + rangos y
valores de causal. Sin esto el mapeo del embudo es adivinanza."""
import rq

TABLAS = ['lista_dia', 'gestion', 'seguimiento', 'eventos_hilos']

cols = rq.q("""
SELECT table_name, column_name, data_type
FROM `welli-growth.rescate.INFORMATION_SCHEMA.COLUMNS`
ORDER BY table_name, ordinal_position
""")
por_tabla = {}
for r in cols:
    por_tabla.setdefault(r['table_name'], []).append(
        (r['column_name'], r['data_type']))

for t in TABLAS:
    cs = por_tabla.get(t, [])
    print('\n=== %s  (%d columnas) ===' % (t, len(cs)))
    for c, ty in cs:
        print('    %-36s %s' % (c, ty))

# Rango de fechas y volumen. La columna de fecha se detecta del esquema.
print('\n=== VOLUMEN Y RANGO ===')
for t in TABLAS:
    cs = dict(por_tabla.get(t, []))
    fcol = None
    for cand in ('fecha', 'fecha_gestion', 'dia', 'ts', 'created_at',
                 'timestamp', 'fecha_corte'):
        if cand in cs:
            fcol = cand
            break
    if not fcol:
        try:
            n = rq.q('SELECT COUNT(*) AS n FROM `welli-growth.rescate.%s`' % t)
            print('  %-16s %8s filas   (sin columna de fecha reconocida)'
                  % (t, n[0]['n']))
        except Exception as e:
            print('  %-16s ERROR %s' % (t, str(e)[:90]))
        continue
    try:
        r = rq.q("""
        SELECT COUNT(*) AS n,
               COUNT(DISTINCT DATE(%s)) AS dias,
               CAST(MIN(DATE(%s)) AS STRING) AS desde,
               CAST(MAX(DATE(%s)) AS STRING) AS hasta
        FROM `welli-growth.rescate.%s`
        """ % (fcol, fcol, fcol, t))[0]
        print('  %-16s %8s filas  %4s dias  %s -> %s   (fecha: %s)'
              % (t, r['n'], r['dias'], r['desde'], r['hasta'], fcol))
    except Exception as e:
        print('  %-16s ERROR %s' % (t, str(e)[:90]))
