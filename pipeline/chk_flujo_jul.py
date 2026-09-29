import lib
r = lib.bq("""
  SELECT flujo, MIN(DATE(ts_evento,"America/Bogota")) AS desde,
         MAX(DATE(ts_evento,"America/Bogota")) AS hasta, COUNT(*) AS n
  FROM `welli-growth.rescate.eventos_hilos`
  WHERE direccion='OUTBOUND' AND evento='message.sent'
    AND DATE(ts_evento,"America/Bogota") BETWEEN '2026-07-28' AND '2026-08-06'
  GROUP BY flujo ORDER BY n DESC LIMIT 15
""", project='welli-data', location='US')
for x in r: print(x['flujo'], x['desde'], '->', x['hasta'], x['n'])
