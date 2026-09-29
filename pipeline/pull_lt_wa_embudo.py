# -*- coding: utf-8 -*-
"""Reemplaza el 'top sedes' (sin insight real -- Emmanuel lo marco el
14-sep-2026: 'esto no me dice nada') por un embudo honesto: de las sedes
que Long Tail toca por WhatsApp, cuantas tienen telefono conocido, cuantas
leyeron al menos un mensaje, y cuantas respondieron de verdad. El hallazgo
real es que CASI NADIE responde por texto (1 telefono de 149, y ni
siquiera es una sede confirmada) -- es un canal de aviso, no de
conversacion. Se calcula GLOBAL y por cluster (audiencia)."""
import json, io, sys, re, collections

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

mensajes = json.load(io.open('lt_wa_native_mensajes.json', encoding='utf8'))
telPorSede = json.load(io.open('lt_tel_sedes.json', encoding='utf8'))
sheet_data = json.load(io.open('sheet_data.json', encoding='utf8'))
WELLI_TEL = '3245135673'

def norm(t):
    return re.sub(r'\D', '', str(t or ''))[-10:]

porTel = collections.defaultdict(lambda: {'leido': False, 'respondio': False})
for m in mensajes:
    t = norm(m.get('telefono'))
    if not t or t == WELLI_TEL:
        continue
    if m['direccion'] == 'OUTGOING' and m['estado'] == 'READ':
        porTel[t]['leido'] = True
    elif m['direccion'] == 'INCOMING':
        porTel[t]['respondio'] = True

hT = sheet_data['LT_TOUCHES'][0]
iA, iC, iS = hT.index('audiencia'), hT.index('canal'), hT.index('id_sede')

vistos = set()
porAud = collections.defaultdict(lambda: {'tocadas': 0, 'con_tel': 0, 'leyeron': 0, 'respondieron': 0})
for r in sheet_data['LT_TOUCHES'][1:]:
    if r[iC] != 'WhatsApp':
        continue
    idS, aud = r[iS], r[iA]
    if (aud, idS) in vistos:
        continue
    vistos.add((aud, idS))
    b = porAud[aud]
    b['tocadas'] += 1
    tel = telPorSede.get(idS)
    if not tel:
        continue
    b['con_tel'] += 1
    e = porTel.get(tel)
    if e and e['leido']:
        b['leyeron'] += 1
    if e and e['respondio']:
        b['respondieron'] += 1

filas = [['audiencia', 'tocadas', 'con_tel', 'leyeron', 'respondieron']]
tot = {'tocadas': 0, 'con_tel': 0, 'leyeron': 0, 'respondieron': 0}
for aud, b in porAud.items():
    filas.append([aud, b['tocadas'], b['con_tel'], b['leyeron'], b['respondieron']])
    for k in tot:
        tot[k] += b[k]
filas.append(['TODOS', tot['tocadas'], tot['con_tel'], tot['leyeron'], tot['respondieron']])

for f in filas:
    print(f)

json.dump({'LT_WA_EMBUDO': filas}, io.open('tables_lt_wa_embudo.json', 'w', encoding='utf8'), ensure_ascii=False)
print('escrito tables_lt_wa_embudo.json')
