# -*- coding: utf-8 -*-
"""
Le agrega la dimension EQUIPO a las dos tablas de creditos, para que el filtro
global de owner corte tambien F1 seccion 5, la plata de F2 y todo F4.

  COSECHA_DIA      cosecha x fecha x origen x equipo
  RESCATE_VENTANA  fecha x ventana x origen x equipo

El equipo NO multiplica las filas por cinco: cada sede tiene exactamente un
equipo, asi que la dimension solo parte filas que ya existian.

El equipo sale de SEDE_OWNER (id_sede -> equipo), que se arma con los equipos
reales de HubSpot en pull_owner.py.
"""
import lib, json, io, unicodedata, collections

VENTANAS = {
    'C': ['ODONTOLOGIA', 'MEDICINA GENERAL', 'DERMATOLOGIA Y ESTETICA', 'FISIOTERAPIA'],
    'B': ['MEDICINA ESTETICA', 'OBESIDAD Y CIRUGIA BARIATRICA', 'OFTALMOLOGIA',
          'VETERINARIA', 'AUDIOLOGIA'],
    'A': ['CIRUGIA PLASTICA'],
}
VENT_DE = {}
for k, esp in VENTANAS.items():
    for e in esp:
        VENT_DE[e] = k

ESTADOS = """
    CASE
      WHEN p.estado IN ('on_hold_rejected','rejected_validation','risk_in_process',
        'rejected','fraud','creada','on_hold_approved','on_hold_docs') THEN 'Rechazado'
      WHEN p.estado IN ('firma_contrato','approved','not_taken') THEN 'Aprobado'
      -- 'dismissed' SACADO (9-sep-2026): rechazo, no desembolso.
      WHEN p.estado IN ('pendiente_aprobacion_medico','desembolsado',
        'pendiente_validacion_cliente','fulfilled','pendiente_desembolso'
        ) THEN 'Convertido'
      ELSE 'Otro' END AS estado_final"""

SQL = """
WITH base AS (
  SELECT p.medico_id, DATE(p.created_on) AS fecha,%s,
    COALESCE(p.monto_aprobado, p.monto) AS monto,
    IFNULL(m.especialidad, '') AS especialidad
  FROM `welli-tecnologia.public.profile_institucion` p
  LEFT JOIN `welli-tecnologia.public.institucion_medica` m ON m.id = p.medico_id
  WHERE p.medico_id IS NOT NULL AND p.created_on IS NOT NULL
)
SELECT CAST(fecha AS STRING) AS fecha, medico_id, especialidad,
  COUNT(*) AS sol,
  SUM(IF(estado_final IN ('Aprobado','Convertido'), 1, 0)) AS apr,
  SUM(IF(estado_final = 'Convertido', 1, 0)) AS conv,
  SUM(IF(estado_final IN ('Aprobado','Convertido'), monto, 0)) AS monto_apr,
  SUM(IF(estado_final = 'Convertido', monto, 0)) AS monto_conv
FROM base GROUP BY 1, 2, 3""" % ESTADOS


def N(o):
    s = (o or '').strip().upper()
    if not s:
        return '(SIN ORIGEN)'
    s = ''.join(c for c in unicodedata.normalize('NFD', s)
                if unicodedata.category(c) != 'Mn')
    return ' '.join(s.split())


def n(v):
    try:
        return int(float(v))
    except Exception:
        return 0


if __name__ == '__main__':
    d = json.load(io.open('sheet_data.json', encoding='utf8'))
    S = d['SEDES']
    h = S[0]
    iI, iO, iC = h.index('id_internal'), h.index('origen'), h.index('cosecha')
    origenDe, cosechaDe = {}, {}
    for r in S[1:]:
        k = str(r[iI] or '').strip()
        if not k:
            continue
        origenDe[k] = N(r[iO])
        c = str(r[iC] or '')[:7]
        if len(c) == 7:
            cosechaDe[k] = c

    OW = d['SEDE_OWNER']
    ho = OW[0]
    jS, jO = ho.index('id_sede'), ho.index('owner_id')
    equipoDe = {}
    for r in OW[1:]:
        k = str(r[jS] or '').strip()
        if k:
            equipoDe[k] = str(r[jO] or '') or '0'
    print('sedes con owner: %d' % len(equipoDe))

    r = lib.bq(SQL, project='welli-tecnologia')
    print('%d filas dia x sede' % len(r))

    cd = collections.defaultdict(lambda: [0, 0, 0, 0])       # sol, apr, des, monto
    rv = collections.defaultdict(lambda: [0, 0, 0, 0])       # apr, firm, mApr, mFirm
    for x in r:
        mid = str(x['medico_id'])
        eq = equipoDe.get(mid, '0')
        o = origenDe.get(mid, '(NO ESTA EN HUBSPOT)')
        fch = x['fecha']
        sol, apr, conv = n(x['sol']), n(x['apr']), n(x['conv'])
        mA, mC = n(x['monto_apr']), n(x['monto_conv'])

        cos = cosechaDe.get(mid)
        if cos:
            b = cd[(cos, fch, o, eq)]
            b[0] += sol; b[1] += apr; b[2] += conv; b[3] += mC

        v = VENT_DE.get(N(x['especialidad']), '-')
        b = rv[(fch, v, o, eq)]
        b[0] += apr; b[1] += conv; b[2] += mA; b[3] += mC

    T = {}
    filas = [['cosecha', 'fecha', 'origen', 'owner', 'solicitudes', 'aprobados',
              'desembolsos', 'monto']]
    for k in sorted(cd):
        b = cd[k]
        filas.append([k[0], k[1], k[2], k[3], b[0], b[1], b[2], b[3]])
    T['COSECHA_DIA'] = filas
    print('COSECHA_DIA     %6d filas  (antes 8.469)' % (len(filas) - 1))

    filas = [['fecha', 'ventana', 'origen', 'owner', 'aprobados', 'firmados',
              'monto_apr', 'monto_firm']]
    for k in sorted(rv):
        b = rv[k]
        filas.append([k[0], k[1], k[2], k[3], b[0], b[1], b[2], b[3]])
    T['RESCATE_VENTANA'] = filas
    print('RESCATE_VENTANA %6d filas  (antes 6.390)' % (len(filas) - 1))

    ctl = collections.defaultdict(lambda: [0, 0, 0])
    for f in T['RESCATE_VENTANA'][1:]:
        if '2026-08-01' <= f[0] <= '2026-08-31':
            b = ctl[f[3]]
            b[0] += f[4]; b[1] += f[5]; b[2] += f[7]
    print()
    print('  CONTROL agosto 2026 por owner')
    print('  owner_id           aprobados  firmados      plata firmada')
    for k in sorted(ctl, key=lambda x: -ctl[x][0]):
        b = ctl[k]
        print('   %-18s %8d %9d  %17s'
              % (k, b[0], b[1], format(b[2], ',').replace(',', '.')))
    tt = [sum(ctl[k][i] for k in ctl) for i in range(3)]
    print('   %-18s %8d %9d  %17s'
          % ('TOTAL', tt[0], tt[1], format(tt[2], ',').replace(',', '.')))
    print('   control BigQuery: 6345 aprobados, 2826 firmados, $13.422.318.753')

    json.dump(T, io.open('tables_eq.json', 'w', encoding='utf8'), ensure_ascii=False)
    print('escrito tables_eq.json')
