# -*- coding: utf-8 -*-
"""
SEDE_ESTADO_MES: el estado de cada sede al cierre de cada mes.

Es la fuente de los cinco mapas de cohorte de profundizacion. Por sede y por
mes trae lo ACUMULADO hasta el cierre de ese mes mas los dias que llevaba sin
aplicar, que es lo que define inactiva (>=30) y muerta (>90).

Los acumulados se calculan en BigQuery y no en el motor porque el motor tendria
que recorrer 3.100 sedes x 11 meses x 5 mapas en cada carga.

  apps_acum    solicitudes radicadas hasta el cierre del mes
  des_acum     desembolsos hasta el cierre del mes
  monto_acum   plata desembolsada hasta el cierre del mes
  apps_mes     solicitudes del mes (para ver el ritmo, no el acumulado)
  dias_sin_app dias entre la ultima solicitud y el cierre del mes.
               -1 = nunca ha radicado ninguna.

El cierre del mes se recorta a hoy: en el mes en curso el "cierre" es hoy, no
fin de mes, o el mes en curso saldria con 28 dias de inactividad falsos.
"""
import lib, json, io

SQL = """
WITH sol AS (
  SELECT medico_id, DATE(created_on, "America/Bogota") AS f,
    -- 'dismissed' SACADO (9-sep-2026): es un credito RECHAZADO, no un
    -- desembolso. Contarlo en des_acum/monto_acum inflaba "exitosa" (>=1
    -- desembolso) y la plata de los mapas de cohorte con creditos que nunca
    -- se pagaron.
    CASE WHEN estado IN ('pendiente_aprobacion_medico','desembolsado',
      'pendiente_validacion_cliente','fulfilled','pendiente_desembolso'
      ) THEN 1 ELSE 0 END AS conv,
    COALESCE(monto_aprobado, monto) AS monto
  FROM `welli-tecnologia.public.profile_institucion`
  WHERE medico_id IS NOT NULL AND created_on IS NOT NULL
),
sedes AS (SELECT DISTINCT medico_id FROM sol),
meses AS (
  SELECT m, LEAST(LAST_DAY(m), CURRENT_DATE()) AS fin
  FROM UNNEST(GENERATE_DATE_ARRAY('2025-11-01', CURRENT_DATE(),
    INTERVAL 1 MONTH)) AS m
),
spine AS (SELECT s.medico_id, x.m, x.fin FROM sedes s CROSS JOIN meses x)
SELECT p.medico_id,
  FORMAT_DATE('%Y-%m', p.m) AS mes,
  COUNTIF(o.f <= p.fin) AS apps_acum,
  SUM(IF(o.f <= p.fin, o.conv, 0)) AS des_acum,
  SUM(IF(o.f <= p.fin AND o.conv = 1, o.monto, 0)) AS monto_acum,
  COUNTIF(o.f BETWEEN p.m AND p.fin) AS apps_mes,
  IFNULL(DATE_DIFF(p.fin, MAX(IF(o.f <= p.fin, o.f, NULL)), DAY), -1)
    AS dias_sin_app
FROM spine p
LEFT JOIN sol o ON o.medico_id = p.medico_id
GROUP BY p.medico_id, p.m, p.fin
HAVING apps_acum > 0
ORDER BY 2, 1"""


def n(v):
    try:
        return int(float(v))
    except Exception:
        return 0


if __name__ == '__main__':
    r = lib.bq(SQL, project='welli-tecnologia')
    filas = [['id_sede', 'mes', 'apps_acum', 'des_acum', 'monto_acum',
              'apps_mes', 'dias_sin_app']]
    for x in r:
        filas.append([x['medico_id'], x['mes'], n(x['apps_acum']),
                      n(x['des_acum']), n(x['monto_acum']),
                      n(x['apps_mes']), n(x['dias_sin_app'])])
    print('%d filas sede x mes  (%d sedes)'
          % (len(filas) - 1, len(set(f[0] for f in filas[1:]))))

    # Control: al ultimo mes, cuantas sedes hay en cada estado
    ult = max(f[1] for f in filas[1:])
    a = [f for f in filas[1:] if f[1] == ult]
    print()
    print('  al cierre de %s (%d sedes con al menos una solicitud):' % (ult, len(a)))
    print('     >=3 apps o >=1 desembolso : %d' % sum(1 for f in a if f[2] >= 3 or f[3] >= 1))
    print('     30+ dias sin aplicar      : %d' % sum(1 for f in a if f[6] >= 30))
    print('     90+ dias sin aplicar      : %d' % sum(1 for f in a if f[6] > 90))
    print('     plata acumulada           : $%s'
          % format(sum(f[4] for f in a), ',').replace(',', '.'))

    json.dump({'SEDE_ESTADO_MES': filas},
              io.open('tables_em.json', 'w', encoding='utf8'), ensure_ascii=False)
    print('escrito tables_em.json')
