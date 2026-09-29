# -*- coding: utf-8 -*-
"""Aprobados de los ultimos 14 dias sin ningun mensaje de WhatsApp.

t_sol_v2 no tiene una columna 'fecha_aprobacion' explicita -- se usa
fecha_solicitud (con el mismo ajuste de zona horaria que el resto del
tablero) como proxy de cuando se origino ese credito, sobre los que HOY
siguen en estado 'approved' (vivos, sin firmar)."""
import lib, re, datetime

def norm(t):
    return re.sub(r'\D', '', str(t or ''))[-10:]

HOY = datetime.date(2026, 9, 8)
DESDE = HOY - datetime.timedelta(days=14)
print('ventana: %s a %s (America/Bogota)' % (DESDE, HOY))

ap = lib.bq("""
  SELECT documento, nro_celular_paciente, fecha_solicitud,
         DATE(fecha_solicitud, "America/Bogota") AS fecha_bog
  FROM `welli-data.comercial_ops.t_sol_v2`
  WHERE estado = 'approved'
    AND nro_celular_paciente IS NOT NULL AND TRIM(nro_celular_paciente) != ''
    AND DATE(fecha_solicitud, "America/Bogota") >= DATE_SUB(CURRENT_DATE("America/Bogota"), INTERVAL 14 DAY)
""", project='welli-data')
print('aprobados con solicitud en los ultimos 14 dias:', len(ap))

msg = lib.bq("""
  SELECT telefono, COUNT(*) AS n, MAX(DATE(ts_evento,"America/Bogota")) AS ultimo
  FROM `welli-growth.rescate.eventos_hilos`
  WHERE direccion = 'OUTBOUND'
  GROUP BY 1
""", project='welli-data', location='US')
msgTel = {}
for r in msg:
    t = norm(r['telefono'])
    if t:
        msgTel[t] = msgTel.get(t, 0) + int(r['n'] or 0)

tels = set()
sin_msj = 0
filas_sin = []
for r in ap:
    t = norm(r['nro_celular_paciente'])
    if not t or t in tels:
        continue
    tels.add(t)
    if t not in msgTel:
        sin_msj += 1
        filas_sin.append((r['documento'], r['fecha_bog']))

print('aprobados unicos (por celular) en la ventana:', len(tels))
print('SIN ningun mensaje de WhatsApp:', sin_msj,
      '(%.1f%%)' % (100.0 * sin_msj / len(tels) if tels else 0))
print()
print('primeros casos (documento, fecha solicitud):')
for doc, f in sorted(filas_sin, key=lambda x: x[1])[:20]:
    print(' ', doc, f)
