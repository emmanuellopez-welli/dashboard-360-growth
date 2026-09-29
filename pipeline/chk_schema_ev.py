import lib
r = lib.bq("""
SELECT column_name, data_type
FROM `welli-growth.rescate.INFORMATION_SCHEMA.COLUMNS`
WHERE table_name = 'eventos_hilos'
ORDER BY ordinal_position
""", project='welli-data', location='US')
for x in r: print(x['column_name'], x['data_type'])
