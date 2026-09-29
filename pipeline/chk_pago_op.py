import lib
r = lib.bq("""
  SELECT DATE(ts_evento,"America/Bogota") AS dia, COUNT(DISTINCT telefono) AS tels, COUNT(*) AS n
  FROM `welli-growth.rescate.eventos_hilos`
  WHERE direccion='OUTBOUND' AND evento='message.sent' AND flujo='pago_oportuno31072026'
  GROUP BY dia ORDER BY dia
""", project='welli-data', location='US')
for x in r: print(x['dia'], x['tels'], x['n'])
