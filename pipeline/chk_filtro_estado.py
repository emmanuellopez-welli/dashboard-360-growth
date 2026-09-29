# -*- coding: utf-8 -*-
"""Simulacion PUNTUAL pedida por Emmanuel (28-sep-2026). NO toca el tablero.
Del embudo de WhatsApp 20-28 sep, dejar en "Aprobados" SOLO los creditos en
estado distinto a desembolsado/fulfilled/pendiente_desembolso/
pendiente_aprobacion_medico/pendiente_validacion_cliente."""
import json

import lib

FUERA = {'desembolsado', 'fulfilled', 'pendiente_desembolso',
         'pendiente_aprobacion_medico', 'pendiente_validacion_cliente'}
INI, FIN = '2026-09-20', '2026-09-28'

d = json.load(open('sheet_data.json', encoding='utf8'))
P = d['RESCATE_WA_PACIENTES']
h = P[0]
iT, iF = h.index('telefono'), h.index('fecha_aprobacion')
iE, iEn, iL, iR = (h.index('enviado'), h.index('entregado'),
                   h.index('leido'), h.index('respondio'))

pob = {}
for r in P[1:]:
    f = str(r[iF])[:10]
    if INI <= f <= FIN:
        pob[str(r[iT])] = (int(r[iE] or 0), int(r[iEn] or 0),
                           int(r[iL] or 0), int(r[iR] or 0))
print('Aprobados en el tablero (20-28 sep): %d' % len(pob))

# Estado ACTUAL de cada uno, por telefono
SQL = """
SELECT RIGHT(REGEXP_REPLACE(nro_celular_paciente, r'[^0-9]', ''), 10) AS tel,
       ARRAY_AGG(estado ORDER BY fecha_solicitud DESC LIMIT 1)[OFFSET(0)] AS estado
FROM `welli-data.comercial_ops.t_sol_v2`
WHERE nro_celular_paciente IS NOT NULL
  AND estado IN ('approved','desembolsado','fulfilled','pendiente_desembolso','firma_contrato')
  AND DATE(fecha_solicitud, "America/Bogota") BETWEEN '%s' AND '%s'
GROUP BY tel
""" % (INI, FIN)
est = {x['tel']: x['estado'] for x in lib.bq(SQL, project='welli-data')}
print('con estado en BigQuery: %d' % sum(1 for t in pob if t in est))

import collections
print()
print('--- estado actual de los 1.605 ---')
for e, n in collections.Counter(est.get(t, '(no cruza)') for t in pob).most_common():
    print('  %-30s %5d' % (e, n))

queda = [t for t in pob if est.get(t) and est[t] not in FUERA]
print()
print('=' * 62)
print('APROBADOS que quedan (estado NO en la lista): %d  (de %d)' % (len(queda), len(pob)))
print('=' * 62)


def emb(lista, etq):
    n = len(lista)
    if not n:
        print('  %s: 0' % etq)
        return
    env = sum(1 for t in lista if pob[t][0])
    ent = sum(1 for t in lista if pob[t][1])
    lei = sum(1 for t in lista if pob[t][2])
    res = sum(1 for t in lista if pob[t][3])
    print()
    print('  %s' % etq)
    print('    Aprobados               %5d   100%%' % n)
    print('    Recibieron confirmacion %5d   %.1f%%' % (env, 100.0 * env / n))
    print('    Entregado               %5d   %.1f%%' % (ent, 100.0 * ent / n))
    print('    Leido                   %5d   %.1f%%' % (lei, 100.0 * lei / n))
    print('    Respondieron algo       %5d   %.1f%%' % (res, 100.0 * res / n))
    print('    SIN confirmacion        %5d   %.1f%%' % (n - env, 100.0 * (n - env) / n))


emb(list(pob), 'HOY en el tablero (todos los aprobados)')
emb(queda, 'CON EL FILTRO PEDIDO (solo approved / firma_contrato)')
