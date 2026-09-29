WITH oficial AS (
SELECT
  pr.profile_institucion_id,
  app.estado,
  app.created,
  app.referencia_pago,
  app.client_app_origination_medium,
  JSON_EXTRACT(pr.engine_decision, '$.antecedent_loans') AS antecedent_loans
FROM `welli-tecnologia.public.profile_risk` pr
INNER JOIN `welli-tecnologia.public.profile_institucion` app
  ON app.id = pr.profile_institucion_id
WHERE SAFE_CAST(JSON_VALUE(pr.engine_decision, '$.is_recurrence') AS BOOL) IS TRUE
)
SELECT
  o.*,
  DATETIME(o.created, 'America/Bogota')                        AS fecha_bogota,
  im.nombre_comercial                                          AS sede,
  im.razon_social                                              AS grupo,
  im.especialidad,
  app.monto_solicitado,
  app.monto_aprobado,
  JSON_VALUE(o.antecedent_loans, '$[0].referencia_pago')       AS ref_credito_anterior,
  ant.estado                                                   AS estado_credito_anterior,
  im_a.nombre_comercial                                        AS sede_credito_anterior,
  im_a.id = im.id                                              AS misma_sede
FROM oficial o
JOIN `welli-tecnologia.public.profile_institucion` app
  ON app.id = o.profile_institucion_id
LEFT JOIN `welli-tecnologia.public.institucion_medica` im
  ON im.id = CAST(app.medico_id AS STRING)
LEFT JOIN `welli-tecnologia.public.profile_institucion` ant
  ON ant.id = JSON_VALUE(o.antecedent_loans, '$[0].application_id')
LEFT JOIN `welli-tecnologia.public.institucion_medica` im_a
  ON im_a.id = CAST(ant.medico_id AS STRING)
ORDER BY o.created
