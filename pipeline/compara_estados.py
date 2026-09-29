# -*- coding: utf-8 -*-
"""Recalculo INDEPENDIENTE (no lee SEDE_ESTADO_MES) de nuestra definicion
de activas/inactivas/muertas, con la MISMA fuente (profile_institucion),
para comparar mes a mes contra la query de la jefa."""
import lib, io, sys, collections
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

SQL = """
WITH sol AS (
  SELECT medico_id, DATE(created_on, "America/Bogota") AS f
  FROM `welli-tecnologia.public.profile_institucion`
  WHERE medico_id IS NOT NULL AND created_on IS NOT NULL
),
sedes AS (SELECT DISTINCT medico_id FROM sol),
meses AS (
  SELECT m, LEAST(LAST_DAY(m), CURRENT_DATE()) AS fin
  FROM UNNEST(GENERATE_DATE_ARRAY('2025-10-01', CURRENT_DATE(),
    INTERVAL 1 MONTH)) AS m
),
spine AS (SELECT s.medico_id, x.m, x.fin FROM sedes s CROSS JOIN meses x)
SELECT p.medico_id,
  FORMAT_DATE('%Y-%m', p.m) AS mes,
  COUNTIF(o.f <= p.fin) AS apps_acum,
  IFNULL(DATE_DIFF(p.fin, MAX(IF(o.f <= p.fin, o.f, NULL)), DAY), -1)
    AS dias_sin_app
FROM spine p
LEFT JOIN sol o ON o.medico_id = p.medico_id
GROUP BY p.medico_id, p.m, p.fin
HAVING apps_acum > 0
"""
r = lib.bq(SQL, project='welli-tecnologia')

porMes = collections.defaultdict(lambda: {'activas': 0, 'recientes': 0, 'inactivas': 0, 'muertas': 0})
for x in r:
    mes = x['mes']
    dsa = int(x['dias_sin_app'])
    b = porMes[mes]
    b['activas'] += 1
    if dsa < 30:
        b['recientes'] += 1
    elif dsa <= 90:
        b['inactivas'] += 1
    else:
        b['muertas'] += 1

for mes in sorted(porMes, reverse=True):
    b = porMes[mes]
    print(mes, 'activas(acum)=%d' % b['activas'], 'recientes(<30d)=%d' % b['recientes'],
          'inactivas(30-90d)=%d' % b['inactivas'], 'muertas(>90d)=%d' % b['muertas'])
