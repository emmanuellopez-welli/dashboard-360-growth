# -*- coding: utf-8 -*-
import lib

for proj in ['welli-tecnologia', 'welli-data', 'welli-growth']:
    SQL = "SELECT schema_name FROM `%s`.INFORMATION_SCHEMA.SCHEMATA ORDER BY schema_name" % proj
    print('== %s ==' % proj)
    try:
        for r in lib.bq(SQL, project=proj):
            print(' ', r.get('schema_name'))
    except Exception as e:
        print('ERROR:', str(e)[:300])
    print()
