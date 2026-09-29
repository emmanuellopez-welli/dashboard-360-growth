-- =====================================================================
-- LOS 311 MILLONES DESEMBOLSADOS POR LA GESTIÓN DE KEVIN (agosto 2026)
--
-- Esta es EXACTAMENTE la cuenta que hace el tablero. Si el resultado no da
-- 311.359.860 con 20 casos, entonces el tablero y esta query dejaron de
-- estar de acuerdo y hay que revisar por qué (probablemente entró gestión
-- nueva: la tabla es viva).
--
-- DÓNDE CORRERLA
--   Proyecto de facturación: welli-data
--   Región: US (multi-región) — OJO: el dataset `welli-growth.rescate` NO
--   está en us-central1 como el resto de WELLI. Si BigQuery responde
--   "User does not have permission to query table", casi siempre es la
--   región mal puesta, no un permiso faltante.
--
-- QUÉ CUENTA (y qué NO)
--   Cuenta los casos que ESTUVIERON EN LA LISTA DIARIA de rescate y que
--   terminaron con el crédito firmado/desembolsado. Es "lo que se rescató
--   trabajándolo", no "todo lo que se desembolsó en el mes": un crédito que
--   se firmó solo, sin que nadie lo llamara, no está acá.
--
--   Por eso este número es MENOR que el "$892 M recuperado en 30 días" del
--   correo diario, que se calcula sobre el pool trabajable completo con una
--   consulta distinta (rescatados.resumen(), cuya definición no está en
--   estas tablas).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 · EL NÚMERO (lo que muestra la tarjeta del tablero)
-- ---------------------------------------------------------------------
WITH sd AS (
  -- Una fila por (día, paciente): `seguimiento` es un snapshot que se
  -- vuelve a escribir varias veces el mismo día, así que sin este QUALIFY
  -- el monto se cuenta tantas veces como capturas hubo.
  SELECT fecha, documento, estado_credito, monto, clinica
  FROM `welli-growth.rescate.seguimiento`
  QUALIFY ROW_NUMBER() OVER (PARTITION BY fecha, documento
                             ORDER BY capturado_en DESC) = 1
)
SELECT
  FORMAT_DATE('%Y-%m', fecha)      AS mes,
  COUNT(*)                         AS casos_firmados,
  SUM(monto)                       AS monto_desembolsado
FROM sd
WHERE estado_credito IN ('desembolsado', 'pendiente_desembolso',
                         'firma_contrato', 'fulfilled')
  AND fecha BETWEEN DATE '2026-08-01' AND DATE '2026-08-31'
GROUP BY mes;
-- Esperado: mes = 2026-08 · casos_firmados = 20 · monto = 311.359.860


-- ---------------------------------------------------------------------
-- 2 · EL DETALLE, caso por caso (para defender el número en una reunión)
-- ---------------------------------------------------------------------
-- WITH sd AS (
--   SELECT fecha, documento, paciente, clinica, especialidad, monto,
--          estado_credito, fecha_firma, canal, causal, capturado_en
--   FROM `welli-growth.rescate.seguimiento`
--   QUALIFY ROW_NUMBER() OVER (PARTITION BY fecha, documento
--                              ORDER BY capturado_en DESC) = 1
-- )
-- SELECT fecha, documento, paciente, clinica, especialidad,
--        monto, estado_credito, fecha_firma, canal, causal
-- FROM sd
-- WHERE estado_credito IN ('desembolsado', 'pendiente_desembolso',
--                          'firma_contrato', 'fulfilled')
--   AND fecha BETWEEN DATE '2026-08-01' AND DATE '2026-08-31'
-- ORDER BY monto DESC;


-- ---------------------------------------------------------------------
-- 3 · CONTROL: ¿algún paciente se está contando dos veces?
-- ---------------------------------------------------------------------
-- El QUALIFY de arriba deduplica por (día, paciente), NO por paciente. Si
-- un mismo documento aparece firmado en DOS días distintos del mes, su
-- monto entra dos veces y el total queda inflado. Esto lo detecta:
-- si devuelve cero filas, el número de arriba está limpio.
--
-- WITH sd AS (
--   SELECT fecha, documento, estado_credito, monto
--   FROM `welli-growth.rescate.seguimiento`
--   QUALIFY ROW_NUMBER() OVER (PARTITION BY fecha, documento
--                              ORDER BY capturado_en DESC) = 1
-- )
-- SELECT documento,
--        COUNT(DISTINCT fecha) AS dias_en_que_aparece_firmado,
--        SUM(monto)            AS monto_sumado_de_mas,
--        STRING_AGG(CAST(fecha AS STRING), ', ' ORDER BY fecha) AS dias
-- FROM sd
-- WHERE estado_credito IN ('desembolsado', 'pendiente_desembolso',
--                          'firma_contrato', 'fulfilled')
--   AND fecha BETWEEN DATE '2026-08-01' AND DATE '2026-08-31'
-- GROUP BY documento
-- HAVING COUNT(DISTINCT fecha) > 1;


-- ---------------------------------------------------------------------
-- 4 · LA VERSIÓN "UN PACIENTE, UNA VEZ" (por si el control de arriba
--     encuentra duplicados y hace falta el número sin inflar)
-- ---------------------------------------------------------------------
-- WITH sd AS (
--   -- Se queda con la ÚLTIMA aparición de cada paciente en el mes, no una
--   -- por día: así el monto entra una sola vez por persona.
--   SELECT documento, monto, estado_credito, fecha
--   FROM `welli-growth.rescate.seguimiento`
--   WHERE fecha BETWEEN DATE '2026-08-01' AND DATE '2026-08-31'
--   QUALIFY ROW_NUMBER() OVER (PARTITION BY documento
--                              ORDER BY fecha DESC, capturado_en DESC) = 1
-- )
-- SELECT COUNT(*) AS pacientes_firmados, SUM(monto) AS monto_desembolsado
-- FROM sd
-- WHERE estado_credito IN ('desembolsado', 'pendiente_desembolso',
--                          'firma_contrato', 'fulfilled');
