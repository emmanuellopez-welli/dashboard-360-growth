# -*- coding: utf-8 -*-
"""
Rescate con la definicion correcta del negocio.

Hallazgo que obliga a redefinir: el 96% de los desembolsos ocurren en menos
de 15 dias desde la aprobacion. Entonces "ventana corta" medida desde la
aprobacion NO es rescate, es el flujo normal. Rescate = el paciente dejo
pasar la ventana normal (>30 dias) y aun asi desembolso.

Las ventanas corta/media que pide el prompt se miden desde el CONTACTO, no
desde la aprobacion, y eso exige cruzar Hilos con BigQuery por telefono:
queda marcado como pendiente, no inventado.

Produce dos hojas:
  RESCATE_BQ         un desembolso por fila, con dias y balde
  PLATA_SOBRE_MESA   inventario vivo de aprobado-no-tomado, en COP y por antiguedad
"""
import lib, json, io, collections

DESDE = '2026-01-01'

SQL_DESEMBOLSOS = """
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
SELECT
  DATE(fecha_solicitud_desembolso) AS fecha_desembolso,
  sede,
  monto,
  DATE_DIFF(DATE(fecha_solicitud_desembolso), fecha_aprobado, DAY) AS dias,
  CASE
    WHEN DATE_DIFF(DATE(fecha_solicitud_desembolso), fecha_aprobado, DAY) <= 15
      THEN 'normal_0_15'
    WHEN DATE_DIFF(DATE(fecha_solicitud_desembolso), fecha_aprobado, DAY) <= 30
      THEN 'normal_16_30'
    WHEN DATE_DIFF(DATE(fecha_solicitud_desembolso), fecha_aprobado, DAY) <= 60
      THEN 'rescate_31_60'
    ELSE 'rescate_60_mas'
  END AS balde
FROM aprob
WHERE fecha_aprobado IS NOT NULL
ORDER BY fecha_desembolso
""" % {'desde': DESDE}

# Plata sobre la mesa: credito aprobado que el paciente NO tomo, vivo hoy.
# Se agrupa por antiguedad de la aprobacion, que es lo que decide la
# accionabilidad: lo fresco se rescata, lo viejo casi no.
SQL_PLATA = """
WITH aprob AS (
  SELECT
    id,
    medico AS sede,
    medico_id,
    estado,
    COALESCE(monto_aprobado, monto) AS monto_aprobado,
    (SELECT MIN(DATE(TIMESTAMP(JSON_VALUE(c, "$.timestamp"))))
     FROM UNNEST(JSON_QUERY_ARRAY(cambios)) AS c
     WHERE JSON_VALUE(c, "$.estado") = "approved") AS fecha_aprobado
  FROM `welli-tecnologia.public.profile_institucion`
  WHERE estado IN ('approved', 'not_taken', 'firma_contrato')
)
SELECT
  CASE
    WHEN DATE_DIFF(CURRENT_DATE(), fecha_aprobado, DAY) <= 15  THEN '1. 0-15 dias'
    WHEN DATE_DIFF(CURRENT_DATE(), fecha_aprobado, DAY) <= 30  THEN '2. 16-30 dias'
    WHEN DATE_DIFF(CURRENT_DATE(), fecha_aprobado, DAY) <= 60  THEN '3. 31-60 dias'
    WHEN DATE_DIFF(CURRENT_DATE(), fecha_aprobado, DAY) <= 180 THEN '4. 61-180 dias'
    ELSE '5. mas de 180 dias'
  END AS antiguedad,
  COUNT(*) AS creditos,
  SUM(monto_aprobado) AS monto,
  COUNT(DISTINCT medico_id) AS sedes
FROM aprob
WHERE fecha_aprobado IS NOT NULL
GROUP BY antiguedad
ORDER BY antiguedad
"""

