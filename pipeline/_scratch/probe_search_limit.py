import requests, json, io
TOKEN = __import__('lib').KEYS['HUBSPOT_PRIVATE_TOKEN']  # sacado del .env (antes estaba hardcodeado)
H = {'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json'}
telPorSede = json.load(io.open('lt_tel_sedes.json', encoding='utf8'))
telefonos = sorted(set(telPorSede.values()))
variantes = []
for t in telefonos:
    variantes += [t, '+57' + t, '57' + t]
print('total variantes:', len(variantes))
body = {
    'filterGroups': [{'filters': [{'propertyName': 'phone', 'operator': 'IN', 'values': variantes}]}],
    'properties': ['phone'], 'limit': 10
}
r = requests.post('https://api.hubapi.com/crm/v3/objects/contacts/search', headers=H, json=body)
print(r.status_code)
print(json.dumps(r.json(), indent=2)[:1000])
