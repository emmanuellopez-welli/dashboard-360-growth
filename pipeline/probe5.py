# -*- coding: utf-8 -*-
import lib

SQL = "SELECT table_name FROM `welli-growth.rescate.INFORMATION_SCHEMA.TABLES` ORDER BY table_name"
try:
    for r in lib.bq(SQL, project='welli-data', location='US'):
        print(r.get('table_name'))
except Exception as e:
    print('ERROR:', str(e)[:600])
