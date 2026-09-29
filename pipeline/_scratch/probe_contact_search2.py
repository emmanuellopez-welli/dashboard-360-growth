import requests, json
TOKEN = __import__('lib').KEYS['HUBSPOT_PRIVATE_TOKEN']  # sacado del .env (antes estaba hardcodeado)
H = {'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json'}
tel = json.load(open('lt_tel_sedes.json', encoding='utf8'))
telefonos = list(set(tel.values()))[:5]
variantes = telefonos + ['+57' + t for t in telefonos] + ['57' + t for t in telefonos]

for prop in ['phone', 'mobilephone', 'hs_whatsapp_phone_number']:
    body = {
      'filterGroups': [{'filters': [{'propertyName': prop, 'operator': 'IN', 'values': variantes}]}],
      'properties': [prop, 'firstname'],
      'limit': 10
    }
    r = requests.post('https://api.hubapi.com/crm/v3/objects/contacts/search', headers=H, json=body)
    d = r.json()
    print(prop, '->', r.status_code, d.get('total'))
