import lib
r = lib.bq("""
SELECT schema_name FROM `welli-growth.INFORMATION_SCHEMA.SCHEMATA`
""", project='welli-data')
for x in r: print(x)
