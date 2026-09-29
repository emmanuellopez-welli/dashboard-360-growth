import requests, json
TOKEN = __import__('lib').KEYS['HUBSPOT_PRIVATE_TOKEN']  # sacado del .env (antes estaba hardcodeado)
H = {'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json'}
tel = json.load(open('lt_tel_sedes.json', encoding='utf8'))
telefonos = list(set(tel.values()))[:5]
print('muestra:', telefonos)

body = {
  'filterGroups': [{'filters': [{'propertyName': 'hs_whatsapp_phone_number', 'operator': 'IN', 'values': telefonos}]}],
  'properties': ['hs_whatsapp_phone_number', 'firstname', 'phone'],
  'limit': 10
}
r = requests.post('https://api.hubapi.com/crm/v3/objects/contacts/search', headers=H, json=body)
print(r.status_code)
print(json.dumps(r.json(), indent=2)[:1500])
