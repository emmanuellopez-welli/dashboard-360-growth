# -*- coding: utf-8 -*-
"""
Reconstruye la definicion de "rescatado" que usa rescatados.resumen().

No tengo el modulo, asi que la ajusto contra los numeros que el correo del
2-sep ya publico: 133 rescatados y $892 M en 30 dias, y 2 / $23 M el 1-sep.
Si una definicion reproduce las dos ventanas, es la buena.

FIRMADO = el credito paso de aprobado a un estado de firma. RESCATE = esa
firma ocurrio pasada la ventana de decision inmediata: el 88,3% de los
desembolsos ocurre en los primeros 3 dias, asi que lo que se firma del dia 4
en adelante es el territorio del rescate.
"""
import rq

FIRMADOS = ("'desembolsado','pendiente_desembolso','firma_contrato',"
            "'fulfilled','pendiente_aprobacion_medico'")

# La fecha de la firma: se prueban las dos candidatas del esquema.
CANDIDATAS = [
    ('fecha_solicitud_desembolso, corte >=4d', 'DATE(fecha_solicitud_desembolso)', 4),
    ('fecha_solicitud_desembolso, sin corte', 'DATE(fecha_solicitud_desembolso)', 0),
    ('updated, corte >=4d', 'DATE(updated)', 4),
    ('updated, sin corte', 'DATE(updated)', 0),
]

for etq, fcol, corte in CANDIDATAS:
    sql = """
    WITH f AS (
      SELECT id, monto_aprobado, DATE(created) AS creado,
             %s AS firmado
      FROM `welli-tecnologia.public.profile_institucion`
      WHERE estado IN (%s)
        AND country_code = 'COL'
        AND %s IS NOT NULL)
    SELECT
      COUNTIF(firmado BETWEEN '2026-08-04' AND '2026-09-02') AS n30,
      CAST(ROUND(SUM(IF(firmado BETWEEN '2026-08-04' AND '2026-09-02',
                        monto_aprobado, 0))/1e6) AS STRING) AS m30,
      COUNTIF(firmado = '2026-09-01') AS n1,
      CAST(ROUND(SUM(IF(firmado = '2026-09-01', monto_aprobado, 0))/1e6)
           AS STRING) AS m1
    FROM f
    WHERE DATE_DIFF(firmado, creado, DAY) >= %d
    """ % (fcol, FIRMADOS, fcol, corte)
    try:
        r = rq.q(sql, proy='welli-tecnologia', loc='us-central1')[0]
        print('  %-42s 30d: %5s casos $%6s M   |  1-sep: %3s casos $%4s M'
              % (etq, r['n30'], r['m30'], r['n1'], r['m1']))
    except Exception as e:
        print('  %-42s ERROR %s' % (etq, str(e)[:90]))

print('\n  objetivo del correo del 2-sep:            30d:   133 casos $   892 M'
      '   |  1-sep:   2 casos $  23 M')
