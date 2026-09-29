import lib
r = lib.bq("""
SELECT column_name, data_type FROM `welli-growth.wp_data.INFORMATION_SCHEMA.COLUMNS`
WHERE table_name = 'wp_dashboard_visitas'
ORDER BY ordinal_position
""", project='welli-data')
for x in r: print(x)
