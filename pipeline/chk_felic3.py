# -*- coding: utf-8 -*-
import io, sys
import lib
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

r = lib.bq("""
  SELECT telefono, cuerpo, plantilla, flujo, DATE(ts_evento,"America/Bogota") AS dia
  FROM `welli-growth.rescate.eventos_hilos`
  WHERE direccion='OUTBOUND' AND evento='message.sent'
    AND UPPER(cuerpo) LIKE '%FELICIDADES%'
  ORDER BY ts_evento DESC LIMIT 5
""", project='welli-data', location='US')
print('con FELICIDADES en cuerpo (mas reciente primero):')
for x in r:
    print(x['dia'], '|', x['telefono'], '|', x['plantilla'], '|', x['flujo'], '|', (x['cuerpo'] or '')[:80])
