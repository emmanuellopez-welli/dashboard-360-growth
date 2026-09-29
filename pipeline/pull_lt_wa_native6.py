# -*- coding: utf-8 -*-
"""Agrega: (1) top sedes de WhatsApp POR AUDIENCIA/cluster (no global), con
el rango de fechas real que cubre el cruce; (2) una muestra de texto real
por (audiencia, pieza) de WhatsApp, para mostrar contenido igual que Email
en vez de solo 'WhatsApp #N'."""
import json, io, sys, re, collections, datetime

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

mensajes = json.load(io.open('lt_wa_native_mensajes.json', encoding='utf8'))
telPorSede = json.load(io.open('lt_tel_sedes.json', encoding='utf8'))  # id_internal -> tel
sheet_data = json.load(io.open('sheet_data.json', encoding='utf8'))

hS = sheet_data['SEDES'][0]
iInt, iNom = hS.index('id_internal'), hS.index('nombre_sede')
nombreDe = {r[iInt]: r[iNom] for r in sheet_data['SEDES'][1:] if r[iInt]}

WELLI_TEL = '3245135673'

def norm(t):
    return re.sub(r'\D', '', str(t or ''))[-10:]

porTel = collections.defaultdict(list)
for m in mensajes:
    t = norm(m.get('telefono'))
    if not t or t == WELLI_TEL or not m.get('fecha'):
        continue
    porTel[t].append(m)

hT = sheet_data['LT_TOUCHES'][0]
iF, iA, iP, iC, iS = hT.index('fecha'), hT.index('audiencia'), hT.index('pieza'), hT.index('canal'), hT.index('id_sede')

# --- top sedes POR AUDIENCIA -------------------------------------------
porAudTel = collections.defaultdict(lambda: collections.defaultdict(lambda: {'leido': 0, 'respondio': 0}))
fechaMin, fechaMax = None, None
vistos = set()
for r in sheet_data['LT_TOUCHES'][1:]:
    if r[iC] != 'WhatsApp':
        continue
    idS, aud = r[iS], r[iA]
    tel = telPorSede.get(idS)
    if not tel:
        continue
    dedupe = (aud, idS)
    if dedupe in vistos:
        continue
    vistos.add(dedupe)
    for m in porTel.get(tel, []):
        fch = m['fecha'][:10]
        if fechaMin is None or fch < fechaMin:
            fechaMin = fch
        if fechaMax is None or fch > fechaMax:
            fechaMax = fch
        if m['direccion'] == 'OUTGOING' and m['estado'] == 'READ':
            porAudTel[aud][tel]['leido'] += 1
        elif m['direccion'] == 'INCOMING':
            porAudTel[aud][tel]['respondio'] += 1

filasTop = [['audiencia', 'sede', 'telefono', 'leido', 'respondio']]
for aud, porTelAud in porAudTel.items():
    top = sorted(porTelAud.items(), key=lambda x: -(x[1]['respondio'] * 5 + x[1]['leido']))[:10]
    for tel, b in top:
        if not b['leido'] and not b['respondio']:
            continue
        # nombre de sede: buscar el id_internal que mapea a este tel
        iid = next((k for k, v in telPorSede.items() if v == tel), None)
        nombre = nombreDe.get(iid, '(sede sin nombre)') if iid else '(sin sede)'
        filasTop.append([aud, nombre, tel, b['leido'], b['respondio']])

print('top sedes por audiencia:', len(filasTop) - 1)
print('periodo cubierto:', fechaMin, '->', fechaMax)

# --- muestra de texto real por (audiencia, pieza) -----------------------
textoDe = {}
for r in sheet_data['LT_TOUCHES'][1:]:
    if r[iC] != 'WhatsApp':
        continue
    key = (r[iA], r[iP])
    if key in textoDe:
        continue
    idS = r[iS]
    tel = telPorSede.get(idS)
    if not tel:
        continue
    fchTouch = r[iF]
    for m in porTel.get(tel, []):
        if m['direccion'] != 'OUTGOING':
            continue
        if not (fchTouch <= m['fecha'][:10] <= fchTouch):
            # ventana +3 dias
            try:
                d0 = datetime.datetime.strptime(fchTouch, '%Y-%m-%d')
                d1 = datetime.datetime.strptime(m['fecha'][:10], '%Y-%m-%d')
                if not (0 <= (d1 - d0).days <= 3):
                    continue
            except Exception:
                continue
        if m.get('texto'):
            textoDe[key] = m['texto']
            break

print('muestras de texto encontradas:', len(textoDe))
for k, v in textoDe.items():
    print(k, '->', v[:60])

json.dump({'LT_WA_TOP': filasTop, 'periodo': [fechaMin, fechaMax],
           'textos': {'%s|%s' % k: v for k, v in textoDe.items()}},
          io.open('tables_lt_wa_top2.json', 'w', encoding='utf8'), ensure_ascii=False)
print('escrito tables_lt_wa_top2.json')
