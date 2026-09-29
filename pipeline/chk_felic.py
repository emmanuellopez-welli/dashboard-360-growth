import lib
r = lib.bq("""
  SELECT telefono, cuerpo, plantilla, flujo, ts_evento
  FROM `welli-growth.rescate.eventos_hilos`
  WHERE direccion='OUTBOUND' AND evento='message.sent'
    AND DATE(ts_evento,"America/Bogota") = '2026-09-11'
    AND UPPER(cuerpo) LIKE '%FELICIDADES%APROBADO%'
  LIMIT 5
""", project='welli-data', location='US')
for x in r: print(x)
