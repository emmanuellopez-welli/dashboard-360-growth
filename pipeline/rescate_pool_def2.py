# -*- coding: utf-8 -*-
"""
Segundo intento de reproducir el "133 rescatados / $892 M" del correo.

La clave: lista_dia YA tiene aplicados los filtros del trabajable (fuera
CreditOp, fuera medicina alternativa, fuera recorte >10%, con documento y
celular). Asi que el pool trabajable no hay que reconstruirlo — es el
universo de documentos que el motor escribio en lista_dia.

Las regiones no se cruzan (trampa 7 del traspaso): lista_dia esta en US y
profile_institucion en us-central1. Dos consultas y el cruce en Python.
"""
import rq

FIRMADOS = ("'desembolsado','pendiente_desembolso','firma_contrato',"
            "'fulfilled'")

# --- 1. el pool trabajable, segun el propio motor (US) -------------------
pool = rq.q("""
SELECT documento, MIN(fecha) AS primera, MAX(fecha) AS ultima,
       MAX(monto) AS monto, MAX(aliado) AS aliado
FROM `welli-growth.rescate.lista_dia`
GROUP BY documento
""")
print('pool trabajable (documentos distintos en lista_dia): %d' % len(pool))
docs = {r['documento'] for r in pool if r['documento']}

# --- 2. el desenlace de esos documentos (us-central1) -------------------
# profile_institucion no tiene documento: se llega por profile.
des = rq.q("""
WITH p AS (
  SELECT CAST(pr.documento AS STRING) AS documento, pi.estado,
         pi.monto_aprobado,
         DATE(pi.created) AS creado,
         DATE(pi.fecha_solicitud_desembolso) AS firmado
  FROM `welli-tecnologia.public.profile_institucion` pi
  JOIN `welli-tecnologia.public.profile` pr ON pr.id = pi.profile_id
  WHERE pi.country_code = 'COL'
    AND DATE(pi.created) >= '2026-07-01')
SELECT documento, estado, monto_aprobado,
       CAST(creado AS STRING) AS creado,
       CAST(firmado AS STRING) AS firmado
FROM p
WHERE estado IN (%s) AND firmado IS NOT NULL
""" % FIRMADOS, proy='welli-tecnologia', loc='us-central1')
print('firmas en el core desde jul-2026: %d' % len(des))

# --- 3. el cruce ---------------------------------------------------------
def cuenta(desde, hasta, solo_pool, corte):
    n, m = 0, 0
    for r in des:
        if not (desde <= (r['firmado'] or '') <= hasta):
            continue
        if solo_pool and r['documento'] not in docs:
            continue
        if corte and r['creado'] and r['firmado']:
            from datetime import date
            a = date(*map(int, r['creado'].split('-')))
            b = date(*map(int, r['firmado'].split('-')))
            if (b - a).days < corte:
                continue
        n += 1
        m += float(r['monto_aprobado'] or 0)
    return n, m

print()
print('  %-46s %6s %10s' % ('definicion', 'casos', 'millones'))
for etq, solo, corte in [
        ('pool trabajable, sin corte de dias', True, 0),
        ('pool trabajable, firma >= 4 dias', True, 4),
        ('pool trabajable, firma >= 8 dias', True, 8),
        ('toda la base, firma >= 4 dias', False, 4)]:
    n, m = cuenta('2026-08-04', '2026-09-02', solo, corte)
    n1, m1 = cuenta('2026-09-01', '2026-09-01', solo, corte)
    print('  %-46s %6d %9.0f M   | 1-sep: %d casos $%.0f M'
          % (etq, n, m / 1e6, n1, m1 / 1e6))
print('\n  objetivo del correo:                             133       892 M'
      '   | 1-sep: 2 casos $23 M')
