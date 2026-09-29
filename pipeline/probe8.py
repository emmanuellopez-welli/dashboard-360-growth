# -*- coding: utf-8 -*-
"""Prueba: aprobados vivos (estado='approved') sin ningun mensaje OUTBOUND
en eventos_hilos, cruzando por telefono normalizado a 10 digitos."""
import lib

SQL = """
WITH ap AS (
  SELECT documento, nro_celular_paciente,
         RIGHT(REGEXP_REPLACE(nro_celular_paciente, r'[^0-9]', ''), 10) AS tel
  FROM `welli-data.comercial_ops.t_sol_v2`
  WHERE estado = 'approved'
    AND nro_celular_paciente IS NOT NULL AND TRIM(nro_celular_paciente) != ''
),
msg AS (
  SELECT DISTINCT RIGHT(REGEXP_REPLACE(telefono, r'[^0-9]', ''), 10) AS tel,
         COUNT(*) OVER (PARTITION BY RIGHT(REGEXP_REPLACE(telefono, r'[^0-9]', ''), 10)) AS n_msj
  FROM `welli-growth.rescate.eventos_hilos`
  WHERE direccion = 'OUTBOUND'
)
SELECT
  COUNT(*) AS total_aprobados,
  COUNT(DISTINCT ap.tel) AS aprobados_tel_unicos,
  COUNTIF(msg.tel IS NULL) AS sin_mensaje,
  ROUND(AVG(msg.n_msj), 1) AS prom_msj_los_que_si
FROM ap LEFT JOIN msg ON ap.tel = msg.tel
"""
for r in lib.bq(SQL, project='welli-data', location='US'):
    print(r)
