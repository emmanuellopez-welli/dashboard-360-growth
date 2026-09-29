import requests, json
TOKEN = __import__('lib').KEYS['HUBSPOT_PRIVATE_TOKEN']  # sacado del .env (antes estaba hardcodeado)
H = {'Authorization': 'Bearer ' + TOKEN}
r = requests.get('https://api.hubapi.com/email/public/v1/events?campaign_id=1&limit=5', headers=H)
print(json.dumps(r.json(), indent=2)[:800])
