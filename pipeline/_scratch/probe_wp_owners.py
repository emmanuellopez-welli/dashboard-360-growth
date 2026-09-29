import lib
r = lib.bq("""
SELECT column_name, data_type FROM `welli-growth.wp_data.INFORMATION_SCHEMA.COLUMNS`
WHERE table_name IN ('wp_sedes_owners','wp_sedes_historial')
ORDER BY table_name, ordinal_position
""", project='welli-data')
for x in r: print(x)
