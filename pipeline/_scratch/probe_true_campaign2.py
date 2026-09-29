import requests, json, io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
TOKEN = __import__('lib').KEYS['HUBSPOT_PRIVATE_TOKEN']  # sacado del .env (antes estaba hardcodeado)
H = {'Authorization': 'Bearer ' + TOKEN}
for cid in ['389444330', '434892842', '388941997']:
    r2 = requests.get('https://api.hubapi.com/email/public/v1/campaigns/%s' % cid, headers=H)
    print(cid, '->', r2.status_code)
    if r2.status_code == 200:
        print(json.dumps(r2.json(), indent=1)[:500])

# probar si ESTE id si filtra bien los eventos
r3 = requests.get('https://api.hubapi.com/email/public/v1/events?campaign_id=389444330&limit=5', headers=H)
d3 = r3.json()
for e in d3.get('events', [])[:5]:
    print('EVENTO', e.get('emailCampaignId'), e.get('type'), e.get('recipient'))
