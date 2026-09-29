import lib
for flujo in ["Enviar Mensajes West", "WelliBot", "None"]:
    cond = "flujo IS NULL" if flujo=="None" else "flujo=@f"
    pass
r = lib.bq("""
  SELECT DATE(ts_evento,"America/Bogota") AS dia, COUNT(DISTINCT telefono) AS tels
  FROM `welli-growth.rescate.eventos_hilos`
  WHERE direccion='OUTBOUND' AND evento='message.sent' AND flujo='Enviar Mensajes West'
    AND DATE(ts_evento,"America/Bogota") >= '2026-08-01'
  GROUP BY dia ORDER BY dia
""", project='welli-data', location='US')
for x in r: print(x['dia'], x['tels'])
