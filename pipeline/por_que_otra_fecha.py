# -*- coding: utf-8 -*-
"""
Por que la fecha de HubSpot no es la de vinculacion, en las 76 de enero.

Dos fenomenos opuestos que hay que separar:
  · vinculada ANTES que creada  -> la ficha se creo despues del hecho
  · vinculada DESPUES que creada -> flujo normal de pipeline: el prospecto
    entra al CRM y se vincula mas tarde

Si las creaciones se agrupan en pocos dias u horas, fue una carga masiva y
no un proceso continuo. Eso se ve en la marca de tiempo exacta.
"""
import io
import json
import datetime
import collections

H = json.load(io.open('sheet_data.json', encoding='utf8'))
S = H['SEDES']
sx = {c: i for i, c in enumerate(S[0])}
P = H['PLATAFORMA_SEDES']
px = {c: i for i, c in enumerate(P[0])}
plat = {str(r[px['id_sede']]).strip():
        {'pais': str(r[px['pais']] or 'COL'),
         'vinc': str(r[px['created']] or '')[:10]} for r in P[1:]}

# hs_createdate completo, del pull en vivo
crea = {}
for x in json.load(io.open('sedes_traspaso.json', encoding='utf8')):
    p = x.get('properties') or {}
    u = str(p.get('id_internal') or '').strip()
    if u:
        crea[u] = str(p.get('hs_createdate') or '')


def d(s):
    try:
        return datetime.date(*map(int, str(s)[:10].split('-')))
    except Exception:
        return None


# nuestra cosecha de enero
casos = []
for r in S[1:]:
    if 'deshabilitad' in str(r[sx['pipeline']] or '').lower():
        continue
    u = str(r[sx['id_internal']] or '').strip()
    if not u or u not in plat or plat[u]['pais'] != 'COL':
        continue
    if str(r[sx['cosecha']] or '')[:7] != '2026-01':
        continue
    cd = crea.get(u, '')
    casos.append({'u': u, 'nombre': str(r[sx['nombre_sede']] or ''),
                  'creada': d(cd), 'ts': cd,
                  'vinc': d(plat[u]['vinc']),
                  'origen': str(r[sx['origen']] or '') or '(sin origen)',
                  'pipe': str(r[sx['pipeline']] or '')})

desfase = [x for x in casos
           if x['creada'] and x['vinc']
           and x['creada'].strftime('%Y-%m') != x['vinc'].strftime('%Y-%m')]
print('nuestra cosecha enero: %d sedes · con desfase de mes: %d'
      % (len(casos), len(desfase)))

antes = [x for x in desfase if x['vinc'] < x['creada']]
despues = [x for x in desfase if x['vinc'] > x['creada']]
print('   vinculada ANTES de crear la ficha:  %d' % len(antes))
print('   vinculada DESPUES de crear la ficha: %d' % len(despues))

# --- cargas masivas: la ficha se creo el mismo dia y hora? --------------
print('\n1) LAS %d QUE SE VINCULARON ANTES · cuando se creo su ficha' % len(antes))
porDia = collections.Counter(x['creada'].isoformat() for x in antes)
for dia, n in sorted(porDia.items()):
    horas = collections.Counter(x['ts'][11:16] for x in antes
                                if x['creada'].isoformat() == dia)
    hh = ', '.join('%s (%d)' % (h, c) for h, c in horas.most_common(3))
    print('   %s  %3d fichas   horas: %s' % (dia, n, hh))

dias = sorted((x['creada'] - x['vinc']).days for x in antes)
if dias:
    print('   dias entre vinculacion y creacion de la ficha:')
    print('      mediana %d · min %d · max %d' % (dias[len(dias) // 2],
                                                  dias[0], dias[-1]))

print('\n2) LAS %d QUE SE VINCULARON DESPUES · flujo normal de pipeline'
      % len(despues))
dias2 = sorted((x['vinc'] - x['creada']).days for x in despues)
if dias2:
    print('   dias entre creacion de la ficha y vinculacion:')
    print('      mediana %d · min %d · max %d' % (dias2[len(dias2) // 2],
                                                  dias2[0], dias2[-1]))
porOri = collections.Counter(x['origen'] for x in despues)
print('   por origen: %s'
      % ', '.join('%s %d' % (k, v) for k, v in porOri.most_common(5)))

# --- contraste: las 97 que SI coinciden --------------------------------
coin = [x for x in casos
        if x['creada'] and x['vinc']
        and x['creada'].strftime('%Y-%m') == x['vinc'].strftime('%Y-%m')]
dd = sorted(abs((x['creada'] - x['vinc']).days) for x in coin)
print('\n3) CONTRASTE · las %d que SI caen en el mismo mes' % len(coin))
if dd:
    print('   dias de diferencia: mediana %d · p90 %d · max %d'
          % (dd[len(dd) // 2], dd[int(len(dd) * .9)], dd[-1]))
    print('   creadas el MISMO dia que la vinculacion: %d de %d'
          % (sum(1 for v in dd if v == 0), len(dd)))
