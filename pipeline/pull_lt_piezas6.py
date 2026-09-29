# -*- coding: utf-8 -*-
"""Paso 6: motor de WhatsApp para Long Tail. Para las sedes con telefono
conocido, trae TODOS sus eventos de Hilos una sola vez y los cruza LOCAL
contra cada toque de LT_TOUCHES (ventana: dia del toque a +3 dias) para
estimar entregado/leido/respondio por pieza. Es una ventana APROXIMADA
(decision de Emmanuel 14-sep-2026): si una sede recibe dos piezas seguidas
no se puede probar cual leyo con certeza -- se declara en pantalla."""
import lib, json, io, sys, re, collections, datetime

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

telPorSede = json.load(io.open('lt_tel_sedes.json', encoding='utf8'))
telSet = set(telPorSede.values())
print('telefonos unicos a buscar en Hilos:', len(telSet))

r = lib.bq("""
  SELECT telefono, evento, direccion, DATE(ts_evento,"America/Bogota") AS dia
  FROM `welli-growth.rescate.eventos_hilos`
  WHERE direccion IN ('OUTBOUND','INBOUND')
""", project='welli-data', location='US')
print('eventos_hilos leidos:', len(r))

def norm(t):
    return re.sub(r'\D', '', str(t or ''))[-10:]

porTel = collections.defaultdict(lambda: {'entregado': set(), 'leido': set(), 'respondio': set()})
for x in r:
    t = norm(x['telefono'])
    if t not in telSet:
        continue
    d = str(x['dia'])
    b = porTel[t]
    ev = x['evento']
    if x['direccion'] == 'OUTBOUND':
        if ev == 'message.delivered':
            b['entregado'].add(d)
        elif ev == 'message.read':
            b['leido'].add(d)
    elif x['direccion'] == 'INBOUND' and ev == 'message.received':
        b['respondio'].add(d)

json.dump({k: {kk: sorted(vv) for kk, vv in v.items()} for k, v in porTel.items()},
          io.open('lt_wa_por_tel.json', 'w', encoding='utf8'), ensure_ascii=False)
print('sedes con algun evento en Hilos:', len(porTel))
print('escrito lt_wa_por_tel.json')