# Las sedes con mas plata sobre la mesa: es la lista de trabajo comercial.
SQL_PLATA_SEDES = """
WITH aprob AS (
  SELECT
    medico AS sede,
    COALESCE(monto_aprobado, monto) AS monto_aprobado,
    (SELECT MIN(DATE(TIMESTAMP(JSON_VALUE(c, "$.timestamp"))))
     FROM UNNEST(JSON_QUERY_ARRAY(cambios)) AS c
     WHERE JSON_VALUE(c, "$.estado") = "approved") AS fecha_aprobado
  FROM `welli-tecnologia.public.profile_institucion`
  WHERE estado IN ('approved', 'not_taken', 'firma_contrato')
)
SELECT
  sede,
  COUNT(*) AS creditos,
  SUM(monto_aprobado) AS monto,
  SUM(CASE WHEN DATE_DIFF(CURRENT_DATE(), fecha_aprobado, DAY) <= 30
           THEN 1 ELSE 0 END) AS creditos_30d,
  SUM(CASE WHEN DATE_DIFF(CURRENT_DATE(), fecha_aprobado, DAY) <= 30
           THEN monto_aprobado ELSE 0 END) AS monto_30d
FROM aprob
WHERE fecha_aprobado IS NOT NULL AND sede IS NOT NULL
GROUP BY sede
ORDER BY monto DESC
LIMIT 300
"""


def n(v):
    try:
        return float(v)
    except Exception:
        return 0.0


def cop(x):
    return '$' + format(int(x), ',').replace(',', '.')


if __name__ == '__main__':
    out = {}

    r = lib.bq(SQL_DESEMBOLSOS)
    filas = [['fecha_desembolso', 'sede', 'monto', 'dias_aprobado_a_desembolso', 'balde']]
    for f in r:
        filas.append([str(f['fecha_desembolso'])[:10], f.get('sede') or '',
                      round(n(f['monto'])), int(n(f['dias'])), f.get('balde') or ''])
    out['RESCATE_BQ'] = filas
    print('RESCATE_BQ %d filas' % (len(filas) - 1))

    b = collections.Counter()
    mb = collections.Counter()
    for x in filas[1:]:
        b[x[4]] += 1
        mb[x[4]] += x[2]
    tot = sum(b.values())
    print('\nDESEMBOLSOS 2026 por tiempo desde la aprobacion:')
    for k in ['normal_0_15', 'normal_16_30', 'rescate_31_60', 'rescate_60_mas']:
        print('  %-15s %6d (%5.1f%%)  %s' % (k, b[k], 100.0 * b[k] / tot if tot else 0, cop(mb[k])))
    resc = b['rescate_31_60'] + b['rescate_60_mas']
    mresc = mb['rescate_31_60'] + mb['rescate_60_mas']
    print('  -> RESCATADOS (>30 dias): %d desembolsos, %s' % (resc, cop(mresc)))

    p = lib.bq(SQL_PLATA)
    fp = [['antiguedad', 'creditos', 'monto', 'sedes']]
    print('\nPLATA SOBRE LA MESA (aprobado no tomado, vivo hoy):')
    tm = 0
    tc = 0
    for f in p:
        fp.append([f['antiguedad'], int(n(f['creditos'])), round(n(f['monto'])),
                   int(n(f['sedes']))])
        tm += n(f['monto'])
        tc += n(f['creditos'])
        print('  %-20s %6d creditos  %s  (%s sedes)'
              % (f['antiguedad'], int(n(f['creditos'])), cop(n(f['monto'])), f['sedes']))
    print('  TOTAL: %d creditos, %s' % (tc, cop(tm)))
    out['PLATA_SOBRE_MESA'] = fp

    ps = lib.bq(SQL_PLATA_SEDES)
    fps = [['sede', 'creditos', 'monto', 'creditos_30d', 'monto_30d']]
    for f in ps:
        fps.append([f.get('sede') or '', int(n(f['creditos'])), round(n(f['monto'])),
                    int(n(f['creditos_30d'])), round(n(f['monto_30d']))])
    out['PLATA_SEDES'] = fps
    print('\nPLATA_SEDES %d sedes. Top 5:' % (len(fps) - 1))
    for x in fps[1:6]:
        print('  %-42s %4d creditos  %s' % (x[0][:42], x[1], cop(x[2])))

    json.dump(out, io.open('tables_bq.json', 'w', encoding='utf8'), ensure_ascii=False)
