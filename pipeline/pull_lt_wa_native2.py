# -*- coding: utf-8 -*-
"""Paso 2: busca los contactos de HubSpot correspondientes a los telefonos
de sedes de Long Tail (149 con telefono conocido), probando el numero tal
cual y con prefijo +57/57 (HubSpot normaliza distinto segun como se cargo
el contacto)."""
import requests, json, io, sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
TOKEN = __import__('lib').KEYS['HUBSPOT_PRIVATE_TOKEN']  # sacado del .env (antes estaba hardcodeado)
H = {'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json'}

telPorSede = json.load(io.open('lt_tel_sedes.json', encoding='utf8'))
telefonos = sorted(set(telPorSede.values()))
print('telefonos de sedes LT:', len(telefonos))

# El operador IN de la API de busqueda admite maximo 100 valores por
# filtro (probado: 447 valores devuelve 400 "too many IN list values").
# Con 3 variantes por telefono (tal cual, +57, 57), caben 33 telefonos por
# lote.
LOTE = 33
contactoDeTel = {}
for prop in ['phone', 'hs_whatsapp_phone_number']:
    for i in range(0, len(telefonos), LOTE):
        lote = telefonos[i:i + LOTE]
        variantes = []
        for t in lote:
            variantes += [t, '+57' + t, '57' + t]
        body = {
            'filterGroups': [{'filters': [{'propertyName': prop, 'operator': 'IN', 'values': variantes}]}],
            'properties': [prop],
            'limit': 100
        }
        r = requests.post('https://api.hubapi.com/crm/v3/objects/contacts/search', headers=H, json=body)
        d = r.json()
        if r.status_code != 200:
            print('  ERROR', prop, i, d.get('message'))
            continue
        for c in d.get('results', []):
            v = str((c.get('properties') or {}).get(prop) or '')
            digitos = ''.join(ch for ch in v if ch.isdigit())[-10:]
            if digitos in telefonos:
                contactoDeTel.setdefault(digitos, c['id'])

print('contactos encontrados:', len(contactoDeTel), 'de', len(telefonos), 'telefonos')
json.dump(contactoDeTel, io.open('lt_contactos_por_tel.json', 'w', encoding='utf8'), ensure_ascii=False)
print('escrito lt_contactos_por_tel.json')
