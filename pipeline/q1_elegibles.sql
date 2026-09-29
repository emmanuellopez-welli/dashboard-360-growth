WITH ranked AS (
  SELECT
    pi.*,
    ROW_NUMBER() OVER (
      PARTITION BY pi.profile_id
      ORDER BY pi.created_on DESC, pi.id DESC
    ) AS rn
  FROM welli-tecnologia.public.profile_institucion pi
  WHERE pi.deleted_at IS NULL
),
latest_app AS (
  SELECT * FROM ranked WHERE rn = 1
),
hard_blocked AS (
  SELECT DISTINCT profile_id
  FROM welli-tecnologia.public.profile_institucion
  WHERE estado = 'fraud'
    AND deleted_at IS NULL
),
open_real_loan AS (
  SELECT DISTINCT profile_id
  FROM welli-tecnologia.public.profile_institucion
  WHERE credit_hub IS TRUE
    AND estado IN ('desembolsado', 'fulfilled')
    AND (is_active IS NULL OR is_active = TRUE)
    AND deleted_at IS NULL
),
credits_count AS (
  SELECT profile_id, COUNT(*) AS creditos_desembolsados
  FROM welli-tecnologia.public.profile_institucion
  WHERE credit_hub IS TRUE
    AND estado IN ('desembolsado', 'fulfilled')
    AND deleted_at IS NULL
  GROUP BY profile_id
)
SELECT
  pr.id                                          AS profile_id,
  pr.nombres,
  pr.apellidos,
  pr.documento,
  la.estado                                      AS estado_ultimo_credito,
  la.referencia_pago                             AS referencia_pago_ultimo_credito,
  la.is_active                                   AS is_active_ultimo_credito,
  la.created_on                                  AS fecha_ultimo_credito,
  l.loan_reference,
  l.status                                       AS loan_status,
  COALESCE(cc.creditos_desembolsados, 0)         AS creditos_desembolsados,
FROM latest_app la
JOIN welli-tecnologia.public.profile pr       ON pr.id = la.profile_id
JOIN welli-tecnologia.credit_hub.loan l       ON CAST(l.loan_reference AS STRING) = CAST(la.referencia_pago AS STRING)
LEFT JOIN welli-tecnologia.credit_hub.loan_current_balance lcb ON lcb.loan_id = l.id
LEFT JOIN credits_count cc              ON cc.profile_id = la.profile_id
WHERE la.credit_hub IS TRUE
  AND la.estado IN ('desembolsado', 'fulfilled')
  AND la.is_active IS FALSE
  AND l.deleted IS NOT TRUE
  AND l.status = 'CLOSED'
  AND (lcb.credit_status IS NULL OR lcb.credit_status NOT IN ('ON_DATE', 'LATE'))
  AND NOT EXISTS (SELECT 1 FROM hard_blocked hb  WHERE hb.profile_id = la.profile_id)
  AND NOT EXISTS (SELECT 1 FROM open_real_loan orl WHERE orl.profile_id = la.profile_id)
  AND NOT EXISTS (
    SELECT 1
    FROM welli-tecnologia.credit_hub.loan_daily_balance ldb
    WHERE ldb.loan_id = l.id
      AND ldb.late_days > 60
  )
  AND NOT EXISTS (
    SELECT 1
    FROM welli-tecnologia.credit_hub.payment pm
    JOIN welli-tecnologia.credit_hub.payment_type pt ON pt.id = pm.payment_type_id
    WHERE pm.loan_id = l.id
      AND pt.name = 'CESION_FGA'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM welli-tecnologia.credit_hub.condonation c
    JOIN welli-tecnologia.credit_hub.payment pm ON pm.id = c.payment_id
    JOIN welli-tecnologia.credit_hub.payment_type pt ON pt.id = pm.payment_type_id
    WHERE c.loan_id = l.id
      AND pt.name IN (
        'COLLECTION_AGENCY_CONDONATION',
        'AGREEMENT_HEARING',
        'LIFE_INSURANCE_CONDONATION'
      )
  )
  AND NOT EXISTS (
    SELECT 1
    FROM welli-tecnologia.credit_hub.relief_plan rp
    WHERE rp.loan_id = l.id
      AND rp.status = 'APPLIED'
  )
ORDER BY la.created_on DESC
