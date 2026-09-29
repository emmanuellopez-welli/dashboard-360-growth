# -*- coding: utf-8 -*-
"""Hipotesis de Emmanuel (28-sep-2026): los pacientes aprobados que NO
recibieron el mensaje de confirmacion, ¿tenian antes un credito 'not_taken'?

Se compara contra el grupo que SI lo recibio. Sin ese control el numero no
dice nada (regla de la seccion 19): si el 40% de los que no recibieron tienen
un not_taken previo, eso solo importa si el 40% NO es tambien la tasa de los
que si recibieron."""
import json

import lib

d = json.load(open('wa_post15.json'))
sin = {t for t, f in d['sin']}
con = {t for t, f in d['con']}
print('SIN confirmacion: %d  ·  CON confirmacion: %d' % (len(sin), len(con)))

# Un paciente = un telefono (ultimos 10 digitos), igual que en el pull de WA.
SQL = """
WITH apro AS (
  SELECT DISTINCT
    RIGHT(REGEXP_REPLACE(s.nro_celular_paciente, r'[^0-9]', ''), 10) AS tel,
    s.documento
  FROM `welli-data.comercial_ops.t_sol_v2` s
  WHERE s.estado IN ('approved','desembolsado','fulfilled',
                     'pendiente_desembolso','firma_contrato')
    AND s.nro_celular_paciente IS NOT NULL
    AND DATE(s.fecha_solicitud, "America/Bogota") >= '2026-09-16'
),
-- Todas las solicitudes historicas del paciente, por documento
todas AS (
  SELECT DISTINCT
    RIGHT(REGEXP_REPLACE(s2.nro_celular_paciente, r'[^0-9]', ''), 10) AS tel,
    s2.id_profile_insititucion AS app_id,
    DATE(s2.fecha_solicitud, "America/Bogota") AS fecha
  FROM `welli-data.comercial_ops.t_sol_v2` s2
  WHERE s2.nro_celular_paciente IS NOT NULL
),
-- Aplicaciones que ALGUNA VEZ pasaron por not_taken
nt AS (
  SELECT DISTINCT application_id
  FROM `welli-tecnologia.public.status_historic`
  WHERE status_new = 'not_taken' AND deleted_at IS NULL
)
SELECT
  a.tel,
  COUNTIF(nt.application_id IS NOT NULL) AS n_not_taken,
  COUNTIF(nt.application_id IS NOT NULL AND t.fecha < '2026-09-16') AS n_not_taken_previo
FROM apro a
LEFT JOIN todas t ON t.tel = a.tel
LEFT JOIN nt ON nt.application_id = t.app_id
GROUP BY a.tel
"""

r = lib.bq(SQL, project='welli-data')
print('telefonos aprobados post-15-sep en BigQuery: %d' % len(r))

por = {x['tel']: (int(x['n_not_taken'] or 0), int(x['n_not_taken_previo'] or 0)) for x in r}


def tasa(grupo, nombre):
    enc = [t for t in grupo if t in por]
    if not enc:
        print('  %s: ninguno cruzo' % nombre)
        return
    conNT = sum(1 for t in enc if por[t][0] > 0)
    conPrev = sum(1 for t in enc if por[t][1] > 0)
    print('  %-18s cruzados=%4d   con not_taken alguna vez=%4d (%5.1f%%)   '
          'con not_taken ANTES del 16-sep=%4d (%5.1f%%)'
          % (nombre, len(enc), conNT, 100.0 * conNT / len(enc),
             conPrev, 100.0 * conPrev / len(enc)))


print()
print('--- not_taken previo, los dos grupos ---')
tasa(sin, 'SIN confirmacion')
tasa(con, 'CON confirmacion')
