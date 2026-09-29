# -*- coding: utf-8 -*-
"""
Segunda vuelta: si el nombre coincide pero el UUID no, la pregunta real es si
la PLATAFORMA tiene dos cuentas para la misma clinica.

BI usa id_clinica (un UUID de institucion_medica). HubSpot guarda id_internal
(otro UUID de institucion_medica). Si los nombres son el mismo consultorio y
los UUID difieren, el duplicado esta en la plataforma, no falta una ficha en
HubSpot. Eso cambia por completo la accion a pedir.

Se consulta institucion_medica por los dos UUID y se comparan nombre, ciudad
y fecha de creacion.
"""
import io
import json

import rq

res = json.load(io.open('verif29.json', encoding='utf8'))

# El UUID que HubSpot tiene para el nombre coincidente, extraido de la prueba.
import re
for x in res:
    m = re.search(r'id_internal ([0-9a-f-]{36})', x['prueba'])
    x['uuid_hs'] = m.group(1) if m else ''
    m2 = re.search(r'id (\d{8,})', x['prueba'])
    x['id_hs'] = m2.group(1) if m2 else ''

uuids = set()
for x in res:
    uuids.add(x['uuid'])
    if x['uuid_hs']:
        uuids.add(x['uuid_hs'])
lista = "','".join(sorted(uuids))

filas = rq.q("""
SELECT id, nombre_comercial, razon_social, ciudad, especialidad,
       deshabilidato, CAST(DATE(created) AS STRING) AS creado,
       CAST(deleted_at IS NOT NULL AS STRING) AS borrado
FROM `welli-tecnologia.public.institucion_medica`
WHERE id IN ('%s')
""" % lista, proy='welli-tecnologia', loc='us-central1')
info = {r['id']: r for r in filas}
print('%d de %d UUID encontrados en institucion_medica\n'
      % (len(info), len(uuids)))

def desc(u):
    r = info.get(u)
    if not r:
        return 'NO EXISTE en institucion_medica'
    return '%s | %s | creada %s | desh=%s | borrada=%s' % (
        (r['nombre_comercial'] or r['razon_social'] or '?')[:34],
        (r['ciudad'] or '?')[:14], r['creado'], r['deshabilidato'],
        r['borrado'])

print('=== LAS QUE COINCIDEN POR NOMBRE: son dos cuentas o una? ===')
for x in res:
    if x['veredicto'] == 'NO EXISTE' or not x['uuid_hs']:
        continue
    a, b = info.get(x['uuid']), info.get(x['uuid_hs'])
    mismo = ''
    if a and b:
        na = (a['nombre_comercial'] or '').strip().lower()
        nb = (b['nombre_comercial'] or '').strip().lower()
        ca = (a['ciudad'] or '').strip().lower()
        cb = (b['ciudad'] or '').strip().lower()
        if na == nb and ca == cb:
            mismo = 'DUPLICADO CLARO (mismo nombre y ciudad)'
        elif ca == cb:
            mismo = 'probable duplicado (misma ciudad, nombre distinto)'
        else:
            mismo = 'OJO: ciudades distintas, revisar a mano'
    print('\n%-38s [%s]' % (x['nombre'][:38], x['veredicto']))
    print('   uuid de BI       %s' % desc(x['uuid']))
    print('   uuid de HubSpot  %s' % desc(x['uuid_hs']))
    if mismo:
        print('   -> %s' % mismo)
    x['diag_plat'] = mismo

print('\n=== LAS 7 QUE NO CRUZARON POR NINGUN CAMINO ===')
for x in res:
    if x['veredicto'] != 'NO EXISTE':
        continue
    print('   %-40s %s' % (x['nombre'][:40], desc(x['uuid'])))

json.dump(res, io.open('verif29.json', 'w', encoding='utf8'),
          ensure_ascii=False)
