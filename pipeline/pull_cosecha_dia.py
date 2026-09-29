# -*- coding: utf-8 -*-
"""
COSECHA_DIA: cosecha x fecha x canal -> solicitudes, aprobados, desembolsos, monto.

Es lo que permite que la seccion 5 sea de la COSECHA y no del universo entero:
con esta tabla el motor puede dibujar el monto diario de las sedes que entraron
en el mes M, y sacar el share por canal de esa misma plata.

  cosecha = mes de hs_createdate de la sede (HubSpot manda)
  canal   = origen de la sede, solo los cuatro de marketing
  fecha   = DATE(created_on) del credito

Se guarda solo el tramo de creditos radicados DENTRO del mes de la cosecha, que
es el alcance de la seccion. Asi la tabla queda en ~1.500 filas en vez de 50.000.
"""
import lib, json, io, unicodedata, collections

MKT = {'EVENTO': 'Eventos', 'REFERIDO': 'Referidos',
       'PAGINA WEB': 'Pagina web', 'SOCIAL MEDIA': 'Social media'}

SQL = """
WITH base AS (
  SELECT medico_id, DATE(created_on, "America/Bogota") AS fecha,
    CASE
      WHEN estado IN ('on_hold_rejected','rejected_validation','risk_in_process',
        'rejected','fraud','creada','on_hold_approved','on_hold_docs') THEN 'Rechazado'
      WHEN estado IN ('firma_contrato','approved','not_taken') THEN 'Aprobado'
      -- 'dismissed' SACADO (9-sep-2026): rechazo, no desembolso.
      WHEN estado IN ('pendiente_aprobacion_medico','desembolsado',
        'pendiente_validacion_cliente','fulfilled','pendiente_desembolso'
        ) THEN 'Convertido'
      ELSE 'Otro' END AS estado_final,
    COALESCE(monto_aprobado, monto) AS monto
  FROM `welli-tecnologia.public.profile_institucion`
  WHERE medico_id IS NOT NULL
)
SELECT CAST(fecha AS STRING) AS fecha, medico_id,
       COUNT(*) AS sol,
       SUM(IF(estado_final IN ('Aprobado','Convertido'), 1, 0)) AS apr,
       SUM(IF(estado_final = 'Convertido', 1, 0)) AS des,
       SUM(IF(estado_final = 'Convertido', monto, 0)) AS monto
FROM base GROUP BY 1, 2"""


def N(o):
    s = (o or '').strip().upper()
    s = ''.join(c for c in unicodedata.normalize('NFD', s)
                if unicodedata.category(c) != 'Mn')
    return ' '.join(s.split())


def n(v):
    try:
        return int(float(v))
    except Exception:
        return 0


if __name__ == '__main__':
    H = json.load(io.open('sheet_data.json', encoding='utf8'))
    S = H['SEDES']; h = S[0]
    iI, iO, iC = h.index('id_internal'), h.index('origen'), h.index('cosecha')
    # TODOS los origenes, no solo marketing: la seccion 5 tiene que responder
    # al filtro global igual que el resto del tablero.
    info = {}
    for r in S[1:]:
        k = str(r[iI] or '').strip()
        c = str(r[iC] or '')[:7]
        if k and len(c) == 7:
            info[k] = (c, N(r[iO]))
    print('sedes cruzables (todos los origenes): %d' % len(info))

    r = lib.bq(SQL, project='welli-tecnologia')
    print('%d filas dia x clinica desde profile_institucion' % len(r))

    ag = collections.defaultdict(lambda: [0, 0, 0, 0])
    fuera = 0
    for x in r:
        k = str(x['medico_id'])
        if k not in info:
            continue
        cos, canal = info[k]
        # TODAS las fechas, no solo el mes de la cosecha: con un rango de
        # varios meses, los creditos de agosto de una sede de julio tambien
        # cuentan (la sede entro en el periodo y el credito se radico en el
        # periodo). Filtrar eso es trabajo del motor, no del pull.
        b = ag[(cos, str(x['fecha']), canal)]
        b[0] += n(x['sol']); b[1] += n(x['apr'])
        b[2] += n(x['des']); b[3] += n(x['monto'])

    filas = [['cosecha', 'fecha', 'origen', 'solicitudes', 'aprobados',
              'desembolsos', 'monto']]
    for k in sorted(ag):
        b = ag[k]
        filas.append([k[0], k[1], k[2], b[0], b[1], b[2], b[3]])
    print('%d filas cosecha x fecha x canal  (%d descartadas por ser de meses '
          'posteriores a la cosecha)' % (len(filas) - 1, fuera))

    ctl = collections.defaultdict(lambda: [0, 0, 0, 0])
    for f in filas[1:]:
        b = ctl[f[0]]
        for i in range(4):
            b[i] += f[3 + i]
    print()
    print('  CONTROL por cosecha (debe cuadrar con las tarjetas de la seccion 5)')
    for c in sorted(ctl)[-5:]:
        b = ctl[c]
        print('    %s  sol %4d  apr %3d  des %3d  $%s'
              % (c, b[0], b[1], b[2], format(b[3], ',').replace(',', '.')))

    json.dump({'COSECHA_DIA': filas},
              io.open('tables_cd.json', 'w', encoding='utf8'), ensure_ascii=False)
    print('escrito tables_cd.json')
