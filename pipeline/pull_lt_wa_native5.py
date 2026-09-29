# -*- coding: utf-8 -*-
"""Paso 5: cruza los mensajes reales (telefono+fecha+estado) contra
LT_TOUCHES (id_sede+fecha+pieza+audiencia) para agregar, POR PIEZA de
WhatsApp: cuantos telefonos fueron enviados/entregados/leidos/fallidos,
en una ventana de [fecha del toque, +3 dias] -- mismo criterio aproximado
ya usado y declarado para Email/otros cruces de este tablero."""
import json, io, sys, re, collections, datetime

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

telPorSede = json.load(io.open('lt_tel_sedes.json', encoding='utf8'))  # id_internal -> tel
mensajes = json.load(io.open('lt_wa_native_mensajes.json', encoding='utf8'))
sheet_data = json.load(io.open('sheet_data.json', encoding='utf8'))

def norm(t):
    return re.sub(r'\D', '', str(t or ''))[-10:]

# por telefono -> lista de (fecha, estado, direccion)
porTel = collections.defaultdict(list)
for m in mensajes:
    t = norm(m.get('telefono'))
    if not t or not m.get('fecha'):
        continue
    porTel[t].append({'fecha': m['fecha'][:10], 'estado': m.get('estado'),
                       'direccion': m.get('direccion')})

h = sheet_data['LT_TOUCHES'][0]
iF, iA, iP, iC, iS = h.index('fecha'), h.index('audiencia'), h.index('pieza'), h.index('canal'), h.index('id_sede')

agg = collections.defaultdict(lambda: {'sedes_con_tel': 0, 'sent': 0, 'delivered': 0,
                                        'read': 0, 'failed': 0, 'respondio': 0})
vistos = set()
for r in sheet_data['LT_TOUCHES'][1:]:
    if r[iC] != 'WhatsApp':
        continue
    key = (r[iA], r[iP])
    idS = r[iS]
    tel = telPorSede.get(idS)
    if not tel:
        continue
    dedupe = (key, idS)
    if dedupe in vistos:
        continue
    vistos.add(dedupe)
    b = agg[key]
    b['sedes_con_tel'] += 1
    fchTouch = str(r[iF])
    ventana = [fchTouch]
    try:
        d0 = datetime.datetime.strptime(fchTouch, '%Y-%m-%d')
        ventana += [(d0 + datetime.timedelta(days=i)).strftime('%Y-%m-%d') for i in (1, 2, 3)]
    except Exception:
        pass
    eventos = [e for e in porTel.get(tel, []) if e['fecha'] in ventana]
    estados = set(e['estado'] for e in eventos if e['direccion'] == 'OUTGOING')
    if 'SENT' in estados or 'DELIVERED' in estados or 'READ' in estados:
        b['sent'] += 1
    if 'DELIVERED' in estados or 'READ' in estados:
        b['delivered'] += 1
    if 'READ' in estados:
        b['read'] += 1
    if 'FAILED' in estados and not ({'SENT', 'DELIVERED', 'READ'} & estados):
        b['failed'] += 1
    if any(e['direccion'] == 'INCOMING' for e in eventos):
        b['respondio'] += 1

print('%d piezas de WhatsApp con datos' % len(agg))
for k, b in sorted(agg.items()):
    print(k, b)

json.dump({'%s|%s' % k: v for k, v in agg.items()},
          io.open('lt_wa_piezas_agg.json', 'w', encoding='utf8'), ensure_ascii=False)
print('escrito lt_wa_piezas_agg.json')
