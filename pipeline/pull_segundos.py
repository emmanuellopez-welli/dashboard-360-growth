# -*- coding: utf-8 -*-
"""
Frente 8 - Segundos creditos (28-sep-2026).

Producto nuevo: un paciente que ya pago y cerro su primer credito, con buen
comportamiento de pago, puede tomar un segundo credito. Dos hojas:

  SEG_ELEGIBLES    un paciente por fila, los que HOY pueden tomar un 2do
                   credito (foto, no tiene fecha propia)
  SEG_SOLICITUDES  una solicitud de 2do credito por fila, con fecha

Las dos queries salieron de Emmanuel (son las oficiales del negocio). Lo que
se agrego aca es la especialidad de la sede del credito ANTERIOR, que la
query original no traia y es la que arma el Sankey de cross-selling
(especialidad del 1er credito -> especialidad del 2do).

--- Tres cosas que hay que entender antes de tocar esto ---

1. LAS DOS POBLACIONES SON DISJUNTAS POR CONSTRUCCION. La query de elegibles
   se para sobre `latest_app` (la solicitud MAS RECIENTE del paciente), asi
   que apenas alguien aplica a su segundo credito su ultima solicitud pasa a
   ser la nueva y SE CAE del pool de elegibles. Verificado el 28-sep-2026:
   0 de los 19 que ya aplicaron aparecen entre los 8.696 elegibles.

   Consecuencia: el denominador honesto de conversion es
   `elegibles + ya_aplicaron`, NUNCA `elegibles` solo. Si se arma como
   "19 de 8.696", la tasa se ve cada vez mejor sola a medida que el programa
   funciona, porque el denominador se encoge mientras el numerador crece.
   Es la misma familia de error que la seccion 7 de CLAUDE.md.

2. "DESEMBOLSO" USA LA MISMA DEFINICION QUE EL RESTO DEL TABLERO, no una
   propia. `pull_credito_dia.py` define convertido/desembolsado como
   estado IN ('pendiente_aprobacion_medico','desembolsado',
   'pendiente_validacion_cliente','fulfilled','pendiente_desembolso'), SIN
   'dismissed' (seccion 11: dismissed es un rechazo, nunca fue plata real).
   Se copia igual aca a proposito: si F8 usara su propia definicion, el
   mismo credito se contaria distinto en F1 y en F8 y nadie sabria cual creer.

3. LAS DOS SERIES DE LA LINEA DE TIEMPO SE FECHAN POR `created_on` (el dia
   que el paciente aplico), las dos. Existe `fecha_solicitud_desembolso`,
   pero fechar las solicitudes por un campo y los desembolsos por otro deja
   las dos series midiendo universos distintos en el mismo grafico (el error
   de la seccion 28) y permite un desembolso en un dia sin solicitudes. Con
   las dos por fecha de solicitud, "desembolsos" es literalmente el
   subconjunto que convirtio, siempre por debajo -- que es como ya lo hace
   CREDITO_DIA para todo el resto del tablero.
"""
import io
import json

import lib

# Copiado LITERAL de pull_credito_dia.py a proposito (ver nota 2 del docstring).
ESTADOS_CONV = ('pendiente_aprobacion_medico', 'desembolsado',
                'pendiente_validacion_cliente', 'fulfilled', 'pendiente_desembolso')

SQL_ELEGIBLES = """
WITH ranked AS (
  SELECT pi.*, ROW_NUMBER() OVER (
           PARTITION BY pi.profile_id ORDER BY pi.created_on DESC, pi.id DESC) AS rn
  FROM `welli-tecnologia.public.profile_institucion` pi
  WHERE pi.deleted_at IS NULL
),
latest_app AS (SELECT * FROM ranked WHERE rn = 1),
hard_blocked AS (
  SELECT DISTINCT profile_id FROM `welli-tecnologia.public.profile_institucion`
  WHERE estado = 'fraud' AND deleted_at IS NULL
),
open_real_loan AS (
  SELECT DISTINCT profile_id FROM `welli-tecnologia.public.profile_institucion`
  WHERE credit_hub IS TRUE AND estado IN ('desembolsado', 'fulfilled')
    AND (is_active IS NULL OR is_active = TRUE) AND deleted_at IS NULL
)
SELECT
  CAST(la.medico_id AS STRING)               AS id_sede,
  COALESCE(im.especialidad, '(sin especialidad)') AS especialidad,
  CAST(COALESCE(la.monto_aprobado, la.monto, 0) AS INT64) AS monto
FROM latest_app la
JOIN `welli-tecnologia.public.profile` pr ON pr.id = la.profile_id
JOIN `welli-tecnologia.credit_hub.loan` l
  ON CAST(l.loan_reference AS STRING) = CAST(la.referencia_pago AS STRING)
LEFT JOIN `welli-tecnologia.credit_hub.loan_current_balance` lcb ON lcb.loan_id = l.id
LEFT JOIN `welli-tecnologia.public.institucion_medica` im
  ON im.id = CAST(la.medico_id AS STRING)
WHERE la.credit_hub IS TRUE
  AND la.estado IN ('desembolsado', 'fulfilled')
  AND la.is_active IS FALSE
  AND l.deleted IS NOT TRUE
  AND l.status = 'CLOSED'
  AND (lcb.credit_status IS NULL OR lcb.credit_status NOT IN ('ON_DATE', 'LATE'))
  AND NOT EXISTS (SELECT 1 FROM hard_blocked hb WHERE hb.profile_id = la.profile_id)
  AND NOT EXISTS (SELECT 1 FROM open_real_loan o WHERE o.profile_id = la.profile_id)
  AND NOT EXISTS (
    SELECT 1 FROM `welli-tecnologia.credit_hub.loan_daily_balance` ldb
    WHERE ldb.loan_id = l.id AND ldb.late_days > 60)
  AND NOT EXISTS (
    SELECT 1 FROM `welli-tecnologia.credit_hub.payment` pm
    JOIN `welli-tecnologia.credit_hub.payment_type` pt ON pt.id = pm.payment_type_id
    WHERE pm.loan_id = l.id AND pt.name = 'CESION_FGA')
  AND NOT EXISTS (
    SELECT 1 FROM `welli-tecnologia.credit_hub.condonation` c
    JOIN `welli-tecnologia.credit_hub.payment` pm ON pm.id = c.payment_id
    JOIN `welli-tecnologia.credit_hub.payment_type` pt ON pt.id = pm.payment_type_id
    WHERE c.loan_id = l.id AND pt.name IN (
      'COLLECTION_AGENCY_CONDONATION', 'AGREEMENT_HEARING', 'LIFE_INSURANCE_CONDONATION'))
  AND NOT EXISTS (
    SELECT 1 FROM `welli-tecnologia.credit_hub.relief_plan` rp
    WHERE rp.loan_id = l.id AND rp.status = 'APPLIED')
"""

