# -*- coding: utf-8 -*-
"""Los 134 aprobados 20-28 sep, en estado approved/firma_contrato, que NUNCA
recibieron el mensaje de credito aprobado. Pedido de Emmanuel 28-sep-2026."""
import json
import collections

import lib

FUERA = {'desembolsado', 'fulfilled', 'pendiente_desembolso',
         'pendiente_aprobacion_medico', 'pendiente_validacion_cliente'}
INI, FIN = '2026-09-20', '2026-09-28'

d = json.load(open('sheet_data.json', encoding='utf8'))
P = d['RESCATE_WA_PACIENTES']
h = P[0]
iT, iF, iE = h.index('telefono'), h.index('fecha_aprobacion'), h.index('enviado')
sinEnv = {}
for r in P[1:]:
    f = str(r[iF])[:10]
    if INI <= f <= FIN and not int(r[iE] or 0):
        sinEnv[str(r[iT])] = f

SQL = """
SELECT RIGHT(REGEXP_REPLACE(nro_celular_paciente, r'[^0-9]', ''), 10) AS tel,
       ARRAY_AGG(STRUCT(estado, nombre_paciente, documento, nombre_comercial AS sede,
                        monto_aprobado, DATE(fecha_solicitud,"America/Bogota") AS f)
                 ORDER BY fecha_solicitud DESC LIMIT 1)[OFFSET(0)] AS x
FROM `welli-data.comercial_ops.t_sol_v2`
WHERE nro_celular_paciente IS NOT NULL
  AND estado IN ('approved','desembolsado','fulfilled','pendiente_desembolso','firma_contrato')
  AND DATE(fecha_solicitud,"America/Bogota") BETWEEN '%s' AND '%s'
GROUP BY tel
""" % (INI, FIN)

info = {}
for r in lib.bq(SQL, project='welli-data'):
    x = r['x']
    if isinstance(x, dict) and 'f' in x:
        v = [c.get('v') for c in x['f']]
        x = {'estado': v[0], 'nombre_paciente': v[1], 'documento': v[2],
             'sede': v[3], 'monto_aprobado': v[4], 'f': v[5]}
    info[r['tel']] = x

filas = []
for tel, fap in sinEnv.items():
    x = info.get(tel)
    if not x or x['estado'] in FUERA:
        continue
    filas.append((fap, tel, x['estado'], x.get('nombre_paciente') or '',
                  x.get('documento') or '', x.get('sede') or '',
                  float(x.get('monto_aprobado') or 0)))
filas.sort()

print('TOTAL sin mensaje, estado approved/firma_contrato: %d' % len(filas))
print()
print(collections.Counter(f[2] for f in filas))
print()
print('%-11s %-13s %-15s %-28s %-12s %s' %
      ('F.APROB', 'CELULAR', 'ESTADO', 'PACIENTE', 'MONTO', 'SEDE'))
for f in filas:
    print('%-11s %-13s %-15s %-28s %-12s %s' %
          (f[0], f[1], f[2], f[3][:28], '{:,.0f}'.format(f[6]), f[5][:26]))

with open('sin_mensaje_134.csv', 'w', encoding='utf8') as fh:
    fh.write('fecha_aprobacion,celular,estado,paciente,documento,sede,monto\n')
    for f in filas:
        fh.write('%s,%s,%s,"%s",%s,"%s",%.0f\n' % (f[0], f[1], f[2], f[3], f[4], f[5], f[6]))
print()
print('CSV: sin_mensaje_134.csv')
