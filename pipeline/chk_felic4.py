# -*- coding: utf-8 -*-
import io, sys
import lib
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

r = lib.bq("""
  SELECT telefono, plantilla, flujo, DATE(ts_evento,"America/Bogota") AS dia, cuerpo
  FROM `welli-growth.rescate.eventos_hilos`
  WHERE direccion='OUTBOUND' AND evento='message.sent'
    AND (UPPER(cuerpo) LIKE '%CREDITO HA SIDO APROBADO%' OR UPPER(cuerpo) LIKE '%CR%DITO HA SIDO APROBADO%'
         OR UPPER(cuerpo) LIKE '%TU CREDITO%APROBADO%')
  ORDER BY ts_evento DESC LIMIT 3
""", project='welli-data', location='US')
for x in r:
    print(x['dia'], '|', x['telefono'], '|', x['plantilla'], '|', x['flujo'])
    print('  ', (x['cuerpo'] or '')[:150])

r2 = lib.bq("""
  SELECT MAX(DATE(ts_evento,"America/Bogota")) AS ult, COUNT(*) AS n
  FROM `welli-growth.rescate.eventos_hilos`
  WHERE direccion='OUTBOUND' AND evento='message.sent'
    AND (UPPER(cuerpo) LIKE '%CREDITO HA SIDO APROBADO%' OR UPPER(cuerpo) LIKE '%CR%DITO HA SIDO APROBADO%'
         OR UPPER(cuerpo) LIKE '%TU CREDITO%APROBADO%')
""", project='welli-data', location='US')
print('ULTIMO ENVIO:', r2[0]['ult'], '| total historico:', r2[0]['n'])
