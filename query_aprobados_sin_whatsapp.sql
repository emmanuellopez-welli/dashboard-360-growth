-- =====================================================================
-- LOS 631 DE 1.875 APROBADOS SIN NINGÚN MENSAJE DE WHATSAPP (33,7%)
-- Ventana: 25-ago a 8-sep-2026
--
-- POR QUÉ SON DOS QUERIES Y NO UNA
--   Las dos tablas están en REGIONES distintas de BigQuery:
--     · welli-data.comercial_ops.t_sol_v2      → us-central1
--     · welli-growth.rescate.eventos_hilos     → US (multi-región)
--   BigQuery no puede hacer JOIN entre regiones en una sola consulta. Así
--   que se corre una en cada región y el cruce se hace por fuera (yo lo
--   hice en Python; al final de este archivo está cómo hacerlo 100% en SQL
--   si hace falta mostrarlo en vivo).
--
-- PARA REPRODUCIR EL NÚMERO EXACTO: usar las fechas fijas de abajo, NO
-- CURRENT_DATE. El cálculo se corrió el 8-sep-2026; con CURRENT_DATE la
-- ventana se mueve sola y el número cambia (correcto, pero distinto).
--
-- LA DEFINICIÓN, en palabras: de los créditos que HOY siguen en estado
-- 'approved' (aprobados y sin firmar) cuya solicitud entró en la ventana y
-- que tienen celular registrado, cuántos no tienen NI UN mensaje saliente
-- en el log del webhook de WhatsApp.
-- =====================================================================


-- ---------------------------------------------------------------------
-- QUERY 1 · en la región us-central1 (proyecto welli-data)
-- Los aprobados de la ventana, con el celular normalizado.
-- Resultado esperado: 1.875 filas.
-- ---------------------------------------------------------------------
SELECT
  documento,
  nro_celular_paciente,
  -- Se normaliza a los ÚLTIMOS 10 dígitos: la base guarda unos con
  -- indicativo (57...), otros sin él, y algunos con espacios o guiones.
  -- Sin esto, el mismo teléfono no cruza consigo mismo.
  RIGHT(REGEXP_REPLACE(nro_celular_paciente, r'[^0-9]', ''), 10) AS tel,
  DATE(fecha_solicitud, "America/Bogota") AS fecha_solicitud_bogota,
  monto_aprobado,
  nombre_comercial AS clinica
FROM `welli-data.comercial_ops.t_sol_v2`
WHERE estado = 'approved'
  AND nro_celular_paciente IS NOT NULL
  AND TRIM(nro_celular_paciente) != ''
  -- La ventana va sobre fecha_solicitud porque t_sol_v2 NO guarda la fecha
  -- en que el crédito pasó a aprobado. Es el reloj más cercano que existe,
  -- y hay que decirlo cuando se presenta el número.
  AND DATE(fecha_solicitud, "America/Bogota")
      BETWEEN DATE '2026-08-25' AND DATE '2026-09-08'
;


-- ---------------------------------------------------------------------
-- QUERY 2 · en la región US (proyecto de facturación welli-data)
-- Los teléfonos que SÍ recibieron al menos un mensaje saliente, alguna vez.
-- Resultado esperado: ~58.200 teléfonos.
-- ---------------------------------------------------------------------
SELECT DISTINCT
  RIGHT(REGEXP_REPLACE(telefono, r'[^0-9]', ''), 10) AS tel
FROM `welli-growth.rescate.eventos_hilos`
-- OUTBOUND = lo que WELLI le mandó al paciente (sent / delivered / read /
-- failed / retry). Sin filtrar dirección entrarían las respuestas del
-- paciente y "recibió mensaje" dejaría de significar lo que dice.
WHERE direccion = 'OUTBOUND'
;


-- ---------------------------------------------------------------------
-- EL CRUCE
--   Aprobados de la Query 1, deduplicados por teléfono            → 1.875
--   De esos, los que NO aparecen en la Query 2                    →   631
--   631 / 1.875                                                   → 33,7%
--
-- Verificación que ya se hizo: deduplicar por DOCUMENTO en vez de por
-- teléfono da el MISMO resultado (631 de 1.875), y no hay ningún documento
-- repetido en la ventana. O sea, el número no depende de por cuál de los
-- dos se deduplique.
-- ---------------------------------------------------------------------


-- ---------------------------------------------------------------------
-- OPCIONAL · el número final en UNA sola query, sin salir de BigQuery
--
-- Truco: la lista de aprobados es chica (1.875 teléfonos), así que se puede
-- pegar dentro de la consulta que corre en la región US. Al revés no se
-- puede: los 58.200 teléfonos de eventos_hilos no caben cómodos.
--
-- Paso 1: correr esto en us-central1 para generar el literal
--   SELECT STRING_AGG(DISTINCT "'" ||
--            RIGHT(REGEXP_REPLACE(nro_celular_paciente, r'[^0-9]', ''), 10)
--            || "'", ',')
--   FROM `welli-data.comercial_ops.t_sol_v2`
--   WHERE estado = 'approved'
--     AND nro_celular_paciente IS NOT NULL
--     AND TRIM(nro_celular_paciente) != ''
--     AND DATE(fecha_solicitud, "America/Bogota")
--         BETWEEN DATE '2026-08-25' AND DATE '2026-09-08';
--
-- Paso 2: pegar ese resultado donde dice <<PEGAR AQUÍ>> y correr en US
--   WITH aprobados AS (
--     SELECT tel FROM UNNEST([<<PEGAR AQUÍ>>]) AS tel
--   ),
--   con_mensaje AS (
--     SELECT DISTINCT RIGHT(REGEXP_REPLACE(telefono, r'[^0-9]', ''), 10) AS tel
--     FROM `welli-growth.rescate.eventos_hilos`
--     WHERE direccion = 'OUTBOUND'
--   )
--   SELECT
--     COUNT(*)                                        AS aprobados,
--     COUNTIF(c.tel IS NULL)                          AS sin_mensaje,
--     ROUND(100 * COUNTIF(c.tel IS NULL) / COUNT(*), 1) AS pct_sin_mensaje
--   FROM aprobados a
--   LEFT JOIN con_mensaje c USING (tel);
--   -- Esperado: 1875 · 631 · 33.7
-- ---------------------------------------------------------------------
