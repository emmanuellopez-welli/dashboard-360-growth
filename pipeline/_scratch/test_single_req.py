import requests, time
TOKEN = __import__('lib').KEYS['HUBSPOT_PRIVATE_TOKEN']  # sacado del .env (antes estaba hardcodeado)
H = {'Authorization': 'Bearer ' + TOKEN}
t0 = time.time()
r = requests.get('https://api.hubapi.com/conversations/v3/conversations/threads?limit=100', headers=H, timeout=15)
print(time.time()-t0, r.status_code, len(r.json().get('results',[])))
