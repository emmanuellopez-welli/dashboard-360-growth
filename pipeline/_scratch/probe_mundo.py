import lib
r = lib.bq("""
SELECT macro_sede, COUNT(*) n FROM `welli-growth.wp_data.wellipoints_snapshot`
GROUP BY macro_sede ORDER BY n DESC
""", project='welli-data')
for x in r: print(x)
r2 = lib.bq("""
SELECT MIN(periodo) mn, MAX(periodo) mx FROM `welli-growth.wp_data.wellipoints_snapshot`
""", project='welli-data')
print(r2)
