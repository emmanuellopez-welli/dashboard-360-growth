# -*- coding: utf-8 -*-
"""Vuelta 2: la pregunta al reves. No "¿tenian un not_taken antes?" (eso ya
se midio y NO distingue a los dos grupos), sino "¿el credito que aprobaron
DESPUES del 15-sep termino en not_taken?".

O sea: no recibir el mensaje de confirmacion, ¿hace que el paciente no tome
el credito? Esa es la pregunta de negocio que de verdad importa."""
import json
import math

import lib

d = json.load(open('wa_post15.json'))
sin = {t for t, f in d['sin']}
con = {t for t, f in d['con']}

SQL = """
WITH apro AS (
  SELECT
    RIGHT(REGEXP_REPLACE(s.nro_celular_paciente, r'[^0-9]', ''), 10) AS tel,
    s.id_profile_insititucion AS app_id,
    s.estado AS estado_hoy
  FROM `welli-data.comercial_ops.t_sol_v2` s
  WHERE s.estado IN ('approved','desembolsado','fulfilled',
                     'pendiente_desembolso','firma_contrato')
    AND s.nro_celular_paciente IS NOT NULL
    AND DATE(s.fecha_solicitud, "America/Bogota") >= '2026-09-16'
),
nt AS (
  SELECT DISTINCT application_id
  FROM `welli-tecnologia.public.status_historic`
  WHERE status_new = 'not_taken' AND deleted_at IS NULL
),
des AS (
  SELECT DISTINCT application_id
  FROM `welli-tecnologia.public.status_historic`
  WHERE status_new IN ('desembolsado','fulfilled') AND deleted_at IS NULL
)
SELECT a.tel,
       MAX(IF(nt.application_id IS NOT NULL, 1, 0))  AS no_tomado,
       MAX(IF(des.application_id IS NOT NULL, 1, 0)) AS desembolsado
FROM apro a
LEFT JOIN nt  ON nt.application_id  = a.app_id
LEFT JOIN des ON des.application_id = a.app_id
GROUP BY a.tel
"""

r = lib.bq(SQL, project='welli-data')
por = {x['tel']: (int(x['no_tomado'] or 0), int(x['desembolsado'] or 0)) for x in r}
print('telefonos cruzados: %d' % len(por))


def med(grupo, nombre):
    enc = [t for t in grupo if t in por]
    nt = sum(1 for t in enc if por[t][0])
    ds = sum(1 for t in enc if por[t][1])
    print('  %-18s n=%4d   NO TOMADO=%4d (%5.1f%%)   desembolsado=%4d (%5.1f%%)'
          % (nombre, len(enc), nt, 100.0 * nt / len(enc), ds, 100.0 * ds / len(enc)))
    return len(enc), nt


print()
print('--- el credito aprobado despues del 15-sep, ¿termino no tomado? ---')
n1, k1 = med(sin, 'SIN confirmacion')
n2, k2 = med(con, 'CON confirmacion')

p1, p2 = k1 / n1, k2 / n2
se = math.sqrt(p1 * (1 - p1) / n1 + p2 * (1 - p2) / n2)
dif = (p1 - p2) * 100
print()
print('  diferencia: %+.1f pp   (error estandar %.1f pp, ~%.1f desviaciones)'
      % (dif, se * 100, abs(dif) / (se * 100) if se else 0))
print('  IC95 aprox: [%+.1f , %+.1f] pp' % (dif - 1.96 * se * 100, dif + 1.96 * se * 100))
