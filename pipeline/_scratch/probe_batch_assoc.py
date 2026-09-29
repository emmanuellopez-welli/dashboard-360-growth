import requests, json, io
TOKEN = __import__('lib').KEYS['HUBSPOT_PRIVATE_TOKEN']  # sacado del .env (antes estaba hardcodeado)
H = {'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json'}
c = json.load(io.open('lt_contactos_por_tel.json', encoding='utf8'))
ids = list(c.values())[:5]
body = {'inputs': [{'id': i} for i in ids]}
r = requests.post('https://api.hubapi.com/crm/v4/associations/contacts/communications/batch/read', headers=H, json=body)
print(r.status_code)
d = r.json()
print(json.dumps(d, indent=2)[:1000])
for res in d.get('results', []):
    print(res['from']['id'], '->', len(res.get('to', [])), 'comunicaciones')
