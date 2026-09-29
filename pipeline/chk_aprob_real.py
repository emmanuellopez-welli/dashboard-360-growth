# -*- coding: utf-8 -*-
import re, collections
import lib

def norm(t):
    return re.sub(r'\D', '', str(t or ''))[-10:]

# Universo: creditos aprobados con fecha_solicitud entre 25-jul y 10-ago (la
# ventana donde vimos el burst inicial 31-jul a 4-ago), para ver que plantilla
# les llego a ELLOS especificamente en los primeros dias tras aprobarse.
ap = lib.bq("""
  SELECT documento, nro_celular_paciente, DATE(fecha_solicitud,"America/Bogota") AS dia
  FROM `welli-data.comercial_ops.t_sol_v2`
  WHERE estado = 'approved'
    AND nro_celular_paciente IS NOT NULL AND TRIM(nro_celular_paciente) != ''
    AND DATE(fecha_solicitud,"America/Bogota") BETWEEN '2026-07-28' AND '2026-08-05'
""", project='welli-data')
tels = set(norm(r['nro_celular_paciente']) for r in ap)
print('aprobados en la ventana 28jul-5ago:', len(tels))

ev = lib.bq("""
  SELECT telefono, flujo, DATE(ts_evento,"America/Bogota") AS dia
  FROM `welli-growth.rescate.eventos_hilos`
  WHERE direccion='OUTBOUND' AND evento='message.sent'
    AND DATE(ts_evento,"America/Bogota") BETWEEN '2026-07-31' AND '2026-08-06'
""", project='welli-data', location='US')

porFlujo = collections.Counter()
for r in ev:
    if norm(r['telefono']) in tels:
        porFlujo[str(r['flujo'])] += 1
for f, n in porFlujo.most_common(10):
    print(' ', f, n)
