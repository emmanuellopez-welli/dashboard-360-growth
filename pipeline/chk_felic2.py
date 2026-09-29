import lib
r = lib.bq("""
  SELECT telefono, cuerpo, plantilla, flujo, DATE(ts_evento,"America/Bogota") AS dia
  FROM `welli-growth.rescate.eventos_hilos`
  WHERE direccion='OUTBOUND' AND evento='message.sent'
    AND UPPER(cuerpo) LIKE '%FELICIDADES%'
  ORDER BY ts_evento DESC LIMIT 5
""", project='welli-data', location='US')
print('con FELICIDADES en cuerpo:')
for x in r: print(x)

r2 = lib.bq("""
  SELECT COUNT(*) AS n FROM `welli-growth.rescate.eventos_hilos`
  WHERE direccion='OUTBOUND' AND evento='message.sent' AND cuerpo IS NOT NULL AND cuerpo != ''
""", project='welli-data', location='US')
print('total con cuerpo no vacio:', r2[0]['n'])
