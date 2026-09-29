# -*- coding: utf-8 -*-
"""
gestion_historica tiene otro esquema que gestion: hay que mapearlo antes de
unirlas, o el embudo mezclaria peras con manzanas.

  gestion              gestion_historica
  fecha                fecha_seguimiento
  causal               estado_gestion / nivel1 / razon_rechazo  (?)
  canal                medio_contacto
  nota                 observaciones
  trabajado (BOOL)     tiene_gestion (STRING)
  -- (viene de seguimiento)   marcado_firma_credito (BOOL)
  -- (viene de lista_dia)     aliado / clinica
"""
import rq

T = '`welli-growth.rescate.gestion_historica`'


def dist(col, lim=25):
    print('\n--- %s ---' % col)
    for r in rq.q("""
    SELECT COALESCE(CAST(%s AS STRING), '(nulo)') AS v, COUNT(*) AS n,
           COUNTIF(marcado_firma_credito) AS firmas
    FROM %s GROUP BY 1 ORDER BY n DESC LIMIT %d
    """ % (col, T, lim)):
        print('   %6s  %3s firmas   %s' % (r['n'], r['firmas'], r['v'][:64]))


r = rq.q("""
SELECT COUNT(*) AS filas,
       COUNT(DISTINCT documento) AS docs,
       COUNT(DISTINCT CONCAT(CAST(fecha_seguimiento AS STRING), '|', documento))
         AS casos,
       CAST(MIN(fecha_seguimiento) AS STRING) AS desde,
       CAST(MAX(fecha_seguimiento) AS STRING) AS hasta,
       COUNTIF(fecha_seguimiento IS NULL) AS sin_fecha,
       COUNTIF(marcado_firma_credito) AS firmas
FROM %s
""" % T)[0]
print('VOLUMEN')
print('   %s filas | %s documentos | %s casos (fecha+doc)'
      % (r['filas'], r['docs'], r['casos']))
print('   rango %s -> %s   (%s sin fecha)'
      % (r['desde'], r['hasta'], r['sin_fecha']))
print('   marcado_firma_credito = TRUE en %s' % r['firmas'])

for c in ('tiene_gestion', 'estado_gestion', 'nivel1', 'medio_contacto'):
    dist(c)
dist('razon_rechazo', 30)

# Solape con la tabla viva: si se pisan, unirlas duplica.
print('\n--- SOLAPE con gestion (31-jul en adelante) ---')
for r in rq.q("""
SELECT
  (SELECT COUNT(*) FROM %s WHERE fecha_seguimiento >= '2026-07-31') AS hist_desde_31jul,
  (SELECT COUNT(DISTINCT CONCAT(CAST(h.fecha_seguimiento AS STRING),'|',h.documento))
   FROM %s h
   JOIN `welli-growth.rescate.gestion` g
     ON g.documento = h.documento AND g.fecha = h.fecha_seguimiento) AS pisados
""" % (T, T)):
    print('   filas historicas con fecha >= 31-jul: %s' % r['hist_desde_31jul'])
    print('   casos que existen en LAS DOS tablas:  %s' % r['pisados'])
