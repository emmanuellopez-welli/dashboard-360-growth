# -*- coding: utf-8 -*-
"""Sale con 0 en cuanto las tres tablas de rescate se puedan leer."""
import sys, lib
faltan = []
for t in ('lista_dia', 'gestion', 'seguimiento', 'eventos_hilos'):
    try:
        lib.bq('SELECT COUNT(*) AS n FROM `welli-growth.rescate.%s`' % t,
               project='welli-data')
    except Exception:
        faltan.append(t)
if faltan:
    print('faltan: %s' % ', '.join(faltan))
    sys.exit(1)
print('ACCESO OK a las tres tablas')
sys.exit(0)
