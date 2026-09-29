# -*- coding: utf-8 -*-
import re
import lib

def norm(t):
    return re.sub(r'\D', '', str(t or ''))[-10:]

ap = lib.bq("""
  SELECT documento, nombre_paciente, nro_celular_paciente, monto_aprobado,
         nombre_comercial AS clinica
  FROM `welli-data.comercial_ops.t_sol_v2`
  WHERE estado = 'approved'
    AND nro_celular_paciente IS NOT NULL AND TRIM(nro_celular_paciente) != ''
    AND DATE(fecha_solicitud,"America/Bogota") = '2026-09-11'
""", project='welli-data')
print('aprobados hoy con celular:', len(ap))

ev = lib.bq("""
  SELECT DISTINCT RIGHT(REGEXP_REPLACE(telefono, r'[^0-9]', ''), 10) AS tel
  FROM `welli-growth.rescate.eventos_hilos`
  WHERE direccion='OUTBOUND' AND evento='message.sent'
    AND DATE(ts_evento,"America/Bogota") = '2026-09-11'
""", project='welli-data', location='US')
conMsj = set(r['tel'] for r in ev if r['tel'])

for r in ap:
    t = norm(r['nro_celular_paciente'])
    if t in conMsj:
        print('DOC', r['documento'], '-', r['nombre_paciente'], '-', r['clinica'],
              '- $', r['monto_aprobado'], '- cel', t)
        break
else:
    print('ninguno de los aprobados de hoy recibio mensaje hoy')
