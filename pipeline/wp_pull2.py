# -*- coding: utf-8 -*-
"""
Welli Points de verdad, desde welli-growth.wp_data.

El 403 no era falta de acceso a los datos: era falta de bigquery.jobs.create
EN el proyecto welli-growth. El job se crea en welli-data (donde si hay
permiso) y el FROM apunta a welli-growth.wp_data. Mismas credenciales,
mismas 22 tablas.

Tablas que importan:
  wp_incentivos_diario     145k filas, snapshot DIARIO 2026-06-03 -> hoy.
                           wp_ofrecido_mes / wp_ganado_mes son acumulados
                           DEL MES, asi que hay que tomar el ultimo snapshot
                           de cada mes por sede, NO sumar los dias.
  wp_canjeos_solicitados   80 solicitudes de canje, jul y ago 2026
  wellipoints_snapshot     saldo del periodo en curso (2026-08)
  wp_referidos            1 sola fila: el mecanismo de referidos no opera
"""
import lib, json, io

PROY = 'welli-data'          # donde se CREA el job
WP = '`welli-growth.wp_data.%s`'

ULT_MES = """
WITH ult AS (
  SELECT * EXCEPT(rn) FROM (
    SELECT *, FORMAT_DATE('%%Y-%%m', snapshot_date) AS mes,
           ROW_NUMBER() OVER (PARTITION BY id_internal,
                              FORMAT_DATE('%%Y-%%m', snapshot_date)
                              ORDER BY snapshot_date DESC) rn
    FROM %s) WHERE rn = 1)
""" % (WP % 'wp_incentivos_diario')

ULT_HOY = """
WITH ult AS (
  SELECT * EXCEPT(rn) FROM (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY id_internal
                                 ORDER BY snapshot_date DESC) rn
    FROM %s) WHERE rn = 1)
""" % (WP % 'wp_incentivos_diario')

Q_SERIE = ULT_MES + """
SELECT mes,
       COUNT(*) AS sedes,
       COUNTIF(incentivo_ofrecido) AS con_oferta,
       COUNTIF(wp_ganado_mes > 0) AS ganaron,
       SUM(wp_ofrecido_mes) AS wp_ofrecido,
       SUM(wp_ganado_mes) AS wp_ganado,
       SUM(wp_pendiente_actual) AS wp_pendiente
FROM ult GROUP BY mes ORDER BY mes
"""

Q_INC = ULT_HOY + """
SELECT IFNULL(incentivo_principal, '(sin incentivo)') AS incentivo,
       COUNT(*) AS sedes,
       COUNTIF(wp_ganado_mes > 0) AS ganaron,
       SUM(wp_ofrecido_mes) AS wp_ofrecido,
       SUM(wp_ganado_mes) AS wp_ganado,
       COUNTIF(incentivo_expira IS NOT NULL
               AND incentivo_expira >= CURRENT_DATE()) AS vigentes,
       COUNTIF(incentivo_expira IS NOT NULL
               AND incentivo_expira <  CURRENT_DATE()) AS vencidos
FROM ult GROUP BY incentivo ORDER BY sedes DESC
"""

Q_CANJ = """
SELECT CAST(DATE(fecha_solicitud) AS STRING) AS fecha,
       sede_nombre, IFNULL(pipeline, '') AS pipeline,
       pts_solicitados, cop_solicitados,
       IFNULL(formato, '') AS formato, IFNULL(estado, '') AS estado,
       descontado_wp,
       DATE_DIFF(CURRENT_DATE(), DATE(fecha_solicitud), DAY) AS dias
FROM %s ORDER BY fecha_solicitud DESC
""" % (WP % 'wp_canjeos_solicitados')

Q_SALDO = """
SELECT COUNT(*) AS sedes, COUNTIF(wp_total > 0) AS con_saldo,
       SUM(wp_total) AS wp_total, SUM(valor_cop) AS valor_cop,
       SUM(desemb_count) AS desemb, SUM(monto_total) AS monto,
       MAX(periodo) AS periodo
FROM %s
""" % (WP % 'wellipoints_snapshot')

Q_VIG = ULT_HOY + """
SELECT COUNTIF(incentivo_expira IS NOT NULL) AS con_fecha,
       COUNTIF(incentivo_expira IS NOT NULL
               AND incentivo_expira >= CURRENT_DATE()) AS vigentes,
       COUNTIF(incentivo_expira IS NOT NULL
               AND incentivo_expira <  CURRENT_DATE()) AS vencidos,
       COUNT(*) AS sedes,
       COUNTIF(wp_pendiente_actual > 0) AS con_pendiente,
       SUM(wp_pendiente_actual) AS pendiente
FROM ult
"""

Q_REF = """
SELECT COUNT(*) AS n, COUNTIF(id_sede_creada IS NOT NULL) AS vinculados,
       SUM(IFNULL(pts_otorgados, 0)) AS pts
FROM %s
""" % (WP % 'wp_referidos')


def num(v):
    try:
        return int(float(v))
    except Exception:
        return 0


def tabla(filas, cols, casts=None):
    out = [cols]
    for r in filas:
        fila = []
        for c in cols:
            v = r.get(c)
            if casts and c in casts:
                v = casts[c](v)
            fila.append('' if v is None else v)
        out.append(fila)
    return out


