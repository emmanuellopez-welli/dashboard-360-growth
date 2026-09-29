import lib
r = lib.bq("""
SELECT COUNT(*) AS total_sedes,
       COUNT(DISTINCT sede_id) AS sedes_con_login
FROM `welli-growth.wp_data.wp_dashboard_visitas`
""", project='welli-data')
print('visitas:', r)

r2 = lib.bq("""
SELECT COUNT(*) AS n FROM `welli-growth.wp_data.wellipoints_snapshot`
""", project='welli-data')
print('wellipoints_snapshot total:', r2)

r3 = lib.bq("""
SELECT column_name, data_type FROM `welli-growth.wp_data.INFORMATION_SCHEMA.COLUMNS`
WHERE table_name = 'wellipoints_snapshot'
ORDER BY ordinal_position
""", project='welli-data')
for x in r3: print(x)
