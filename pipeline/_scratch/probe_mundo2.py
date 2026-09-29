import lib
r = lib.bq("""
SELECT mundo, COUNT(DISTINCT sede_id) sedes, COUNT(*) visitas
FROM `welli-growth.wp_data.wp_dashboard_visitas`
GROUP BY mundo ORDER BY sedes DESC
""", project='welli-data')
for x in r: print(x)
