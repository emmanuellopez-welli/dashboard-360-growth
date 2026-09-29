# -*- coding: utf-8 -*-
import lib, io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

Q = """
WITH t_instituciones AS (
  SELECT 
    id AS id_sede,
    DATE(created) AS created
  FROM `welli-tecnologia.public.institucion_medica`
  WHERE COALESCE(deshabilidato, FALSE) = FALSE
),

apps_base AS (
  SELECT
    app.medico_id AS id_sede,
    DATE(app.created_on) AS fecha_app,
    app.estado
  FROM `welli-tecnologia.public.profile_institucion` app
),

t_periodos AS (
  SELECT
    DATE_TRUNC(fecha, MONTH) AS start_date,
    DATE_SUB(DATE_ADD(DATE_TRUNC(fecha, MONTH), INTERVAL 1 MONTH), INTERVAL 1 DAY) AS end_date,
    FORMAT_DATE('%Y-%m', fecha) AS label_mes
  FROM UNNEST(
    GENERATE_DATE_ARRAY(
      DATE '2025-10-01',
      CURRENT_DATE(),
      INTERVAL 1 MONTH
    )
  ) AS fecha
),

base AS (
  SELECT 
    i.id_sede,
    p.label_mes,
    p.start_date,
    p.end_date,

    DATE_DIFF(p.end_date, i.created, DAY) AS dias_desde_creacion,

    COUNTIF(a.fecha_app BETWEEN p.start_date AND p.end_date) AS solicitudes_mes,

    MAX(a.fecha_app) AS ultima_app,

    COUNT(a.fecha_app) > 0 AS tiene_apps

  FROM t_instituciones i
  CROSS JOIN t_periodos p
  LEFT JOIN apps_base a
    ON i.id_sede = a.id_sede
    AND a.fecha_app <= p.end_date

  WHERE p.end_date >= i.created

  GROUP BY
    i.id_sede,
    label_mes,
    start_date,
    end_date,
    dias_desde_creacion
),

clasificado AS (
  SELECT
    *,
    CASE
      WHEN dias_desde_creacion < 31 AND tiene_apps = TRUE THEN 'Nuevo con apps'
      WHEN dias_desde_creacion < 31 AND tiene_apps = FALSE THEN 'Nuevo sin apps'

      WHEN ultima_app IS NULL
           AND dias_desde_creacion BETWEEN 31 AND 89 THEN 'Inactivo'

      WHEN ultima_app IS NULL
           AND dias_desde_creacion >= 90 THEN 'Muerto'

      WHEN DATE_DIFF(end_date, ultima_app, DAY) <= 30 THEN 'Activo'

      WHEN DATE_DIFF(end_date, ultima_app, DAY) BETWEEN 31 AND 89 THEN 'Inactivo'

      WHEN DATE_DIFF(end_date, ultima_app, DAY) >= 90 THEN 'Muerto'
    END AS estado
  FROM base
)

SELECT
  label_mes,
  estado,
  COUNT(DISTINCT id_sede) AS total_sedes
FROM clasificado
GROUP BY label_mes, estado
ORDER BY label_mes DESC, estado
"""

r = lib.bq(Q, project='welli-tecnologia')
for row in r:
    print(row['label_mes'], row['estado'], row['total_sedes'])
