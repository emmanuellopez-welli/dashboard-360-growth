# -*- coding: utf-8 -*-
"""
Rehace F4 con la regla real: el credito de WELLI vive 30 dias.

Consecuencias:
 - Aprobado sin firmar con <=30 dias  = OPORTUNIDAD VIVA (se puede rescatar)
 - Aprobado sin firmar con >30 dias   = VENCIDO (ya no se puede tomar)
   -> no es "plata sobre la mesa", es fuga historica
 - Rescatado = firmo entre el dia 16 y el 30, o sea iba camino a vencerse
   y se convirtio. Ventana corta 0-15, ventana media 16-30.
 - Un desembolso a mas de 30 dias de la aprobacion NO deberia existir:
   se investiga si son re-aprobaciones.
"""
import lib, json, io, collections

BASE_APROB = """
WITH aprob AS (
  SELECT
    id,
    medico AS sede,
    medico_id,
    estado,
    COALESCE(monto_aprobado, monto) AS monto_aprobado,
    fecha_solicitud_desembolso,
    (SELECT MIN(DATE(TIMESTAMP(JSON_VALUE(c, "$.timestamp"))))
     FROM UNNEST(JSON_QUERY_ARRAY(cambios)) AS c
     WHERE JSON_VALUE(c, "$.estado") = "approved") AS fecha_aprobado,
    (SELECT COUNT(*)
     FROM UNNEST(JSON_QUERY_ARRAY(cambios)) AS c
     WHERE JSON_VALUE(c, "$.estado") = "approved") AS veces_aprobado
  FROM `welli-tecnologia.public.profile_institucion`
"""

# 1) Inventario vivo vs vencido
SQL_INV = BASE_APROB + """
  WHERE estado IN ('approved', 'not_taken', 'firma_contrato')
)
SELECT
  CASE WHEN DATE_DIFF(CURRENT_DATE(), fecha_aprobado, DAY) <= 30
       THEN 'VIVO' ELSE 'VENCIDO' END AS situacion,
  CASE
    WHEN DATE_DIFF(CURRENT_DATE(), fecha_aprobado, DAY) <= 15 THEN '1. 0-15 dias'
    WHEN DATE_DIFF(CURRENT_DATE(), fecha_aprobado, DAY) <= 30 THEN '2. 16-30 dias'
    WHEN DATE_DIFF(CURRENT_DATE(), fecha_aprobado, DAY) <= 60 THEN '3. 31-60 dias'
    WHEN DATE_DIFF(CURRENT_DATE(), fecha_aprobado, DAY) <= 180 THEN '4. 61-180 dias'
    ELSE '5. mas de 180 dias'
  END AS antiguedad,
  COUNT(*) AS creditos,
  SUM(monto_aprobado) AS monto,
  COUNT(DISTINCT medico_id) AS sedes
FROM aprob
WHERE fecha_aprobado IS NOT NULL
GROUP BY situacion, antiguedad
ORDER BY antiguedad
"""

# 2) Desembolsos por dias a la firma + si hubo re-aprobacion
SQL_FIRMA = BASE_APROB + """
  WHERE estado = 'desembolsado'
    AND fecha_solicitud_desembolso IS NOT NULL
    AND DATE(fecha_solicitud_desembolso) >= '2026-01-01'
)
SELECT
  CASE
    WHEN DATE_DIFF(DATE(fecha_solicitud_desembolso), fecha_aprobado, DAY) <= 15
      THEN 'ventana_corta_0_15'
    WHEN DATE_DIFF(DATE(fecha_solicitud_desembolso), fecha_aprobado, DAY) <= 30
      THEN 'ventana_media_16_30'
    ELSE 'fuera_de_ventana_mas_30'
  END AS balde,
  veces_aprobado > 1 AS re_aprobado,
  COUNT(*) AS creditos,
  SUM(monto) AS monto
FROM aprob
WHERE fecha_aprobado IS NOT NULL
GROUP BY balde, re_aprobado
ORDER BY balde, re_aprobado
"""

# 3) Sedes con oportunidad VIVA (<=30 dias). Esta es la cola de trabajo real.
SQL_SEDES_VIVAS = BASE_APROB + """
  WHERE estado IN ('approved', 'not_taken', 'firma_contrato')
)
SELECT
  sede,
  COUNT(*) AS creditos,
  SUM(monto_aprobado) AS monto,
  SUM(CASE WHEN DATE_DIFF(CURRENT_DATE(), fecha_aprobado, DAY) <= 15
           THEN 1 ELSE 0 END) AS creditos_0_15,
  MIN(30 - DATE_DIFF(CURRENT_DATE(), fecha_aprobado, DAY)) AS dias_min_restantes
FROM aprob
WHERE fecha_aprobado IS NOT NULL
  AND DATE_DIFF(CURRENT_DATE(), fecha_aprobado, DAY) <= 30
  AND sede IS NOT NULL
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

    print('=== 1. INVENTARIO: VIVO vs VENCIDO ===')
    inv = lib.bq(SQL_INV)
    filas = [['situacion', 'antiguedad', 'creditos', 'monto', 'sedes']]
    tot = collections.Counter()
    totm = collections.Counter()
    for f in inv:
        filas.append([f['situacion'], f['antiguedad'], int(n(f['creditos'])),
                      round(n(f['monto'])), int(n(f['sedes']))])
        tot[f['situacion']] += int(n(f['creditos']))
        totm[f['situacion']] += n(f['monto'])
        print('  %-8s %-20s %6d creditos  %18s  %s sedes'
              % (f['situacion'], f['antiguedad'], int(n(f['creditos'])),
                 cop(n(f['monto'])), f['sedes']))
    out['PLATA_SOBRE_MESA'] = filas
    print('  ---')
    print('  VIVO    (rescatable): %6d creditos  %s' % (tot['VIVO'], cop(totm['VIVO'])))
    print('  VENCIDO (perdido)   : %6d creditos  %s' % (tot['VENCIDO'], cop(totm['VENCIDO'])))

    print()
    print('=== 2. DESEMBOLSOS 2026 por dias a la firma ===')
    fir = lib.bq(SQL_FIRMA)
    ff = [['balde', 're_aprobado', 'creditos', 'monto']]
    for f in fir:
        ra = str(f['re_aprobado']).lower() == 'true'
        ff.append([f['balde'], 'si' if ra else 'no', int(n(f['creditos'])),
                   round(n(f['monto']))])
        print('  %-24s re-aprobado=%-3s %6d creditos  %s'
              % (f['balde'], 'SI' if ra else 'no', int(n(f['creditos'])), cop(n(f['monto']))))
    out['RESCATE_BALDES'] = ff

    print()
    print('=== 3. SEDES CON OPORTUNIDAD VIVA ===')
    sv = lib.bq(SQL_SEDES_VIVAS)
    fs = [['sede', 'creditos', 'monto', 'creditos_0_15', 'dias_min_restantes']]
    for f in sv:
        fs.append([f.get('sede') or '', int(n(f['creditos'])), round(n(f['monto'])),
                   int(n(f['creditos_0_15'])), int(n(f['dias_min_restantes']))])
    out['PLATA_SEDES'] = fs
    print('  %d sedes con credito vivo. Top 8:' % (len(fs) - 1))
    for x in fs[1:9]:
        print('   %-42s %4d creditos  %16s  (quedan %d dias al mas viejo)'
              % (x[0][:42], x[1], cop(x[2]), x[4]))

    json.dump(out, io.open('tables_bq_v2.json', 'w', encoding='utf8'), ensure_ascii=False)
