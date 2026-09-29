# -*- coding: utf-8 -*-
"""Paso 4: baja los mensajes de los 88 threads de WhatsApp de sedes LT, con
su estado real (SENT/DELIVERED/READ/FAILED), texto y fecha."""
import requests, json, io, sys, time

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
TOKEN = __import__('lib').KEYS['HUBSPOT_PRIVATE_TOKEN']  # sacado del .env (antes estaba hardcodeado)
H = {'Authorization': 'Bearer ' + TOKEN}

d = json.load(io.open('lt_wa_native_paso3.json', encoding='utf8'))
threads = sorted(d['threadDe'].keys())
print('threads a bajar:', len(threads))

def get(url, intentos=3):
    for i in range(intentos):
        try:
            r = requests.get(url, headers=H, timeout=20)
            if r.status_code == 200:
                return r.json()
            print('  status', r.status_code, r.text[:150])
            return None
        except requests.exceptions.RequestException as e:
            print('  err', str(e)[:100])
        time.sleep(1.5)
    return None

mensajes = []
for i, tid in enumerate(threads):
    r = get('https://api.hubapi.com/conversations/v3/conversations/threads/%s/messages?limit=100' % tid)
    if not r:
        continue
    for m in r.get('results', []):
        st = (m.get('status') or {}).get('statusType')
        tel = None
        for lst in (m.get('senders', []), m.get('recipients', [])):
            for e in lst:
                di = e.get('deliveryIdentifier') or {}
                if di.get('type') == 'HS_PHONE_NUMBER':
                    tel = di.get('value')
        mensajes.append({'thread': tid, 'id': m.get('id'), 'direccion': m.get('direction'),
                          'estado': st, 'fecha': m.get('createdAt'), 'telefono': tel,
                          'texto': (m.get('text') or '')[:80]})
    if (i + 1) % 20 == 0:
        print('  %d/%d threads' % (i + 1, len(threads)))

print('mensajes totales:', len(mensajes))
json.dump(mensajes, io.open('lt_wa_native_mensajes.json', 'w', encoding='utf8'), ensure_ascii=False)
print('escrito lt_wa_native_mensajes.json')
