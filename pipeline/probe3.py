# -*- coding: utf-8 -*-
import lib

for ds in ['pipeline_ops', 'wp_data']:
    SQL = "SELECT table_name FROM `welli-growth.%s.INFORMATION_SCHEMA.TABLES` ORDER BY table_name" % ds
    print('== %s ==' % ds)
    try:
        for r in lib.bq(SQL, project='welli-growth'):
            print(r.get('table_name'))
    except Exception as e:
        print('ERROR: %s' % str(e)[:500])
    print()
