# -*- coding: utf-8 -*-
"""
Que SI y que NO se puede comparar entre gestion_historica y gestion.

La trampa: las dos tablas usan taxonomias distintas para el desenlace de la
gestion. En la historica, razon_rechazo dice "No contesta" en 6.124 de 32.056
casos (19%); en la viva, causal dice "No contesta" en 226 de 499 (45%). Eso NO
es que el contacto se haya derrumbado — es que se cambio de formulario. Si se
grafican juntas, el 31-jul aparece un salto de 26 puntos que no ocurrio.

Comparable: casos trabajados, firmas, tasa de cierre, canal.
NO comparable: el embudo de contacto (contesto / colgo / hablo).
"""
import rq

H = '`welli-growth.rescate.gestion_historica`'


def pr(t, filas, cols, anchos):
    print('\n=== %s ===' % t)
    print('   ' + ''.join(c.ljust(a) for c, a in zip(cols, anchos)))
    for r in filas:
        print('   ' + ''.join(str(r[c])[:a - 1].ljust(a)
                              for c, a in zip(cols, anchos)))


# --- 1. serie mensual comparable ----------------------------------------
pr('SERIE MENSUAL · lo comparable entre las dos tablas', rq.q("""
WITH h AS (
  SELECT fecha_seguimiento AS fecha, documento,
         marcado_firma_credito AS firmo, medio_contacto AS canal
  FROM %s
  WHERE tiene_gestion = 'True' AND fecha_seguimiento IS NOT NULL
  QUALIFY ROW_NUMBER() OVER (PARTITION BY fecha_seguimiento, documento
                             ORDER BY cargado_en DESC) = 1),
g AS (
  SELECT gg.fecha, gg.documento, IFNULL(s.firmo, FALSE) AS firmo,
         gg.canal
  FROM (SELECT fecha, documento, canal
        FROM `welli-growth.rescate.gestion` WHERE trabajado
        QUALIFY ROW_NUMBER() OVER (PARTITION BY fecha, documento
                                   ORDER BY ts DESC) = 1) gg
  LEFT JOIN (SELECT documento, MAX(firmo) AS firmo
             FROM `welli-growth.rescate.seguimiento` GROUP BY 1) s
    USING (documento)),
u AS (SELECT *, 'historica' AS fuente FROM h
      UNION ALL SELECT *, 'viva' AS fuente FROM g)
SELECT FORMAT_DATE('%%Y-%%m', fecha) AS mes,
       STRING_AGG(DISTINCT fuente ORDER BY fuente) AS fuente,
       COUNT(*) AS casos, COUNTIF(firmo) AS firmas,
       ROUND(100 * SAFE_DIVIDE(COUNTIF(firmo), COUNT(*)), 2) AS tasa
FROM u GROUP BY 1 ORDER BY 1
""" % H), ['mes', 'fuente', 'casos', 'firmas', 'tasa'], [10, 12, 9, 9, 8])

# --- 2. el canal, que es la pregunta que importa ------------------------
pr('CIERRE POR CANAL · historico (oct-2024 a jul-2026)', rq.q("""
SELECT IFNULL(NULLIF(TRIM(medio_contacto), ''), '(sin canal)') AS canal,
       COUNT(*) AS casos, COUNTIF(marcado_firma_credito) AS firmas,
       ROUND(100 * SAFE_DIVIDE(COUNTIF(marcado_firma_credito),
                               COUNT(*)), 2) AS tasa
FROM %s
WHERE tiene_gestion = 'True'
GROUP BY 1 ORDER BY casos DESC
""" % H), ['canal', 'casos', 'firmas', 'tasa'], [16, 9, 9, 8])

# --- 3. la trampa, cuantificada -----------------------------------------
print('\n=== LA TRAMPA DE TAXONOMIA (por esto el embudo no se une) ===')
h = rq.q("""
SELECT COUNT(*) AS casos,
       COUNTIF(razon_rechazo = 'No contesta') AS no_contesta
FROM %s WHERE tiene_gestion = 'True'
""" % H)[0]
g = rq.q("""
WITH g AS (SELECT causal FROM `welli-growth.rescate.gestion` WHERE trabajado
           QUALIFY ROW_NUMBER() OVER (PARTITION BY fecha, documento
                                      ORDER BY ts DESC) = 1)
SELECT COUNT(*) AS casos, COUNTIF(causal = 'No contesta') AS no_contesta
FROM g
""")[0]
for etq, r in (('historica', h), ('viva', g)):
    n, nc = int(r['casos']), int(r['no_contesta'])
    print('   %-10s  "No contesta" en %5d de %5d = %4.1f%%'
          % (etq, nc, n, 100.0 * nc / n))
print('   -> 26 puntos de diferencia por cambio de formulario, no de gestion.')
