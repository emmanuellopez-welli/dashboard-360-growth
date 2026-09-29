# -*- coding: utf-8 -*-
"""
Verifica una por una las 29 que declare "sin ficha en HubSpot".

Mi chequeo anterior fue por UUID: si el id_internal de su hoja no aparecia en
mi hoja SEDES, la marque como inexistente. Eso es insuficiente y la leccion
de Dra Martha Cardona lo prueba: una sede puede existir en HubSpot con el
id_internal VACIO, y entonces la busqueda por UUID falla aunque la ficha si
este.

Aca se verifica por tres caminos, contra HubSpot EN VIVO:
  1. id_internal exacto
  2. nombre normalizado exacto
  3. busqueda por nombre en la API (CONTAINS_TOKEN), que atrapa variantes
"""
import io
import json
import re
import unicodedata
import collections

import openpyxl

import lib

HS = 'ca_13P0RgH6oZrv'
OBJ = '2-50958246'


def proxy(ep, method='GET', body=None):
    kw = dict(endpoint=ep, method=method, connected_account_id=HS)
    if body is not None:
        kw['body'] = body
    r = lib.C.tools.proxy(**kw)
    d = getattr(r, 'data', r)
    if isinstance(d, str):
        d = json.loads(d)
    return d


def norm(x):
    s = str(x or '').upper()
    s = ''.join(c for c in unicodedata.normalize('NFD', s)
                if unicodedata.category(c) != 'Mn')
    s = re.sub(r'[^A-Z0-9 ]', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()


# --- las 29 de su hoja ---------------------------------------------------
XL = ('c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/'
      'Cosechas 2026 sedes tablero360 (2).xlsx')
hf = openpyxl.load_workbook(XL, data_only=True)['Farmer']
cab = [c.value for c in hf[1]]
ci = {c: i for i, c in enumerate(cab) if c}

# El universo vivo de HubSpot, recien jalado.
vivo = json.load(io.open('tables_sedes.json', encoding='utf8'))['SEDES']
vx = {c: i for i, c in enumerate(vivo[0])}
por_uuid, por_nom = {}, collections.defaultdict(list)
for r in vivo[1:]:
    u = str(r[vx['id_internal']] or '').strip()
    d = {'id': str(r[vx['id']]), 'nombre': str(r[vx['nombre_sede']] or ''),
         'uuid': u, 'pipeline': str(r[vx['pipeline']] or ''),
         'cosecha': str(r[vx['cosecha']] or '')}
    if u:
        por_uuid[u] = d
    por_nom[norm(d['nombre'])].append(d)

MESES = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06',
         '2026-07']
cand = []
for r in hf.iter_rows(min_row=2, values_only=True):
    u = str(r[ci['id_clinica']] or '').strip()
    m = str(r[ci['fecha_vinculacion']] or '')[:7]
    if not u or m not in MESES:
        continue
    if u in por_uuid:
        continue                      # cruza por UUID, no es candidata
    cand.append({'uuid': u, 'mes': m,
                 'nombre': str(r[ci['nombre_comercial']] or ''),
                 'hs_declarado': str(r[ci['id_hubspot']] or '').strip(),
                 'gerente': str(r[ci['Gerente']] or ''),
                 'tipo': str(r[ci['tipo_vinculacion']] or '')})
print('%d candidatas (no cruzan por UUID contra HubSpot en vivo)\n' % len(cand))

# --- verificacion 1 por 1 ------------------------------------------------
res = []
for c in cand:
    veredicto, prueba = None, ''

    # a) el id_hubspot que ELLOS declaran, si trae algo
    if c['hs_declarado'] and c['hs_declarado'].lower() not in ('none', ''):
        for r in vivo[1:]:
            if str(r[vx['id']]) == c['hs_declarado']:
                veredicto = 'SI EXISTE'
                prueba = ('id_hubspot de su hoja: %s (%s)'
                          % (c['hs_declarado'], r[vx['nombre_sede']]))
                break

    # b) nombre normalizado exacto
    if not veredicto:
        hit = por_nom.get(norm(c['nombre']))
        if hit:
            veredicto = 'SI EXISTE'
            prueba = ('mismo nombre en HubSpot: id %s, id_internal %s'
                      % (hit[0]['id'], hit[0]['uuid'] or 'VACIO'))

    # c) busqueda en la API por tokens del nombre
    if not veredicto:
        tok = [t for t in norm(c['nombre']).split()
               if len(t) > 3 and not t.isdigit()][:3]
        if tok:
            try:
                d = proxy('/crm/v3/objects/%s/search' % OBJ, 'POST', {
                    'filterGroups': [{'filters': [
                        {'propertyName': 'nombre_sede',
                         'operator': 'CONTAINS_TOKEN',
                         'value': ' '.join(tok)}]}],
                    'properties': ['nombre_sede', 'id_internal'],
                    'limit': 5})
                hits = d.get('results') or []
                if hits:
                    p = hits[0].get('properties') or {}
                    veredicto = 'POSIBLE COINCIDENCIA'
                    prueba = ('la API devuelve "%s" (id %s, id_internal %s)'
                              % (p.get('nombre_sede'), hits[0].get('id'),
                                 p.get('id_internal') or 'VACIO'))
            except Exception as e:
                prueba = 'busqueda fallo: %s' % str(e)[:60]

    if not veredicto:
        veredicto = 'NO EXISTE'
        prueba = 'sin cruce por UUID, por nombre ni por la API'
    c['veredicto'] = veredicto
    c['prueba'] = prueba
    res.append(c)

orden = {'NO EXISTE': 0, 'POSIBLE COINCIDENCIA': 1, 'SI EXISTE': 2}
res.sort(key=lambda x: (orden[x['veredicto']], x['mes'], x['nombre'].lower()))

cnt = collections.Counter(x['veredicto'] for x in res)
print('VEREDICTO')
for k in ('NO EXISTE', 'POSIBLE COINCIDENCIA', 'SI EXISTE'):
    if cnt[k]:
        print('   %2d  %s' % (cnt[k], k))
print()
for x in res:
    print('%-22s %s  %-38s' % (x['veredicto'], x['mes'], x['nombre'][:38]))
    print('%-22s   %s' % ('', x['prueba'][:104]))

json.dump(res, io.open('verif29.json', 'w', encoding='utf8'),
          ensure_ascii=False)
