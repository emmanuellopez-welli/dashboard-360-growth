# -*- coding: utf-8 -*-
"""Cruza los 836 documentos firmados de gestion_historica contra t_sol_v2
para sacarles monto y fecha real de firma (fecha_firma_contrato)."""
import lib

firmados = lib.bq("""
SELECT DISTINCT documento
FROM `welli-growth.rescate.gestion_historica`
WHERE tiene_gestion = 'True' AND marcado_firma_credito = TRUE
""", project='welli-data', location='US')
docs = [r['documento'] for r in firmados if r['documento']]
print('documentos a cruzar:', len(docs))

# t_sol_v2 es enorme (300k+ filas): no se puede traer entera, se cruza por
# lotes de documento con IN.
import math
sol = {}
LOTE = 500
for i in range(0, len(docs), LOTE):
    lote = docs[i:i + LOTE]
    lista = ','.join("'%s'" % d.replace("'", "") for d in lote)
    rows = lib.bq("""
      SELECT documento, monto_aprobado, monto_solicitado, fecha_firma_contrato,
             estado, fecha_solicitud
      FROM `welli-data.comercial_ops.t_sol_v2`
      WHERE documento IN (%s)
    """ % lista, project='welli-data')
    for r in rows:
        d = r['documento']
        if d not in sol or (r['fecha_firma_contrato'] and not sol[d].get('fecha_firma_contrato')):
            sol[d] = r
print('encontrados en t_sol_v2:', len(sol))

con_firma = [r for r in sol.values() if r.get('fecha_firma_contrato')]
print('con fecha_firma_contrato real:', len(con_firma))
con_monto = [r for r in con_firma if r.get('monto_aprobado')]
print('con monto_aprobado:', len(con_monto))
total = sum(float(r['monto_aprobado']) for r in con_monto)
print('suma monto_aprobado de esos:', total)

# distribucion mensual por fecha_firma_contrato
import collections
por_mes = collections.Counter()
monto_mes = collections.Counter()
for r in con_monto:
    mes = str(r['fecha_firma_contrato'])[:7]
    por_mes[mes] += 1
    monto_mes[mes] += float(r['monto_aprobado'])
print('\npor mes:')
for m in sorted(por_mes):
    print(' ', m, por_mes[m], 'casos,', '$%.0f' % monto_mes[m])
