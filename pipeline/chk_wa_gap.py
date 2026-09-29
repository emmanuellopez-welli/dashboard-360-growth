import lib
r = lib.bq("""
  SELECT DATE(ts_evento,"America/Bogota") AS dia, COUNT(*) AS n
  FROM `welli-growth.rescate.eventos_hilos`
  WHERE direccion='OUTBOUND' AND evento='message.sent'
    AND DATE(ts_evento,"America/Bogota") >= '2026-09-01'
  GROUP BY dia ORDER BY dia
""", project='welli-data', location='US')
for x in r:
    print(x['dia'], x['n'])
