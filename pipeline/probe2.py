# -*- coding: utf-8 -*-
import lib

for ds in ['pipeline_ops', 'wp_data']:
    SQL = "SELECT table_name, TIMESTAMP_MILLIS(creation_time) AS creado FROM `welli-growth.%s.__TABLES__` ORDER BY table_name" % ds
    print('== %s ==' % ds)
    try:
        for r in lib.bq(SQL, project='welli-growth'):
            print('%-30s   %s' % (r.get('table_name'), str(r.get('creado'))[:19]))
    except Exception as e:
        print('ERROR: %s' % str(e)[:500])
    print()
