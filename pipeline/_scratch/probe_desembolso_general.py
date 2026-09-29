# -*- coding: utf-8 -*-
"""Reproduce la definicion de "desembolsos en general" de la jefa (misma
tabla/join que su query), SIN el filtro de 'dias_hasta_firma > 2' -- ese
filtro es especifico del reporte puntual que ella mostro (parece aislar
casos de firma tardia), y excluirlo aca dejaria fuera las firmas el mismo
dia, que son la mayoria segun lo medido antes (68.9% en 24h).

Se prueba primero CON el filtro (para confirmar que la query corre igual
que la de ella) y despues SIN, mes a mes, para ver la escala real."""
import lib
import collections

SQL_CON_FILTRO = """
WITH p AS (
  SELECT referencia_pago, DATE(created) AS creado, monto_aprobado
  FROM `welli-tecnologia.public.profile_institucion`
  WHERE estado IN ('desembolsado','pendiente_desembolso','fulfilled','firma_contrato')
), s AS (
  SELECT referencia_pago, fecha_firma_contrato,
         ROW_NUMBER() OVER (PARTITION BY referencia_pago
                            ORDER BY fecha_corte_solicitud DESC) AS rn
  FROM `welli-data.data_ops.t_solicitudes`
)
SELECT CAST(p.referencia_pago AS STRING) AS referencia, p.monto_aprobado AS monto,
       s.fecha_firma_contrato AS fecha_firma,
       DATE_DIFF(s.fecha_firma_contrato, p.creado, DAY) AS dias_hasta_firma
FROM p JOIN s ON s.referencia_pago = p.referencia_pago AND s.rn = 1
WHERE s.fecha_firma_contrato IS NOT NULL
  AND s.fecha_firma_contrato >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
  AND DATE_DIFF(s.fecha_firma_contrato, p.creado, DAY) > 2
ORDER BY monto DESC
LIMIT 5
"""
r = lib.bq(SQL_CON_FILTRO, project='welli-tecnologia')
print('CON el filtro (la query tal cual la mando ella), primeras filas:')
for x in r:
    print(' ', x)
print('(si esto no da error, la query corre igual que la de ella)')

print()
print('=== SIN el filtro de dias_hasta_firma, monto general por mes ===')
SQL_MES = """
WITH p AS (
  SELECT referencia_pago, DATE(created) AS creado, monto_aprobado
  FROM `welli-tecnologia.public.profile_institucion`
  WHERE estado IN ('desembolsado','pendiente_desembolso','fulfilled','firma_contrato')
), s AS (
  SELECT referencia_pago, fecha_firma_contrato,
         ROW_NUMBER() OVER (PARTITION BY referencia_pago
                            ORDER BY fecha_corte_solicitud DESC) AS rn
  FROM `welli-data.data_ops.t_solicitudes`
)
SELECT FORMAT_DATE('%Y-%m', s.fecha_firma_contrato) AS mes,
       COUNT(*) AS casos, SUM(p.monto_aprobado) AS monto
FROM p JOIN s ON s.referencia_pago = p.referencia_pago AND s.rn = 1
WHERE s.fecha_firma_contrato IS NOT NULL
  AND s.fecha_firma_contrato >= DATE '2026-06-01'
GROUP BY mes
ORDER BY mes
"""
r2 = lib.bq(SQL_MES, project='welli-tecnologia')
for x in r2:
    print('  %s  %5s casos  $%s' % (x['mes'], x['casos'], x['monto']))
