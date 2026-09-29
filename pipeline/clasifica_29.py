# -*- coding: utf-8 -*-
"""
Clasificacion final de las 29, verificada una por una.

Mi primera version decia "29 registros sin ficha en HubSpot, para depurar".
Eso estaba MAL: solo 7 no cruzan por ningun camino, y de esas solo 3 son
basura. Las otras 22 son problemas de enlace o de cuentas duplicadas en la
plataforma, y 4 son un hueco NUESTRO, no de BI.

Cada fila sale con accion y dueno explicitos.
"""
import io
import json
import re
import unicodedata

BASURA = re.compile(r'borrar|duplicad|prueba|test|no usar|eliminar', re.I)


def norm(x):
    s = str(x or '').upper()
    s = ''.join(c for c in unicodedata.normalize('NFD', s)
                if unicodedata.category(c) != 'Mn')
    s = re.sub(r'[^A-Z0-9 ]', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()


# Palabras genericas del rubro: si el unico token en comun es una de estas,
# el match NO vale. "ALO DENTAL" contra "Eje Clinica Dental" comparte
# DENTAL y no es la misma clinica.
VACIAS = {'DENTAL', 'ODONTOLOGIA', 'ODONTOLOGICO', 'ODONTOLOGICA', 'CLINICA',
          'CENTRO', 'CONSULTORIO', 'MEDICINA', 'ESTETICA', 'INTEGRAL',
          'SALUD', 'GRUPO', 'ESPECIALIZADA', 'VETERINARIA', 'MEDICO',
          'MEDICA', 'SEDE', 'PRINCIPAL', 'DOCTORA', 'DOCTOR'}


def tokens(x):
    return {t for t in norm(x).split() if len(t) > 3 and t not in VACIAS}


res = json.load(io.open('verif29.json', encoding='utf8'))
H = json.load(io.open('sheet_data.json', encoding='utf8'))
P = H['PLATAFORMA_SEDES']
px = {c: i for i, c in enumerate(P[0])}
plat = {str(r[px['id_sede']]).strip(): str(r[px['created']] or '')[:10]
        for r in P[1:]}

# El nombre que HubSpot tiene, para medir la confianza del match.
for x in res:
    m = re.search(r'(?:devuelve|HubSpot:) "?([^"(]+)"?', x['prueba'])
    x['nom_hs'] = (m.group(1).strip() if m else '')

out = []
for x in res:
    u, uh = x['uuid'], x.get('uuid_hs', '')
    nom, nomhs = x['nombre'], x['nom_hs']
    ambos = bool(uh) and (u in plat) and (uh in plat)
    creada_bi = plat.get(u, '')
    creada_hs = plat.get(uh, '') if uh else ''

    # Confianza del match por nombre
    if x['veredicto'] == 'SI EXISTE':
        conf = 'alta (nombre idéntico)'
    elif nomhs:
        ta, tb = tokens(nom), tokens(nomhs)
        inter = len(ta & tb)
        conf = ('alta (nombre casi idéntico)' if inter >= 2 or
                (inter == 1 and min(len(ta), len(tb)) == 1)
                else 'BAJA · revisar a mano')
    else:
        conf = '—'

    if x['veredicto'] == 'NO EXISTE':
        if BASURA.search(nom):
            accion, dueno = 'Borrar del reporte y de la plataforma', 'BI'
            clase = '1 · Registro de descarte'
        else:
            accion, dueno = ('Crear la ficha en HubSpot: es una clínica real '
                             'vinculada que no está en el CRM'), 'GROWTH'
            clase = '4 · Falta en HubSpot (hueco nuestro)'
    elif ambos and 'BAJA' not in conf:
        # dos cuentas de plataforma para la misma clinica
        vieja = (creada_hs and creada_hs < '2026-01')
        clase = '2 · Cuenta duplicada en la plataforma'
        accion = ('Unificar las dos cuentas de institucion_medica. ' +
                  ('OJO: la cuenta enlazada a HubSpot es de %s, así que esta '
                   'clínica NO es cosecha 2026.' % creada_hs if vieja
                   else 'Las dos se crearon casi el mismo día.'))
        dueno = 'BI + Plataforma'
    elif 'BAJA' in conf:
        clase = '3 · Coincidencia dudosa'
        accion = ('Revisar a mano: el nombre parecido puede no ser la misma '
                  'clínica')
        dueno = 'BI + GROWTH'
    else:
        clase = '3 · Coincidencia dudosa'
        accion = ('El id_internal que HubSpot guarda no aparece en el '
                  'extracto de plataforma: revisar el enlace')
        dueno = 'GROWTH'

    out.append({'mes': x['mes'], 'nombre': nom, 'uuid_bi': u,
                'creada_bi': creada_bi, 'nombre_hs': nomhs,
                'id_hs': x.get('id_hs', ''), 'uuid_hs': uh,
                'creada_hs': creada_hs, 'clase': clase, 'conf': conf,
                'accion': accion, 'dueno': dueno,
                'gerente': x.get('gerente', ''), 'tipo': x.get('tipo', '')})

out.sort(key=lambda r: (r['clase'], r['mes'], r['nombre'].lower()))
json.dump(out, io.open('clasif29.json', 'w', encoding='utf8'),
          ensure_ascii=False)

import collections
print('CLASIFICACION FINAL DE LAS 29')
for k, v in collections.Counter(r['clase'] for r in out).most_common():
    print('   %2d  %s' % (v, k))
print('\nPOR DUENO')
for k, v in collections.Counter(r['dueno'] for r in out).most_common():
    print('   %2d  %s' % (v, k))
print()
cl = None
for r in out:
    if r['clase'] != cl:
        cl = r['clase']
        print('\n=== %s ===' % cl)
    print('   %s  %-40s' % (r['mes'], r['nombre'][:40]))
    if r['nombre_hs']:
        print('      en HubSpot: "%s" (id %s) · su cuenta creada %s vs %s'
              % (r['nombre_hs'][:40], r['id_hs'], r['creada_bi'],
                 r['creada_hs'] or 'no está en el extracto'))
    print('      confianza %s · dueño %s' % (r['conf'], r['dueno']))
