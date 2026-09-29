# -*- coding: utf-8 -*-
"""
Siembra las hojas de BigQuery del Sheet: CONVERSION, REVENUE, RESCATE_BQ.

El SQL es EL MISMO que quedo en apps_script/Fuentes_BigQuery.gs, para que la
carga inicial y el refresh diario produzcan exactamente las mismas cifras.
"""
import lib, json, io, sys

DESDE = '2026-01-01'

SQL_CONVERSION = """
WITH base AS (
  SELECT
    id,
    DATE(created_on) AS fecha_solicitud,
    CASE
      WHEN estado IN ('on_hold_rejected','rejected_validation','risk_in_process',
                      'rejected','fraud','creada','on_hold_approved','on_hold_docs')
        THEN 'Rechazado'
      WHEN estado IN ('firma_contrato','approved','not_taken')
        THEN 'Aprobado'
      -- 'dismissed' SACADO (9-sep-2026): rechazo, no desembolso.
      WHEN estado IN ('pendiente_aprobacion_medico','desembolsado',
                      'pendiente_validacion_cliente','fulfilled',
                      'pendiente_desembolso')
        THEN 'Convertido'
      ELSE 'Otro'
    END AS estado_final
  FROM `welli-tecnologia.public.profile_institucion`
  WHERE medico_id IS NOT NULL
    AND DATE(created_on) >= '%(desde)s'
),
flags AS (
  SELECT *,
    CASE WHEN estado_final IN ('Aprobado','Convertido') THEN 1 ELSE 0 END AS flag_aprobado,
    CASE WHEN estado_final = 'Convertido' THEN 1 ELSE 0 END AS flag_convertido
  FROM base
)
SELECT fecha_solicitud,
       COUNT(*) AS solicitudes,
       SUM(flag_aprobado) AS aprobados,
       SUM(flag_convertido) AS convertidos
FROM flags
GROUP BY fecha_solicitud
ORDER BY fecha_solicitud
""" % {'desde': DESDE}

SQL_REVENUE = """
WITH otp AS (
  SELECT application_id, MAX(validated_on) AS validated_on
  FROM `welli-tecnologia.public.otp_log`
  GROUP BY application_id
)
SELECT DATE(otp.validated_on) AS validated_on,
       COUNT(*) AS creditos,
       SUM(pi.monto) AS monto_credito
FROM `welli-tecnologia.public.profile_institucion` AS pi
LEFT JOIN otp ON otp.application_id = pi.id
WHERE pi.estado IN (
    'firma_contrato','pendiente_validacion_cliente','in_progress_validation_client',
    'pendiente_aprobacion_medico','pendiente_desembolso','pendiente_validacion',
    'approved','on_hold_approved','on_hold_rejected','desembolsado')
  AND DATE(otp.validated_on) >= '%(desde)s'
GROUP BY validated_on
ORDER BY validated_on
""" % {'desde': DESDE}

SQL_RESCATE = """
WITH aprob AS (
  SELECT
    id,
    medico AS sede,
    monto,
    fecha_solicitud_desembolso,
    (SELECT MIN(DATE(TIMESTAMP(JSON_VALUE(c, "$.timestamp"))))
     FROM UNNEST(JSON_QUERY_ARRAY(cambios)) AS c
     WHERE JSON_VALUE(c, "$.estado") = "approved") AS fecha_aprobado
  FROM `welli-tecnologia.public.profile_institucion`
  WHERE estado = 'desembolsado'
    AND fecha_solicitud_desembolso IS NOT NULL
    AND DATE(fecha_solicitud_desembolso) >= '%(desde)s'
)
SELECT DATE(fecha_solicitud_desembolso) AS fecha_desembolso,
       sede,
       monto,
       DATE_DIFF(DATE(fecha_solicitud_desembolso), fecha_aprobado, DAY) AS dias,
       CASE
         WHEN DATE_DIFF(DATE(fecha_solicitud_desembolso), fecha_aprobado, DAY) < 15
           THEN 'corta'
         WHEN DATE_DIFF(DATE(fecha_solicitud_desembolso), fecha_aprobado, DAY) <= 30
           THEN 'media'
         ELSE 'larga'
       END AS ventana
FROM aprob
WHERE fecha_aprobado IS NOT NULL
ORDER BY fecha_desembolso
""" % {'desde': DESDE}


def n(v):
    try:
        return float(v)
    except Exception:
        return 0.0


def pull_conversion():
    r = lib.bq(SQL_CONVERSION)
    filas = [['fecha_solicitud', 'solicitudes', 'aprobados', 'convertidos']]
    for f in r:
        filas.append([str(f['fecha_solicitud'])[:10], int(n(f['solicitudes'])),
                      int(n(f['aprobados'])), int(n(f['convertidos']))])
    return filas


def pull_revenue():
    r = lib.bq(SQL_REVENUE)
    filas = [['validated_on', 'creditos', 'monto_credito']]
    for f in r:
        filas.append([str(f['validated_on'])[:10], int(n(f['creditos'])),
                      round(n(f['monto_credito']))])
    return filas


def pull_rescate():
    r = lib.bq(SQL_RESCATE)
    filas = [['fecha_desembolso', 'sede', 'monto', 'dias_aprobado_a_desembolso', 'ventana']]
    for f in r:
        filas.append([str(f['fecha_desembolso'])[:10], f.get('sede') or '',
                      round(n(f['monto'])), int(n(f['dias'])), f.get('ventana') or ''])
    return filas


if __name__ == '__main__':
    out = {}
    for nombre, fn in [('CONVERSION', pull_conversion), ('REVENUE', pull_revenue),
                       ('RESCATE_BQ', pull_rescate)]:
        try:
            out[nombre] = fn()
            print('%-12s %6d filas' % (nombre, len(out[nombre]) - 1))
        except Exception as e:
            print('%-12s FALLO %s' % (nombre, str(e)[:300]))
    json.dump(out, io.open('tables_bq.json', 'w', encoding='utf8'), ensure_ascii=False)

    # resumenes para validar contra las cifras conocidas
    if 'CONVERSION' in out:
        f = out['CONVERSION'][1:]
        s = sum(r[1] for r in f); a = sum(r[2] for r in f); c = sum(r[3] for r in f)
        print('\nCONVERSION 2026: solicitudes %d -> aprobados %d (%.1f%%) -> convertidos %d (%.1f%%)'
              % (s, a, 100.0 * a / s if s else 0, c, 100.0 * c / s if s else 0))
    if 'REVENUE' in out:
        f = out['REVENUE'][1:]
        cr = sum(r[1] for r in f); m = sum(r[2] for r in f)
        print('REVENUE 2026: %d creditos, $%s COP, ticket $%s'
              % (cr, format(int(m), ',').replace(',', '.'),
                 format(int(m / cr) if cr else 0, ',').replace(',', '.')))
        print('  rango de fechas: %s a %s' % (f[0][0], f[-1][0]))
    if 'RESCATE_BQ' in out:
        f = out['RESCATE_BQ'][1:]
        import collections
        v = collections.Counter()
        mv = collections.Counter()
        for r in f:
            v[r[4]] += 1
            mv[r[4]] += r[2]
        print('RESCATE 2026 por ventana:')
        for k in ['corta', 'media', 'larga']:
            print('  %-6s %5d desembolsos  $%s' % (k, v[k],
                  format(int(mv[k]), ',').replace(',', '.')))