# is_recurrence lo marca el motor de riesgo: es la senal oficial de "esta
# solicitud es un segundo credito", no una inferencia nuestra.
SQL_SOLICITUDES = """
WITH oficial AS (
  SELECT pr.profile_institucion_id,
         JSON_EXTRACT(pr.engine_decision, '$.antecedent_loans') AS antecedent_loans
  FROM `welli-tecnologia.public.profile_risk` pr
  WHERE SAFE_CAST(JSON_VALUE(pr.engine_decision, '$.is_recurrence') AS BOOL) IS TRUE
)
SELECT
  CAST(DATE(app.created, 'America/Bogota') AS STRING)  AS fecha,
  app.estado                                           AS estado,
  CAST(app.medico_id AS STRING)                        AS id_sede,
  COALESCE(im.especialidad, '(sin especialidad)')      AS especialidad,
  CAST(ant.medico_id AS STRING)                        AS id_sede_ant,
  COALESCE(im_a.especialidad, '(sin especialidad)')    AS especialidad_ant,
  CAST(COALESCE(app.monto_aprobado, app.monto, 0) AS INT64) AS monto,
  CAST(COALESCE(im_a.id = im.id, FALSE) AS INT64)      AS misma_sede
FROM oficial o
JOIN `welli-tecnologia.public.profile_institucion` app ON app.id = o.profile_institucion_id
LEFT JOIN `welli-tecnologia.public.institucion_medica` im
  ON im.id = CAST(app.medico_id AS STRING)
LEFT JOIN `welli-tecnologia.public.profile_institucion` ant
  ON ant.id = JSON_VALUE(o.antecedent_loans, '$[0].application_id')
LEFT JOIN `welli-tecnologia.public.institucion_medica` im_a
  ON im_a.id = CAST(ant.medico_id AS STRING)
ORDER BY fecha
"""


def main():
    ele = lib.bq(SQL_ELEGIBLES, project='welli-tecnologia')
    print('SEG_ELEGIBLES: %d pacientes aptos para 2do credito' % len(ele))

    sol = lib.bq(SQL_SOLICITUDES, project='welli-tecnologia')
    print('SEG_SOLICITUDES: %d solicitudes de 2do credito' % len(sol))

    T = {}
    T['SEG_ELEGIBLES'] = [['id_sede', 'especialidad', 'monto']] + [
        [r['id_sede'] or '', r['especialidad'], int(r['monto'] or 0)] for r in ele]

    cab = ['fecha', 'estado', 'id_sede', 'especialidad', 'id_sede_ant',
           'especialidad_ant', 'monto', 'misma_sede']
    T['SEG_SOLICITUDES'] = [cab] + [
        [r['fecha'], r['estado'], r['id_sede'] or '', r['especialidad'],
         r['id_sede_ant'] or '', r['especialidad_ant'], int(r['monto'] or 0),
         int(r['misma_sede'] or 0)] for r in sol]

    json.dump(T, io.open('tables_segundos.json', 'w', encoding='utf8'),
              ensure_ascii=False)
    print('escrito tables_segundos.json')

    # --- CUADRE, para leerlo a ojo antes de subir ---
    conv = [r for r in sol if r['estado'] in ESTADOS_CONV]
    print()
    print('CUADRE')
    print('  elegibles hoy            %d' % len(ele))
    print('  ya aplicaron a 2do       %d' % len(sol))
    print('  denominador honesto      %d  (elegibles + ya aplicaron)' % (len(ele) + len(sol)))
    print('  desembolsos (conv)       %d' % len(conv))
    print('  plata desembolsada       $%s' % '{:,.0f}'.format(
        sum(int(r['monto'] or 0) for r in conv)))
    if sol:
        print('  rango de solicitudes     %s -> %s' % (sol[0]['fecha'], sol[-1]['fecha']))
        print('  misma sede               %d de %d' % (
            sum(1 for r in sol if int(r['misma_sede'] or 0)), len(sol)))
    import collections
    est = collections.Counter(r['estado'] for r in sol)
    print('  estados                  %s' % dict(est))
    cross = collections.Counter(
        (r['especialidad_ant'], r['especialidad']) for r in sol)
    print('  rutas de especialidad (top 8):')
    for (a, b), n in cross.most_common(8):
        print('     %-28s -> %-28s %d' % (a[:28], b[:28], n))


if __name__ == '__main__':
    main()
