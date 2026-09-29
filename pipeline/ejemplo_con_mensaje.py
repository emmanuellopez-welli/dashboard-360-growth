# -*- coding: utf-8 -*-
"""Ejemplos verificables a mano: pacientes con credito aprobado-y-vivo a los
que SI se les envio mensaje, con cuantos, cuando y con que plantilla — para
poder abrirlos en Hilos y confirmar que el cruce del tablero es correcto.

Tambien saca ejemplos del lado contrario (aprobados SIN ningun mensaje), que
es el numero que se presenta y por lo tanto el que mas importa verificar."""
import collections
import re

import lib


def norm(t):
    return re.sub(r'\D', '', str(t or ''))[-10:]


ap = lib.bq("""
  SELECT documento, nombre_paciente, nro_celular_paciente, monto_aprobado,
         nombre_comercial AS clinica,
         DATE(fecha_solicitud, "America/Bogota") AS fecha_sol
  FROM `welli-data.comercial_ops.t_sol_v2`
  WHERE estado = 'approved'
    AND nro_celular_paciente IS NOT NULL AND TRIM(nro_celular_paciente) != ''
    AND DATE(fecha_solicitud, "America/Bogota") >= DATE '2026-08-25'
""", project='welli-data')
print('aprobados vivos desde el 25-ago:', len(ap))

ev = lib.bq("""
  SELECT telefono, evento, plantilla, flujo,
         DATE(ts_evento, "America/Bogota") AS dia
  FROM `welli-growth.rescate.eventos_hilos`
  WHERE direccion = 'OUTBOUND'
""", project='welli-data', location='US')
print('eventos OUTBOUND leidos:', len(ev))

porTel = collections.defaultdict(lambda: {'n': 0, 'dias': set(),
                                          'plantillas': set(), 'flujos': set()})
for r in ev:
    t = norm(r['telefono'])
    if not t:
        continue
    b = porTel[t]
    b['n'] += 1
    if r['dia']:
        b['dias'].add(str(r['dia']))
    if r['plantilla']:
        b['plantillas'].add(str(r['plantilla'])[:8])
    if r['flujo']:
        b['flujos'].add(str(r['flujo'])[:34])

con, sin = [], []
vistos = set()
for r in ap:
    t = norm(r['nro_celular_paciente'])
    if not t or t in vistos:
        continue
    vistos.add(t)
    (con if t in porTel else sin).append((r, t))

con.sort(key=lambda x: -porTel[x[1]]['n'])
print('\n== CON MENSAJE: %d · SIN MENSAJE: %d ==' % (len(con), len(sin)))

print('\n--- 5 QUE SI RECIBIERON MENSAJE (para verificar en Hilos) ---')
for r, t in con[:5]:
    b = porTel[t]
    print('\n  celular   %s   (en la base: %s)' % (t, r['nro_celular_paciente']))
    print('  paciente  %s · doc %s' % (r['nombre_paciente'], r['documento']))
    print('  clinica   %s · aprobado $%s · solicitud %s'
          % (r['clinica'], r['monto_aprobado'], r['fecha_sol']))
    print('  mensajes  %d eventos salientes · dias: %s'
          % (b['n'], ', '.join(sorted(b['dias']))[:90]))
    print('  flujos    %s' % (', '.join(sorted(b['flujos'])) or '(sin flujo)'))
    print('  plantilla %s' % (', '.join(sorted(b['plantillas'])) or '(sin plantilla)'))

print('\n--- 5 QUE NO RECIBIERON NADA (el numero que se presenta) ---')
for r, t in sin[:5]:
    print('  celular %s · doc %s · %s · %s'
          % (t, r['documento'], str(r['nombre_paciente'])[:26], r['clinica']))
