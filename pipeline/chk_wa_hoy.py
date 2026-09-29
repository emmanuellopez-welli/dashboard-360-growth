# -*- coding: utf-8 -*-
import io, json, re, collections
import lib

ESTADOS_APROBADO = ("'approved'", "'desembolsado'", "'fulfilled'",
                    "'pendiente_desembolso'", "'firma_contrato'")
PISO_APROBADO = '2026-06-01'

def norm(t):
    return re.sub(r'\D', '', str(t or ''))[-10:]

ap = lib.bq("""
  SELECT DISTINCT RIGHT(REGEXP_REPLACE(nro_celular_paciente, r'[^0-9]', ''), 10) AS tel
  FROM `welli-data.comercial_ops.t_sol_v2`
  WHERE estado IN (%s)
    AND nro_celular_paciente IS NOT NULL AND TRIM(nro_celular_paciente) != ''
    AND DATE(fecha_solicitud, "America/Bogota") >= '%s'
""" % (','.join(ESTADOS_APROBADO), PISO_APROBADO), project='welli-data')
universo = set(r['tel'] for r in ap if r['tel'])
print('universo aprobados:', len(universo))

eventos = lib.bq("""
  SELECT telefono, evento, direccion, ts_evento
  FROM `welli-growth.rescate.eventos_hilos`
  WHERE direccion IN ('OUTBOUND', 'INBOUND')
    AND DATE(ts_evento, "America/Bogota") = '2026-09-11'
""", project='welli-data', location='US')
print('eventos hoy (todo el trafico WA, no solo rescate):', len(eventos))

c = collections.Counter()
enviados = set(); entregados = set(); leidos = set(); respondieron = set()
for r in eventos:
    t = norm(r['telefono'])
    if t not in universo:
        continue
    ev = r['evento']
    if r['direccion'] == 'OUTBOUND':
        if ev == 'message.sent': enviados.add(t)
        elif ev == 'message.delivered': entregados.add(t)
        elif ev == 'message.read': leidos.add(t)
    elif r['direccion'] == 'INBOUND' and ev == 'message.received':
        respondieron.add(t)

print('HOY 2026-09-11, solo pacientes del universo rescate:')
print('  pacientes con mensaje enviado :', len(enviados))
print('  entregados                    :', len(entregados))
print('  leidos                         :', len(leidos))
print('  respondieron                   :', len(respondieron))
