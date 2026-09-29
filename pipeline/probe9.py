# -*- coding: utf-8 -*-
"""t_sol_v2 vive en us-central1 y eventos_hilos en US (multi-region): no se
pueden cruzar en una sola query. Se trae cada lado por separado y se cruza
en Python por telefono normalizado a 10 digitos."""
import lib, re, collections

def norm(t):
    return re.sub(r'\D', '', str(t or ''))[-10:]

ap = lib.bq("""
  SELECT documento, nro_celular_paciente
  FROM `welli-data.comercial_ops.t_sol_v2`
  WHERE estado = 'approved'
    AND nro_celular_paciente IS NOT NULL AND TRIM(nro_celular_paciente) != ''
""", project='welli-data')
print('aprobados vivos con celular:', len(ap))

msg = lib.bq("""
  SELECT telefono, COUNT(*) AS n
  FROM `welli-growth.rescate.eventos_hilos`
  WHERE direccion = 'OUTBOUND'
  GROUP BY 1
""", project='welli-data', location='US')
print('telefonos con mensaje outbound:', len(msg))

msgTel = {}
for r in msg:
    t = norm(r['telefono'])
    if t:
        msgTel[t] = msgTel.get(t, 0) + int(r['n'] or 0)

tels = set()
sin_msj = 0
con_msj_conteo = []
for r in ap:
    t = norm(r['nro_celular_paciente'])
    if not t or t in tels:
        continue
    tels.add(t)
    if t in msgTel:
        con_msj_conteo.append(msgTel[t])
    else:
        sin_msj += 1

print('aprobados con telefono unico:', len(tels))
print('sin ningun mensaje outbound:', sin_msj)
print('con mensaje: %d, promedio msj/paciente: %.1f' %
      (len(con_msj_conteo), sum(con_msj_conteo) / len(con_msj_conteo) if con_msj_conteo else 0))
