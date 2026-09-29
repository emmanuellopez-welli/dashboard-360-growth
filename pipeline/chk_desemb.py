# -*- coding: utf-8 -*-
"""Hallazgo inesperado: los que NO recibieron la confirmacion desembolsan
MUCHO mas (59,6% vs 13,0%). Eso no puede ser efecto del mensaje — sugiere
que los dos grupos son estructuralmente distintos. Se mira el tiempo entre
aprobacion y desembolso, que es la explicacion mas probable."""
import json

import lib

d = json.load(open('wa_post15.json'))
sin = {t for t, f in d['sin']}
con = {t for t, f in d['con']}

SQL = """
WITH apro AS (
  SELECT
    RIGHT(REGEXP_REPLACE(s.nro_celular_paciente, r'[^0-9]', ''), 10) AS tel,
    s.id_profile_insititucion AS app_id,
    s.estado,
    s.canal_de_welli, s.integrador, s.metodo_entrada_paciente,
    DATE(s.fecha_solicitud, "America/Bogota") AS f_sol,
    s.fecha_firma_contrato AS f_firma
  FROM `welli-data.comercial_ops.t_sol_v2` s
  WHERE s.estado IN ('approved','desembolsado','fulfilled',
                     'pendiente_desembolso','firma_contrato')
    AND s.nro_celular_paciente IS NOT NULL
    AND DATE(s.fecha_solicitud, "America/Bogota") >= '2026-09-16'
)
SELECT tel, ANY_VALUE(estado) estado,
       ANY_VALUE(canal_de_welli) canal, ANY_VALUE(integrador) integrador,
       ANY_VALUE(metodo_entrada_paciente) metodo,
       MIN(f_sol) f_sol, MIN(f_firma) f_firma,
       DATE_DIFF(MIN(f_firma), MIN(f_sol), DAY) dias
FROM apro GROUP BY tel
"""
r = lib.bq(SQL, project='welli-data')
por = {x['tel']: x for x in r}
print('cruzados: %d' % len(por))

import collections


def perfil(grupo, nombre):
    enc = [por[t] for t in grupo if t in por]
    print()
    print('=== %s (n=%d) ===' % (nombre, len(enc)))
    est = collections.Counter(x['estado'] for x in enc)
    print('  estado actual:', dict(est.most_common(6)))
    dias = [int(x['dias']) for x in enc if x['dias'] not in (None, '')]
    if dias:
        dias.sort()
        mismo = sum(1 for v in dias if v <= 0)
        print('  con fecha de firma: %d · mediana %d dias · firmaron el MISMO dia: %d (%.0f%%)'
              % (len(dias), dias[len(dias) // 2], mismo, 100.0 * mismo / len(dias)))
    can = collections.Counter(str(x['canal'] or '(vacio)') for x in enc)
    print('  canal_de_welli:', dict(can.most_common(4)))
    met = collections.Counter(str(x['metodo'] or '(vacio)') for x in enc)
    print('  metodo_entrada:', dict(met.most_common(4)))


perfil(sin, 'SIN confirmacion')
perfil(con, 'CON confirmacion')
