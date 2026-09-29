# -*- coding: utf-8 -*-
"""
Auditoria completa: nuestras 173 de enero contra sus 122.

La pregunta es si ya esta todo depurado de nuestro lado. Para responderla no
sirve comparar totales: hay que ubicar CADA sede. La clave es que no son
dos conteos de lo mismo — son dos cohortes distintas de la misma poblacion:
nosotros agrupamos por fecha de creacion en HubSpot, ellos por fecha de
vinculacion. Una sede creada en enero y vinculada en octubre-2025 esta en
nuestro enero y en su octubre.
"""
import io
import json
import collections

import openpyxl

H = json.load(io.open('sheet_data.json', encoding='utf8'))
S = H['SEDES']
sx = {c: i for i, c in enumerate(S[0])}
P = H['PLATAFORMA_SEDES']
px = {c: i for i, c in enumerate(P[0])}
plat = {str(r[px['id_sede']]).strip():
        {'pais': str(r[px['pais']] or 'COL'),
         'vinc': str(r[px['created']] or '')[:7]} for r in P[1:]}

XL = ('c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/'
      'Cosechas 2026 sedes tablero360 (2).xlsx')
hf = openpyxl.load_workbook(XL, data_only=True)['Farmer']
cab = [c.value for c in hf[1]]
ci = {c: i for i, c in enumerate(cab) if c}
suyas = {}
for r in hf.iter_rows(min_row=2, values_only=True):
    u = str(r[ci['id_clinica']] or '').strip()
    if u:
        suyas[u] = {'mes': str(r[ci['fecha_vinculacion']] or '')[:7],
                    'nombre': str(r[ci['nombre_comercial']] or '')}

MES = '2026-01'

# --- nuestras 173: cohorte por fecha de creacion en HubSpot -------------
nuestras = []
for r in S[1:]:
    if 'deshabilitad' in str(r[sx['pipeline']] or '').lower():
        continue
    u = str(r[sx['id_internal']] or '').strip()
    if not u or u not in plat or plat[u]['pais'] != 'COL':
        continue
    if str(r[sx['cosecha']] or '')[:7] != MES:
        continue
    nuestras.append({'u': u, 'nombre': str(r[sx['nombre_sede']] or ''),
                     'vinc': plat[u]['vinc'],
                     'origen': str(r[sx['origen']] or '')})
print('NUESTRA COSECHA DE %s (reloj HubSpot): %d sedes' % (MES, len(nuestras)))

# --- donde esta cada una en SU tablero ----------------------------------
c = collections.Counter()
det = collections.defaultdict(list)
for x in nuestras:
    s = suyas.get(x['u'])
    if not s:
        k = 'no esta en su hoja'
    elif s['mes'] == MES:
        k = 'en su MISMA cosecha (enero)'
    elif not s['mes']:
        k = 'en su hoja sin fecha de vinculacion'
    elif s['mes'] < MES:
        k = 'en su cosecha ANTERIOR: ' + s['mes']
    else:
        k = 'en su cosecha POSTERIOR: ' + s['mes']
    c[k] += 1
    if len(det[k]) < 5:
        det[k].append(x)

print('\nDONDE ESTA CADA UNA DE NUESTRAS %d EN SU TABLERO' % len(nuestras))
for k, v in sorted(c.items(), key=lambda t: -t[1]):
    print('   %4d  %s' % (v, k))

print('\nDetalle de las que caen en OTRO mes (ejemplos):')
for k in sorted(det):
    if 'MISMA' in k or 'no esta' in k:
        continue
    for x in det[k]:
        print('   %-42s creada ene · vinculada %s' % (x['nombre'][:42],
                                                      x['vinc']))

# --- y al reves: sus 122 ------------------------------------------------
sus = [u for u, s in suyas.items() if s['mes'] == MES]
nuestro_mes = {}
for r in S[1:]:
    u = str(r[sx['id_internal']] or '').strip()
    if u:
        nuestro_mes[u] = {
            'cos': str(r[sx['cosecha']] or '')[:7],
            'desh': 'deshabilitad' in str(r[sx['pipeline']] or '').lower(),
            'nombre': str(r[sx['nombre_sede']] or '')}
c2 = collections.Counter()
for u in sus:
    n = nuestro_mes.get(u)
    if not n:
        c2['no tiene ficha en HubSpot'] += 1
    elif n['desh']:
        c2['la excluimos: deshabilitada'] += 1
    elif n['cos'] == MES:
        c2['en nuestra MISMA cosecha (enero)'] += 1
    elif not n['cos']:
        c2['en nuestra hoja sin cosecha'] += 1
    elif n['cos'] < MES:
        c2['en nuestra cosecha ANTERIOR: ' + n['cos']] += 1
    else:
        c2['en nuestra cosecha POSTERIOR: ' + n['cos']] += 1
print('\nY AL REVES · sus %d de enero, donde caen en el nuestro' % len(sus))
for k, v in sorted(c2.items(), key=lambda t: -t[1]):
    print('   %4d  %s' % (v, k))

# --- resumen de todos los meses -----------------------------------------
print('\n\nRESUMEN TODOS LOS MESES · cuanto del gap es "otro mes" y cuanto es')
print('"sede que no comparten"')
print('%-9s %7s %7s %10s %12s %12s %10s'
      % ('cosecha', 'nuestro', 'suyo', 'coinciden', 'nuestras en',
         'suyas en', 'sin ficha'))
print('%-9s %7s %7s %10s %12s %12s %10s'
      % ('', '(CRM)', '(vinc)', '', 'otro mes suyo', 'otro mes nuestro', 'HubSpot'))
for m in ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06',
          '2026-07']:
    nues = [x for x in
            ({'u': str(r[sx['id_internal']] or '').strip(),
              'cos': str(r[sx['cosecha']] or '')[:7],
              'desh': 'deshabilitad' in str(r[sx['pipeline']] or '').lower()}
             for r in S[1:])
            if x['u'] and not x['desh'] and x['cos'] == m
            and x['u'] in plat and plat[x['u']]['pais'] == 'COL']
    sm = [u for u, s in suyas.items() if s['mes'] == m]
    ig = sum(1 for x in nues if suyas.get(x['u'], {}).get('mes') == m)
    otro = sum(1 for x in nues
               if x['u'] in suyas and suyas[x['u']]['mes'] != m)
    noesta = sum(1 for x in nues if x['u'] not in suyas)
    otroN = sum(1 for u in sm
                if u in nuestro_mes and not nuestro_mes[u]['desh']
                and nuestro_mes[u]['cos'] != m)
    sinf = sum(1 for u in sm if u not in nuestro_mes)
    print('%-9s %7d %7d %10d %12d %12d %10d'
          % (m, len(nues), len(sm), ig, otro + noesta, otroN, sinf))