if __name__ == '__main__':
    T = {}

    serie = lib.bq(Q_SERIE, project=PROY)
    T['WP_SERIE'] = tabla(serie, ['mes', 'sedes', 'con_oferta', 'ganaron',
                                  'wp_ofrecido', 'wp_ganado', 'wp_pendiente'],
                          {k: num for k in ['sedes', 'con_oferta', 'ganaron',
                                            'wp_ofrecido', 'wp_ganado', 'wp_pendiente']})
    print('=== WP_SERIE ===')
    for f in T['WP_SERIE'][1:]:
        conv = (100.0 * f[5] / f[4]) if f[4] else 0
        print('  %s  sedes %4d  oferta %3d  ganaron %3d  ofr %5d  gan %4d  conv %4.1f%%  pend %6d'
              % (f[0], f[1], f[2], f[3], f[4], f[5], conv, f[6]))

    inc = lib.bq(Q_INC, project=PROY)
    T['WP_INCENTIVO'] = tabla(inc, ['incentivo', 'sedes', 'ganaron', 'wp_ofrecido',
                                    'wp_ganado', 'vigentes', 'vencidos'],
                              {k: num for k in ['sedes', 'ganaron', 'wp_ofrecido',
                                                'wp_ganado', 'vigentes', 'vencidos']})
    print('\n=== WP_INCENTIVO (%d filas) ===' % (len(T['WP_INCENTIVO']) - 1))
    for f in T['WP_INCENTIVO'][1:8]:
        print('  %-44s sedes %5d  ganaron %4d  ofr %5d' % (f[0][:44], f[1], f[2], f[3]))

    canj = lib.bq(Q_CANJ, project=PROY)
    T['WP_CANJES'] = tabla(canj, ['fecha', 'sede_nombre', 'pipeline', 'pts_solicitados',
                                  'cop_solicitados', 'formato', 'estado',
                                  'descontado_wp', 'dias'],
                           {k: num for k in ['pts_solicitados', 'cop_solicitados', 'dias']})
    print('\n=== WP_CANJES (%d filas) ===' % (len(T['WP_CANJES']) - 1))
    estados = {}
    for f in T['WP_CANJES'][1:]:
        estados[f[6]] = estados.get(f[6], 0) + 1
    print('  estados:', estados)

    s = lib.bq(Q_SALDO, project=PROY)[0]
    v = lib.bq(Q_VIG, project=PROY)[0]
    rf = lib.bq(Q_REF, project=PROY)[0]
    tot_canj = sum(f[4] for f in T['WP_CANJES'][1:])
    pts_canj = sum(f[3] for f in T['WP_CANJES'][1:])
    pagados = sum(1 for f in T['WP_CANJES'][1:] if f[6].lower() in ('pagado', 'entregado', 'aprobado'))
    mas_viejo = max([f[8] for f in T['WP_CANJES'][1:]] or [0])

    T['WP_KPI2'] = [
        ['metrica', 'valor', 'fuente', 'nota'],
        ['Sedes en el programa', num(v['sedes']),
         'BigQuery welli-growth.wp_data.wp_incentivos_diario', 'ultimo snapshot diario'],
        ['Sedes con saldo de puntos', num(s['con_saldo']),
         'BigQuery wellipoints_snapshot', 'periodo ' + str(s['periodo'])],
        ['Puntos del periodo', num(s['wp_total']), 'BigQuery wellipoints_snapshot', ''],
        ['Valor de esos puntos', num(s['valor_cop']), 'BigQuery wellipoints_snapshot',
         'a 2.000 COP por punto'],
        ['Incentivos con fecha de vencimiento', num(v['con_fecha']),
         'BigQuery wp_incentivos_diario', ''],
        ['Incentivos vigentes', num(v['vigentes']), 'BigQuery wp_incentivos_diario', ''],
        ['Incentivos vencidos', num(v['vencidos']), 'BigQuery wp_incentivos_diario', ''],
        ['Canjes solicitados', len(T['WP_CANJES']) - 1,
         'BigQuery wp_canjeos_solicitados', ''],
        ['Puntos canjeados', pts_canj, 'BigQuery wp_canjeos_solicitados', ''],
        ['Plata comprometida en canjes', tot_canj,
         'BigQuery wp_canjeos_solicitados', 'cop_solicitados'],
        ['Canjes pagados', pagados, 'BigQuery wp_canjeos_solicitados',
         'estados que cuentan como pagado: pagado / entregado / aprobado'],
        ['Dias del canje mas viejo sin pagar', mas_viejo,
         'BigQuery wp_canjeos_solicitados', ''],
        ['Referidos registrados por WP', num(rf['n']),
         'BigQuery wp_referidos', 'tabla practicamente vacia'],
        ['Referidos vinculados', num(rf['vinculados']), 'BigQuery wp_referidos', ''],
    ]
    print('\n=== WP_KPI2 ===')
    for f in T['WP_KPI2'][1:]:
        print('  %-38s %s' % (f[0], f[1]))

    json.dump(T, io.open('tables_wp2.json', 'w', encoding='utf8'), ensure_ascii=False)
    print('\nescrito tables_wp2.json')
