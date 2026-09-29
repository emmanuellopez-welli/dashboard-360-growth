# -*- coding: utf-8 -*-
"""
Re-baja de BigQuery las tablas que el filtro global de origen NO puede
cortar hoy, agregandoles la llave de sede.

Por que hace falta: PLATA_SOBRE_MESA viene agregada por antiguedad y sin
sede, PLATA_SEDES es un top-300 (81% del monto), y WP_SERIE / WP_INCENTIVO
vienen agregadas por mes y por incentivo sin id_sede. Sin la llave, el
filtro de origen no las puede tocar y los KPI mostrarian el total de toda
la base bajo una etiqueta que dice otra cosa.

La llave: HubSpot guarda el UUID en la propiedad id_internal de Sedes.
  - welli-tecnologia.public.profile_institucion -> medico_id
  - welli-growth.wp_data.wp_incentivos_diario   -> id_internal
  - welli-growth.wp_data.wellipoints_snapshot   -> id_sede
  - welli-growth.wp_data.wp_canjeos_solicitados -> sede_id

Escribe cuatro hojas nuevas (por sede, sin agregar):
  PLATA_SEDE_ANT   id_sede x antiguedad  -> reemplaza PLATA_SOBRE_MESA
  RESCATE_BQ2      = RESCATE_BQ + id_sede
  WP_SEDE_MES      id_sede x mes         -> reemplaza WP_SERIE
  WP_SEDE_INC      id_sede x incentivo   -> reemplaza WP_INCENTIVO
"""
import lib, json, io, sys

ANIO = '2026-01-01'

# ---------------------------------------------------------------- F4
# Mismos baldes de antiguedad que ya usa el tablero, pero por sede.
SQL_PLATA_ANT = """
WITH aprob AS (
  SELECT
    medico_id AS id_sede,
    medico AS sede,
    COALESCE(monto_aprobado, monto) AS monto_aprobado,
    (SELECT MIN(DATE(TIMESTAMP(JSON_VALUE(c, "$.timestamp"))))
     FROM UNNEST(JSON_QUERY_ARRAY(cambios)) AS c
     WHERE JSON_VALUE(c, "$.estado") = "approved") AS fecha_aprobado
  FROM `welli-tecnologia.public.profile_institucion`
  WHERE estado IN ('approved', 'not_taken', 'firma_contrato')
)
SELECT
  IFNULL(id_sede, '') AS id_sede,
  CASE
    WHEN DATE_DIFF(CURRENT_DATE(), fecha_aprobado, DAY) <= 15 THEN '1. 0-15 dias'
    WHEN DATE_DIFF(CURRENT_DATE(), fecha_aprobado, DAY) <= 30 THEN '2. 16-30 dias'
    WHEN DATE_DIFF(CURRENT_DATE(), fecha_aprobado, DAY) <= 60 THEN '3. 31-60 dias'
    WHEN DATE_DIFF(CURRENT_DATE(), fecha_aprobado, DAY) <= 180 THEN '4. 61-180 dias'
    ELSE '5. mas de 180 dias'
  END AS antiguedad,
  COUNT(*) AS creditos,
  SUM(monto_aprobado) AS monto
FROM aprob
WHERE fecha_aprobado IS NOT NULL
GROUP BY 1, 2
"""

SQL_RESCATE2 = """
WITH aprob AS (
  SELECT
    id, medico AS sede, medico_id AS id_sede, monto,
    fecha_solicitud_desembolso,
    (SELECT MIN(DATE(TIMESTAMP(JSON_VALUE(c, "$.timestamp"))))
     FROM UNNEST(JSON_QUERY_ARRAY(cambios)) AS c
     WHERE JSON_VALUE(c, "$.estado") = "approved") AS fecha_aprobado
  FROM `welli-tecnologia.public.profile_institucion`
  WHERE estado = 'desembolsado'
    AND fecha_solicitud_desembolso IS NOT NULL
    AND DATE(fecha_solicitud_desembolso, "America/Bogota") >= '%s'
)
SELECT
  CAST(DATE(fecha_solicitud_desembolso, "America/Bogota") AS STRING) AS fecha_desembolso,
  sede,
  IFNULL(id_sede, '') AS id_sede,
  monto,
  DATE_DIFF(DATE(fecha_solicitud_desembolso, "America/Bogota"), fecha_aprobado, DAY) AS dias_aprobado_a_desembolso
FROM aprob
WHERE fecha_aprobado IS NOT NULL
ORDER BY fecha_desembolso
""" % ANIO

# ---------------------------------------------------------------- F5
SQL_WP_SEDE_MES = """
WITH ult AS (
  SELECT * EXCEPT(rn) FROM (
    SELECT *, FORMAT_DATE('%Y-%m', snapshot_date) AS mes,
           ROW_NUMBER() OVER (PARTITION BY id_internal,
                              FORMAT_DATE('%Y-%m', snapshot_date)
                              ORDER BY snapshot_date DESC) rn
    FROM `welli-growth.wp_data.wp_incentivos_diario`) WHERE rn = 1)
SELECT mes,
       IFNULL(id_internal, '') AS id_sede,
       IF(incentivo_ofrecido, 1, 0) AS con_oferta,
       IFNULL(wp_ofrecido_mes, 0) AS wp_ofrecido,
       IFNULL(wp_ganado_mes, 0) AS wp_ganado,
       IFNULL(wp_pendiente_actual, 0) AS wp_pendiente
FROM ult ORDER BY mes, id_sede
"""

