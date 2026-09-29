import lib
r = lib.bq("""
SELECT mundo, COUNT(*) n FROM (
  SELECT sede_id, mundo,
         ROW_NUMBER() OVER (PARTITION BY sede_id ORDER BY timestamp DESC) rn
  FROM `welli-growth.wp_data.wp_dashboard_visitas`
) WHERE rn = 1
GROUP BY mundo ORDER BY n DESC
""", project='welli-data')
for x in r: print(x)
