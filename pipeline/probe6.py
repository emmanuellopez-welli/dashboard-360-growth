# -*- coding: utf-8 -*-
import lib

SQL = """
SELECT table_name, column_name, data_type
FROM `welli-growth.rescate.INFORMATION_SCHEMA.COLUMNS`
WHERE table_name IN ('eventos_hilos','gestion','lista_dia','seguimiento','gestion_historica','gestion_unificada')
ORDER BY table_name, ordinal_position
"""
for r in lib.bq(SQL, project='welli-data', location='US'):
    print('%-20s %-25s %s' % (r.get('table_name'), r.get('column_name'), r.get('data_type')))
