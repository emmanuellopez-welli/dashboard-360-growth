import lib
r = lib.bq("""
  SELECT flujo, COUNT(*) n FROM `welli-growth.rescate.eventos_hilos`
  WHERE direccion='OUTBOUND' AND (LOWER(flujo) LIKE '%_wa_%' OR LOWER(flujo) LIKE '%wa_1w%'
    OR LOWER(flujo) LIKE '%wa_p%' OR LOWER(flujo) LIKE '%wa_q%')
  GROUP BY flujo ORDER BY n DESC LIMIT 20
""", project='welli-data', location='US')
for x in r: print(x['flujo'], x['n'])
