# -*- coding: utf-8 -*-
import lib
SQL = """
SELECT flujo, plantilla, COUNT(*) n,
       MIN(DATE(ts_evento,"America/Bogota")) mind,
       MAX(DATE(ts_evento,"America/Bogota")) maxd
FROM `welli-growth.rescate.eventos_hilos`
WHERE direccion='OUTBOUND' AND evento='message.sent'
GROUP BY 1,2 ORDER BY 3 DESC
LIMIT 60
"""
for r in lib.bq(SQL, project='welli-data', location='US'):
    print(r)
