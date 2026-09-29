# -*- coding: utf-8 -*-
"""Que significa 'deshabilitada' en la base de sedes, y cuantas son.
Miro las dos candidatas juntas: la etapa de pipeline llamada
'Deshabilitado' y la propiedad fb_deshabilitado."""
import lib, json, io, collections
HS = 'ca_13P0RgH6oZrv'
PROPS = ['nombre_sede', 'id_internal', 'origen', 'hs_pipeline', 'hs_pipeline_stage',
         'fb_deshabilitado', 'estado_sede', 'bq_estado_actividad', 'hs_createdate',
         'aplicaciones', 'desembolsos', 'monto_total_desembolsado',
         'hs_v2_date_entered_1327734139', 'clasificacion_aliado', 'ciudad_municipio']

def proxy(ep):
    r = lib.C.tools.proxy(endpoint=ep, method='GET', connected_account_id=HS)
    d = getattr(r, 'data', r)
    if isinstance(d, str):
        d = json.loads(d)
    return d

pl = proxy('/crm/v3/pipelines/2-50958246')
etapas = {}
for p in pl.get('results') or []:
    for s in p.get('stages') or []:
        etapas[s['id']] = p.get('label', '?') + ' / ' + s.get('label', '?')
print('ETAPAS del objeto Sedes')
for k, v in etapas.items():
    print('  %-14s %s' % (k, v))

base = '/crm/v3/objects/2-50958246?limit=100&properties=' + ','.join(PROPS)
after, sedes = None, []
while True:
    d = proxy(base + ('&after=' + after if after else ''))
    sedes.extend(d.get('results') or [])
    after = (((d.get('paging') or {}).get('next') or {}).get('after'))
    if not after:
        break
print('\n%d sedes leidas' % len(sedes))
json.dump(sedes, io.open('sedes_deshab.json', 'w', encoding='utf8'), ensure_ascii=False)

et = collections.Counter()
fb = collections.Counter()
for x in sedes:
    p = x.get('properties') or {}
    et[etapas.get(p.get('hs_pipeline_stage'), p.get('hs_pipeline_stage'))] += 1
    fb[str(p.get('fb_deshabilitado'))] += 1
print('\nPor etapa:')
for k, v in et.most_common():
    print('  %5d  %s' % (v, k))
print('\nfb_deshabilitado:')
for k, v in fb.most_common():
    print('  %5d  %s' % (v, k))