SQL_WP_SEDE_INC = """
WITH ult AS (
  SELECT * EXCEPT(rn) FROM (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY id_internal
                                 ORDER BY snapshot_date DESC) rn
    FROM `welli-growth.wp_data.wp_incentivos_diario`) WHERE rn = 1)
SELECT IFNULL(id_internal, '') AS id_sede,
       IFNULL(incentivo_principal, '(sin incentivo)') AS incentivo,
       IFNULL(wp_ofrecido_mes, 0) AS wp_ofrecido,
       IFNULL(wp_ganado_mes, 0) AS wp_ganado,
       IF(incentivo_expira IS NULL, '',
          CAST(incentivo_expira AS STRING)) AS expira
FROM ult
"""

SQL_WP_CANJES2 = """
SELECT CAST(DATE(fecha_solicitud) AS STRING) AS fecha,
       IFNULL(sede_id, '') AS id_sede,
       sede_nombre, IFNULL(pipeline, '') AS pipeline,
       pts_solicitados, cop_solicitados,
       IFNULL(formato, '') AS formato, IFNULL(estado, '') AS estado,
       descontado_wp,
       DATE_DIFF(CURRENT_DATE(), DATE(fecha_solicitud), DAY) AS dias
FROM `welli-growth.wp_data.wp_canjeos_solicitados`
ORDER BY fecha_solicitud DESC
"""


def num(v):
    try:
        return int(float(v))
    except Exception:
        return 0


def tabla(filas, cols, enteros=()):
    out = [list(cols)]
    for r in filas:
        out.append([num(r.get(c)) if c in enteros else (r.get(c) if r.get(c) is not None else '')
                    for c in cols])
    return out


def cobertura(filas, campo, ids_hubspot):
    """Cuantas filas traen una llave que existe en HubSpot."""
    if not filas:
        return 0.0
    ok = sum(1 for r in filas if str(r.get(campo) or '') in ids_hubspot)
    return 100.0 * ok / len(filas)


if __name__ == '__main__':
    T = json.load(io.open('sheet_data.json', encoding='utf8'))
    S = T['SEDES']
    h = S[0]
    iI = h.index('id_internal')
    ids = set(str(r[iI]).strip() for r in S[1:] if str(r[iI] or '').strip())
    print('id_internal en HubSpot: %d' % len(ids))

    salida = {}

    trabajos = [
        ('PLATA_SEDE_ANT', SQL_PLATA_ANT, 'welli-tecnologia',
         ['id_sede', 'antiguedad', 'creditos', 'monto'], ('creditos', 'monto')),
        ('RESCATE_BQ2', SQL_RESCATE2, 'welli-tecnologia',
         ['fecha_desembolso', 'sede', 'id_sede', 'monto', 'dias_aprobado_a_desembolso'],
         ('monto', 'dias_aprobado_a_desembolso')),
        ('WP_SEDE_MES', SQL_WP_SEDE_MES, 'welli-data',
         ['mes', 'id_sede', 'con_oferta', 'wp_ofrecido', 'wp_ganado', 'wp_pendiente'],
         ('con_oferta', 'wp_ofrecido', 'wp_ganado', 'wp_pendiente')),
        ('WP_SEDE_INC', SQL_WP_SEDE_INC, 'welli-data',
         ['id_sede', 'incentivo', 'wp_ofrecido', 'wp_ganado', 'expira'],
         ('wp_ofrecido', 'wp_ganado')),
        ('WP_CANJES2', SQL_WP_CANJES2, 'welli-data',
         ['fecha', 'id_sede', 'sede_nombre', 'pipeline', 'pts_solicitados',
          'cop_solicitados', 'formato', 'estado', 'descontado_wp', 'dias'],
         ('pts_solicitados', 'cop_solicitados', 'dias')),
    ]

    for nombre, sql, proy, cols, ent in trabajos:
        print('')
        print('--- %s (job en %s) ---' % (nombre, proy))
        try:
            filas = lib.bq(sql, project=proy)
        except Exception as e:
            print('   FALLO: %s' % str(e)[:300])
            continue
        cob = cobertura(filas, 'id_sede', ids)
        print('   %d filas · %.1f%% con id_sede que existe en HubSpot' % (len(filas), cob))
        if cob < 80:
            print('   OJO: cobertura baja. Revisar la llave antes de usarla para filtrar.')
        salida[nombre] = tabla(filas, cols, ent)

    json.dump(salida, io.open('tables_id_sede.json', 'w', encoding='utf8'),
              ensure_ascii=False)
    print('')
    print('escrito tables_id_sede.json con %d tablas' % len(salida))
