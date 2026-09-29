# -*- coding: utf-8 -*-
"""Hipotesis: el bucket 'Muerto' de la query de la jefa mezcla DOS
poblaciones distintas -- (a) sedes que aplicaron alguna vez y llevan 90+
dias sin volver, y (b) sedes que NUNCA aplicaron y fueron creadas hace
90+ dias. Nuestra 'muertas' solo cuenta (a): el universo de
SEDE_ESTADO_MES exige apps_acum>0. Si (b) es grande, explica el gap
persistente incluso en meses ya cerrados."""
import lib, io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

Q = """
WITH t_instituciones AS (
  SELECT id AS id_sede, DATE(created) AS created
  FROM `welli-tecnologia.public.institucion_medica`
  WHERE COALESCE(deshabilidato, FALSE) = FALSE
),
apps_base AS (
  SELECT DISTINCT app.medico_id AS id_sede
  FROM `welli-tecnologia.public.profile_institucion` app
)
SELECT
  COUNT(*) AS total_habilitadas,
  COUNTIF(a.id_sede IS NULL) AS nunca_aplico,
  COUNTIF(a.id_sede IS NULL AND DATE_DIFF(CURRENT_DATE(), i.created, DAY) >= 90) AS nunca_aplico_90d,
  COUNTIF(a.id_sede IS NULL AND DATE_DIFF(CURRENT_DATE(), i.created, DAY) BETWEEN 31 AND 89) AS nunca_aplico_30_90d
FROM t_instituciones i
LEFT JOIN apps_base a ON a.id_sede = i.id_sede
"""
r = lib.bq(Q, project='welli-tecnologia')[0]
print(r)
