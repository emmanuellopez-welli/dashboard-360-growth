# -*- coding: utf-8 -*-
"""
La atribucion que el documento de traspaso daba por imposible.

El documento dice: "Para cerrarlo de verdad habria que consumir los webhooks
de hilos (message.received, message.read) ... No esta hecho."

Pero rescate.eventos_hilos YA tiene 628.639 filas con message.received
INBOUND (51.266) y message.read (138.219) desde el 26-jun-2026. Los webhooks
si estan. Esto prueba si alcanzan para atribuir.

La pregunta: de los casos trabajados, los que tuvieron respuesta del paciente
por WhatsApp DESPUES de la gestion, firman mas que los que no.
"""
import rq

# El telefono hay que normalizarlo: lista_dia lo guarda como 10 digitos y
# hilos lo trae con indicativo. Se comparan los ultimos 10.
TEL = "RIGHT(REGEXP_REPLACE(%s, r'[^0-9]', ''), 10)"

print('=== 1. La ventana de eventos_hilos contra la de gestion ===')
for r in rq.q("""
SELECT 'eventos_hilos INBOUND' AS que,
       CAST(MIN(DATE(ts_evento)) AS STRING) AS desde,
       CAST(MAX(DATE(ts_evento)) AS STRING) AS hasta,
       CAST(COUNT(DISTINCT %s) AS STRING) AS telefonos
FROM `welli-growth.rescate.eventos_hilos`
WHERE evento = 'message.received'
UNION ALL
SELECT 'gestion', CAST(MIN(fecha) AS STRING), CAST(MAX(fecha) AS STRING),
       CAST(COUNT(DISTINCT documento) AS STRING)
FROM `welli-growth.rescate.gestion`
""" % (TEL % 'telefono')):
    print('   %-24s %s -> %s   %s llaves'
          % (r['que'], r['desde'], r['hasta'], r['telefonos']))

print('\n=== 2. Cruce: cuantos casos trabajados tienen telefono en hilos ===')
BASE = """
WITH g AS (
  SELECT fecha, documento, causal, canal
  FROM `welli-growth.rescate.gestion`
  WHERE trabajado
  QUALIFY ROW_NUMBER() OVER (PARTITION BY fecha, documento ORDER BY ts DESC) = 1),
l AS (
  SELECT fecha, documento, telefono, aliado, monto
  FROM `welli-growth.rescate.lista_dia`
  QUALIFY ROW_NUMBER() OVER (PARTITION BY fecha, documento ORDER BY rank) = 1),
gl AS (
  SELECT g.fecha, g.documento, g.causal, g.canal,
         %s AS tel, l.aliado, l.monto
  FROM g LEFT JOIN l USING (fecha, documento)),
s AS (
  SELECT documento, MAX(firmo) AS firmo, MIN(fecha_firma) AS fecha_firma
  FROM `welli-growth.rescate.seguimiento` GROUP BY 1),
ev AS (
  SELECT %s AS tel, DATE(ts_evento) AS dia, evento
  FROM `welli-growth.rescate.eventos_hilos`
  WHERE evento IN ('message.received', 'message.read')),
x AS (
  SELECT gl.*, s.firmo, s.fecha_firma,
         -- respondio DESPUES de la gestion: es la senal que importa, no la
         -- conversacion previa que ya traia la lista
         (SELECT COUNT(*) FROM ev
          WHERE ev.tel = gl.tel AND ev.evento = 'message.received'
            AND ev.dia >= gl.fecha) AS resp_post,
         (SELECT COUNT(*) FROM ev
          WHERE ev.tel = gl.tel AND ev.evento = 'message.read'
            AND ev.dia >= gl.fecha) AS leyo_post
  FROM gl LEFT JOIN s USING (documento))
"""
BASE = BASE % (TEL % 'l.telefono', TEL % 'telefono')

for r in rq.q(BASE + """
SELECT COUNT(*) AS casos,
       COUNTIF(tel IS NULL) AS sin_telefono,
       COUNTIF(resp_post > 0) AS respondio_post,
       COUNTIF(leyo_post > 0) AS leyo_post,
       COUNTIF(firmo) AS firmaron
FROM x
"""):
    print('   casos trabajados      %s' % r['casos'])
    print('   sin telefono          %s' % r['sin_telefono'])
    print('   respondio post-gestion %s' % r['respondio_post'])
    print('   leyo post-gestion     %s' % r['leyo_post'])
    print('   firmaron              %s' % r['firmaron'])

print('\n=== 3. LA PREGUNTA: responder por WhatsApp predice la firma? ===')
print('   %-34s %7s %9s %8s' % ('grupo', 'casos', 'firmaron', 'tasa'))
for r in rq.q(BASE + """
SELECT CASE WHEN resp_post > 0 THEN 'Respondió por WhatsApp después'
            ELSE 'No respondió' END AS grupo,
       COUNT(*) AS casos, COUNTIF(firmo) AS firmaron,
       ROUND(100 * SAFE_DIVIDE(COUNTIF(firmo), COUNT(*)), 1) AS tasa
FROM x WHERE tel IS NOT NULL
GROUP BY 1 ORDER BY tasa DESC
"""):
    print('   %-34s %7s %9s %7s%%'
          % (r['grupo'], r['casos'], r['firmaron'], r['tasa']))

print('\n=== 4. Y cruzado con la causal, que es lo que hoy se ve en el tablero ===')
print('   %-28s %-14s %6s %8s %7s' % ('causal', 'wa despues', 'casos', 'firmaron', 'tasa'))
for r in rq.q(BASE + """
SELECT causal, IF(resp_post > 0, 'respondió', 'no') AS wa,
       COUNT(*) AS casos, COUNTIF(firmo) AS firmaron,
       ROUND(100 * SAFE_DIVIDE(COUNTIF(firmo), COUNT(*)), 1) AS tasa
FROM x WHERE tel IS NOT NULL AND causal IN ('No contesta', 'Cuelga', 'Otro')
GROUP BY 1, 2 ORDER BY causal, wa
"""):
    print('   %-28s %-14s %6s %8s %6s%%'
          % (r['causal'], r['wa'], r['casos'], r['firmaron'], r['tasa']))
