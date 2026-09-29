# -*- coding: utf-8 -*-
"""Paso 3: para los 123 contactos de sedes LT, trae sus comunicaciones
asociadas (batch), se queda con las de canal WHATS_APP, saca sus
thread_id unicos."""
import requests, json, io, sys, time

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
TOKEN = __import__('lib').KEYS['HUBSPOT_PRIVATE_TOKEN']  # sacado del .env (antes estaba hardcodeado)
H = {'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json'}

contactoDeTel = json.load(io.open('lt_contactos_por_tel.json', encoding='utf8'))
telDeContacto = {v: k for k, v in contactoDeTel.items()}
ids = list(contactoDeTel.values())
print('contactos:', len(ids))

comDeContacto = {}
for i in range(0, len(ids), 50):
    lote = ids[i:i + 50]
    body = {'inputs': [{'id': x} for x in lote]}
    r = requests.post('https://api.hubapi.com/crm/v4/associations/contacts/communications/batch/read',
                       headers=H, json=body)
    d = r.json()
    for res in d.get('results', []):
        cid = res['from']['id']
        comDeContacto[cid] = [str(t['toObjectId']) for t in res.get('to', [])]

todosCom = sorted(set(c for lst in comDeContacto.values() for c in lst))
print('comunicaciones unicas:', len(todosCom))

props = {}
for i in range(0, len(todosCom), 100):
    lote = todosCom[i:i + 100]
    body = {'inputs': [{'id': x} for x in lote],
            'properties': ['hs_communication_channel_type',
                            'hs_communication_conversations_thread_id',
                            'hs_timestamp']}
    r = requests.post('https://api.hubapi.com/crm/v3/objects/communications/batch/read',
                       headers=H, json=body)
    d = r.json()
    for res in d.get('results', []):
        props[res['id']] = res.get('properties') or {}

wa = {k: v for k, v in props.items() if v.get('hs_communication_channel_type') == 'WHATS_APP'}
print('comunicaciones WHATS_APP:', len(wa))

# thread_id -> lista de (contacto, telefono, timestamp de la comunicacion)
threadDe = {}
for comId, p in wa.items():
    tid = p.get('hs_communication_conversations_thread_id')
    if not tid:
        continue
    threadDe.setdefault(tid, []).append(p.get('hs_timestamp'))

print('threads de WhatsApp unicos:', len(threadDe))

json.dump({'comDeContacto': comDeContacto, 'wa': wa, 'threadDe': threadDe,
           'telDeContacto': telDeContacto},
          io.open('lt_wa_native_paso3.json', 'w', encoding='utf8'), ensure_ascii=False)
print('escrito lt_wa_native_paso3.json')
