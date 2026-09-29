# -*- coding: utf-8 -*-
"""Valores reales de las columnas que definen el embudo, y que tan util es
eventos_hilos para atribuir. Nada de esto se puede inferir del esquema."""
import rq


def tabla(titulo, filas, cols):
    print('\n=== %s ===' % titulo)
    if not filas:
        print('   (vacio)')
        return
    for r in filas:
        print('   ' + '  '.join(str(r.get(c, ''))[:46].ljust(
            46 if c == cols[0] else 12) for c in cols))


# --- causales y canales que registra Kevin -------------------------------
tabla('CAUSALES en gestion (deduplicado por fecha+documento)', rq.q("""
WITH g AS (
  SELECT * FROM `welli-growth.rescate.gestion`
  QUALIFY ROW_NUMBER() OVER (PARTITION BY fecha, documento ORDER BY ts DESC) = 1)
SELECT COALESCE(causal, '(nulo)') AS causal, COUNT(*) AS casos,
       COUNTIF(trabajado) AS trabajados
FROM g GROUP BY 1 ORDER BY casos DESC
"""), ['causal', 'casos', 'trabajados'])

tabla('CANALES en gestion', rq.q("""
WITH g AS (
  SELECT * FROM `welli-growth.rescate.gestion`
  QUALIFY ROW_NUMBER() OVER (PARTITION BY fecha, documento ORDER BY ts DESC) = 1)
SELECT COALESCE(canal, '(nulo)') AS canal, COUNT(*) AS casos
FROM g GROUP BY 1 ORDER BY casos DESC
"""), ['canal', 'casos'])

# --- el efecto de la trampa 4: filas != casos ---------------------------
print('\n=== TRAMPA 4: filas contra casos reales ===')
r = rq.q("""
SELECT COUNT(*) AS filas,
       COUNT(DISTINCT CONCAT(CAST(fecha AS STRING), '|', documento)) AS casos
FROM `welli-growth.rescate.gestion`
""")[0]
print('   %s filas de gestion = %s casos reales  (%.1f%% de inflacion)'
      % (r['filas'], r['casos'],
         100.0 * (int(r['filas']) - int(r['casos'])) / max(1, int(r['casos']))))

# --- seguimiento: el desenlace ------------------------------------------
tabla('SEGUIMIENTO por estado del credito', rq.q("""
SELECT COALESCE(estado_credito, '(nulo)') AS estado, COUNT(*) AS casos,
       COUNTIF(firmo) AS firmaron,
       CAST(ROUND(SUM(monto)) AS STRING) AS monto
FROM `welli-growth.rescate.seguimiento`
GROUP BY 1 ORDER BY casos DESC
"""), ['estado', 'casos', 'firmaron', 'monto'])

tabla('SEGUIMIENTO: causal contra firma (la tabla clave de atribucion)', rq.q("""
SELECT COALESCE(causal, '(nulo)') AS causal, COUNT(*) AS casos,
       COUNTIF(firmo) AS firmaron,
       CAST(ROUND(100 * SAFE_DIVIDE(COUNTIF(firmo), COUNT(*)), 1) AS STRING) AS tasa,
       COUNTIF(wa_toque_ese_dia) AS con_wa
FROM `welli-growth.rescate.seguimiento`
GROUP BY 1 ORDER BY casos DESC
"""), ['causal', 'casos', 'firmaron', 'tasa', 'con_wa'])

# --- eventos_hilos: sirve para atribuir? --------------------------------
tabla('EVENTOS_HILOS por evento y direccion', rq.q("""
SELECT COALESCE(evento, '(nulo)') AS evento,
       COALESCE(direccion, '(nulo)') AS direccion,
       COUNT(*) AS n,
       CAST(MIN(DATE(ts_evento)) AS STRING) AS desde,
       CAST(MAX(DATE(ts_evento)) AS STRING) AS hasta
FROM `welli-growth.rescate.eventos_hilos`
GROUP BY 1, 2 ORDER BY n DESC LIMIT 20
"""), ['evento', 'direccion', 'n', 'desde', 'hasta'])

tabla('EVENTOS_HILOS por estado_msg', rq.q("""
SELECT COALESCE(estado_msg, '(nulo)') AS estado_msg, COUNT(*) AS n
FROM `welli-growth.rescate.eventos_hilos`
GROUP BY 1 ORDER BY n DESC LIMIT 15
"""), ['estado_msg', 'n'])
