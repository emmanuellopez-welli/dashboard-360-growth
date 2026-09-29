import lib
r = lib.bq("""
SELECT column_name, data_type FROM `welli-growth.wp_data.INFORMATION_SCHEMA.COLUMNS`
WHERE table_name IN ('wp_canjeos_solicitados','wp_dashboard_visitas')
ORDER BY table_name, ordinal_position
""", project='welli-data')
cur = None
for x in r:
    print(x)
