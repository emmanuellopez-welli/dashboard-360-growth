import lib
r = lib.bq("""
  SELECT DISTINCT flujo FROM `welli-growth.rescate.eventos_hilos`
  WHERE direccion='OUTBOUND' AND LOWER(flujo) LIKE '%aprob%'
""", project='welli-data', location='US')
print('flujos que contienen "aprob":')
for x in r: print(' -', x['flujo'])
