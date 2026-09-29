import requests, json
TOKEN = __import__('lib').KEYS['HUBSPOT_PRIVATE_TOKEN']  # sacado del .env (antes estaba hardcodeado)
H = {'Authorization': 'Bearer ' + TOKEN}
r = requests.get('https://api.hubapi.com/oauth/v1/access-tokens/' + TOKEN)
print(r.status_code)
print(json.dumps(r.json(), indent=2)[:1500])
