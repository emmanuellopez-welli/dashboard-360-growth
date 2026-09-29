# -*- coding: utf-8 -*-
"""Franja horaria (mejor hora de lectura/respuesta) y top sedes por
engagement, para WhatsApp de Long Tail -- sale de los mismos mensajes
reales ya bajados (lt_wa_native_mensajes.json). Email NO se pudo: la API
de eventos de HubSpot ignora el filtro de campana pase lo que pase
(confirmado 3 veces, la ultima con un ID de campana 100% valido)."""
import json, io, sys, re, collections, datetime

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

mensajes = json.load(io.open('lt_wa_native_mensajes.json', encoding='utf8'))
telPorSede = json.load(io.open('lt_tel_sedes.json', encoding='utf8'))  # id_internal -> tel
sedeDeTel = {}
for iid, t in telPorSede.items():
    sedeDeTel.setdefault(t, []).append(iid)

sheet_data = json.load(io.open('sheet_data.json', encoding='utf8'))
hS = sheet_data['SEDES'][0]
iInt, iNom = hS.index('id_internal'), hS.index('nombre_sede')
nombreDe = {r[iInt]: r[iNom] for r in sheet_data['SEDES'][1:] if r[iInt]}

def norm(t):
    return re.sub(r'\D', '', str(t or ''))[-10:]

def hora_bogota(iso):
    if not iso:
        return None
    try:
        dt = datetime.datetime.strptime(iso[:19], '%Y-%m-%dT%H:%M:%S')
        return (dt - datetime.timedelta(hours=5)).hour
    except Exception:
        return None

# ---- franja horaria ----------------------------------------------------
horasLeido = collections.Counter()
horasRespondio = collections.Counter()
for m in mensajes:
    h = hora_bogota(m.get('fecha'))
    if h is None:
        continue
    if m['direccion'] == 'OUTGOING' and m['estado'] == 'READ':
        horasLeido[h] += 1
    elif m['direccion'] == 'INCOMING':
        horasRespondio[h] += 1

print('=== FRANJA HORARIA (hora Bogota) ===')
print('hora | leidos | respondio')
for h in range(24):
    if horasLeido[h] or horasRespondio[h]:
        print('%2d:00  %5d   %5d' % (h, horasLeido[h], horasRespondio[h]))

filasFranja = [['hora', 'leidos', 'respondio']]
for h in range(24):
    filasFranja.append([h, horasLeido[h], horasRespondio[h]])

# ---- top sedes por engagement -------------------------------------------
# El propio numero de WhatsApp de WELLI (+573245135673, el channel-account
# 2112793910) aparece a veces como "telefono" del mensaje porque se
# extraia de senders+recipients sin preferir al destinatario -- se excluye
# explicitamente, si no contamina el top con "la sede que mas responde"
# siendo en realidad WELLI mismo.
WELLI_TEL = '3245135673'
porTel = collections.defaultdict(lambda: {'leido': 0, 'respondio': 0})
for m in mensajes:
    t = norm(m.get('telefono'))
    if not t or t == WELLI_TEL:
        continue
    if m['direccion'] == 'OUTGOING' and m['estado'] == 'READ':
        porTel[t]['leido'] += 1
    elif m['direccion'] == 'INCOMING':
        porTel[t]['respondio'] += 1

# Una respuesta real pesa mas que una lectura: es la senal de engagement
# mas fuerte, y sin ponderarla el top queda dominado por lecturas pasivas.
top = sorted(porTel.items(), key=lambda x: -(x[1]['respondio'] * 5 + x[1]['leido']))[:15]
print()
print('=== TOP SEDES POR ENGAGEMENT DE WHATSAPP ===')
filasTop = [['sede', 'telefono', 'leido', 'respondio']]
for tel, b in top:
    iids = sedeDeTel.get(tel, [])
    nombre = nombreDe.get(iids[0], '(sede sin nombre)') if iids else '(sin sede)'
    print(nombre, tel, b['leido'], b['respondio'])
    filasTop.append([nombre, tel, b['leido'], b['respondio']])

json.dump({'LT_WA_FRANJA': filasFranja, 'LT_WA_TOP': filasTop},
          io.open('tables_lt_franja_top.json', 'w', encoding='utf8'), ensure_ascii=False)
print()
print('escrito tables_lt_franja_top.json')
