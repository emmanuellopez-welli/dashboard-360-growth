# -*- coding: utf-8 -*-
"""QA EXHAUSTIVO del grafico "Las sedes que entran a la plataforma,
desembolsan mas?" (F5, seccion 2), pedido 21-sep-2026 porque el 11x se ve
"demasiado bueno" y hay que sustentarlo con data real antes de presentarlo.

Estrategia: reconstruir el numero DESDE CERO, en una sola query de
BigQuery, sin pasar por CREDITO_DIA (la hoja comprimida), sin pasar por
hechos_()/wpCruceLogin_ (el motor del tablero), y sin pasar por
sheet_data.json (el snapshot local, que puede estar desactualizado).
Fuente unica: welli-tecnologia.public.profile_institucion (el mismo
origen que documenta pull_credito_dia.py, con el MISMO CASE WHEN de
exclusion de 'dismissed'), cruzado directo contra wellipoints_snapshot y
wp_dashboard_visitas -- las tres tablas viven con la MISMA llave UUID
(medico_id = id_sede = id_internal), asi que no hace falta ningun cruce
via HubSpot ni via SEDES."""
import lib, json, io, sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# ---- 1. el mismo CASE WHEN de pull_credito_dia.py, calculado independiente
CONV_ESTADOS = ("'pendiente_aprobacion_medico','desembolsado',"
                "'pendiente_validacion_cliente','fulfilled','pendiente_desembolso'")

SQL = """
WITH desem AS (
  SELECT
    medico_id AS id_sede,
    FORMAT_DATE('%%Y-%%m', DATE(created_on, 'America/Bogota')) AS mes,
    COALESCE(monto_aprobado, monto) AS monto
  FROM `welli-tecnologia.public.profile_institucion`
  WHERE medico_id IS NOT NULL AND created_on IS NOT NULL
    AND estado IN (%s)
),
habilitadas AS (
  SELECT DISTINCT id_sede FROM `welli-growth.wp_data.wellipoints_snapshot`
  WHERE id_sede IS NOT NULL AND id_sede != ''
),
con_login AS (
  SELECT DISTINCT sede_id AS id_sede FROM `welli-growth.wp_data.wp_dashboard_visitas`
)
SELECT
  d.mes,
  IF(cl.id_sede IS NOT NULL, 'con', 'sin') AS grupo,
  d.id_sede,
  SUM(d.monto) AS monto_mes
FROM desem d
JOIN habilitadas h ON h.id_sede = d.id_sede
LEFT JOIN con_login cl ON cl.id_sede = d.id_sede
WHERE d.mes >= '2026-01'
GROUP BY d.mes, grupo, d.id_sede
""" % CONV_ESTADOS

filas = lib.bq(SQL, project='welli-tecnologia')
print('filas sede-mes con desembolso:', len(filas))

# tamano de cada grupo (universo COMPLETO, no solo los que desembolsaron)
r_universo = lib.bq("""
SELECT
  IF(cl.id_sede IS NOT NULL, 'con', 'sin') AS grupo,
  COUNT(DISTINCT h.id_sede) AS n
FROM `welli-growth.wp_data.wellipoints_snapshot` h
LEFT JOIN (SELECT DISTINCT sede_id AS id_sede FROM `welli-growth.wp_data.wp_dashboard_visitas`) cl
  ON cl.id_sede = h.id_sede
WHERE h.id_sede IS NOT NULL AND h.id_sede != ''
GROUP BY grupo
""", project='welli-tecnologia')
nGrupo = {r['grupo']: int(r['n']) for r in r_universo}
print('universo:', nGrupo)

json.dump(filas, io.open('qa_wp_cruce_filas.json', 'w', encoding='utf8'),
          default=str, ensure_ascii=False)
json.dump(nGrupo, io.open('qa_wp_cruce_universo.json', 'w', encoding='utf8'))
print('escrito qa_wp_cruce_filas.json y qa_wp_cruce_universo.json')
