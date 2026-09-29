# -*- coding: utf-8 -*-
import lib

SQL = """
SELECT evento, direccion, COUNT(*) n,
       MIN(DATE(ts_evento,"America/Bogota")) mind,
       MAX(DATE(ts_evento,"America/Bogota")) maxd
FROM `welli-growth.rescate.eventos_hilos`
GROUP BY 1,2 ORDER BY 3 DESC
"""
for r in lib.bq(SQL, project='welli-data', location='US'):
    print(r)
