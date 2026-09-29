# -*- coding: utf-8 -*-
"""
ACT_SEDE_MES: solicitudes / aprobados / desembolsos por sede y por mes.

Misma fuente y mismo mapeo de estados que EMBUDO_CONV (profile_institucion), para
que el panel de activacion cuadre exactamente con el embudo que esta arriba de el.
Si se sacara de t_sol_v2 daria un numero parecido pero no identico, y el usuario
lo notaria en la misma pantalla.

  activa   = >= 1 solicitud en el mes
  exitosa  = >= 3 solicitudes  O  >= 1 desembolso en el mes
"""
import lib, json, io

SQL = """
WITH base AS (
  SELECT medico_id,
    FORMAT_DATE('%Y-%m', DATE(created_on, "America/Bogota")) AS mes,
    CASE
      WHEN estado IN ('on_hold_rejected','rejected_validation','risk_in_process',
        'rejected','fraud','creada','on_hold_approved','on_hold_docs') THEN 'Rechazado'
      WHEN estado IN ('firma_contrato','approved','not_taken') THEN 'Aprobado'
      -- 'dismissed' SACADO (9-sep-2026): es un rechazo, no un desembolso —
      -- inflaba "exitosa" (>=1 desembolso) con creditos que nunca se pagaron.
      WHEN estado IN ('pendiente_aprobacion_medico','desembolsado',
        'pendiente_validacion_cliente','fulfilled','pendiente_desembolso'
        ) THEN 'Convertido'
      ELSE 'Otro' END AS estado_final,
    COALESCE(monto_aprobado, monto) AS monto
  FROM `welli-tecnologia.public.profile_institucion`
  WHERE medico_id IS NOT NULL
)
SELECT medico_id, mes,
       COUNT(*) AS solicitudes,
       SUM(IF(estado_final IN ('Aprobado','Convertido'), 1, 0)) AS aprobados,
       SUM(IF(estado_final = 'Convertido', 1, 0)) AS desembolsos,
       SUM(IF(estado_final = 'Convertido', monto, 0)) AS monto
FROM base GROUP BY 1, 2 ORDER BY 2, 1"""


def n(v):
    try:
        return int(float(v))
    except Exception:
        return 0


if __name__ == '__main__':
    r = lib.bq(SQL, project='welli-tecnologia')
    filas = [['id_sede', 'mes', 'solicitudes', 'aprobados', 'desembolsos', 'monto']]
    for x in r:
        filas.append([x['medico_id'], x['mes'], n(x['solicitudes']),
                      n(x['aprobados']), n(x['desembolsos']), n(x['monto'])])
    print('%d filas sede x mes  (%d sedes distintas)'
          % (len(filas) - 1, len(set(f[0] for f in filas[1:]))))

    ag = {}
    for f in filas[1:]:
        ag.setdefault(f[1], [0, 0, 0, 0, 0])
        b = ag[f[1]]
        b[0] += 1                       # sedes con actividad
        b[1] += f[2]; b[2] += f[3]; b[3] += f[4]; b[4] += f[5]
    for m in sorted(ag)[-4:]:
        print('   %s  %4d sedes activas  %5d sol  %4d apr  %4d des  $%s'
              % (m, ag[m][0], ag[m][1], ag[m][2], ag[m][3],
                 format(ag[m][4], ',').replace(',', '.')))

    json.dump({'ACT_SEDE_MES': filas},
              io.open('tables_act.json', 'w', encoding='utf8'), ensure_ascii=False)
    print('escrito tables_act.json')
