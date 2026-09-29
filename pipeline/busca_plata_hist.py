# -*- coding: utf-8 -*-
"""Busca si hay plata reconstruible para el historico viejo (gestion_historica,
oct-2024 a jul-2026): esa tabla no trae monto, pero SI trae 'documento' y
'marcado_firma_credito'. Si eso cruza contra t_sol_v2 (que si tiene montos),
se puede reconstruir la plata mes a mes de la operacion vieja."""
import lib

# 1) Confirmar que documento existe y como se ve
muestra = lib.bq("""
SELECT documento, marcado_firma_credito, fecha_seguimiento
FROM `welli-growth.rescate.gestion_historica`
WHERE tiene_gestion = 'True' AND marcado_firma_credito = TRUE
LIMIT 5
""", project='welli-data', location='US')
print('muestra gestion_historica (firmados):')
for r in muestra:
    print(' ', r)

# 2) Cuantos documentos firmados unicos hay en total
firmados = lib.bq("""
SELECT documento, FORMAT_DATE('%Y-%m', fecha_seguimiento) AS mes
FROM `welli-growth.rescate.gestion_historica`
WHERE tiene_gestion = 'True' AND marcado_firma_credito = TRUE
  AND fecha_seguimiento IS NOT NULL
""", project='welli-data', location='US')
print('\nfilas firmadas (marcado_firma_credito=true):', len(firmados))
docs = set(r['documento'] for r in firmados if r['documento'])
print('documentos unicos:', len(docs))
