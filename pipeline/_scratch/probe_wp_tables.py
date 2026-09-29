import lib
r = lib.bq("""
SELECT table_name FROM `welli-growth.wp_data.INFORMATION_SCHEMA.TABLES`
ORDER BY table_name
""", project='welli-data', location='US')
for x in r: print(x['table_name'])
