# -*- coding: utf-8 -*-
"""Que hay realmente en welli-growth.rescate: tablas, filas y rango de fechas."""
import lib, json

SQL = """
SELECT table_name, row_count, TIMESTAMP_MILLIS(creation_time) AS creado
FROM `welli-growth.rescate.__TABLES__`
ORDER BY table_name
"""
try:
    for r in lib.bq(SQL, project='welli-growth'):
        print('%-28s %8s filas   creada %s'
              % (r.get('table_name'), r.get('row_count'), str(r.get('creado'))[:19]))
except Exception as e:
    print('ERROR rescate: %s' % str(e)[:400])
    # Si el dataset no esta ahi, listar los datasets del proyecto
    try:
        for r in lib.bq("SELECT schema_name FROM "
                        "`welli-growth`.INFORMATION_SCHEMA.SCHEMATA "
                        "ORDER BY schema_name", project='welli-growth'):
            print('  dataset: %s' % r.get('schema_name'))
    except Exception as e2:
        print('ERROR datasets: %s' % str(e2)[:300])
