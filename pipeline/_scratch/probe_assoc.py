import requests, json, io
TOKEN = __import__('lib').KEYS['HUBSPOT_PRIVATE_TOKEN']  # sacado del .env (antes estaba hardcodeado)
H = {'Authorization': 'Bearer ' + TOKEN}
c = json.load(io.open('lt_contactos_por_tel.json', encoding='utf8'))
cid = list(c.values())[0]
print('probando contacto', cid)
r = requests.get('https://api.hubapi.com/crm/v4/objects/contacts/%s/associations/communications' % cid, headers=H)
print(r.status_code)
print(json.dumps(r.json(), indent=2)[:1500])
