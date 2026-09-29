import requests, json
TOKEN = __import__('lib').KEYS['HUBSPOT_PRIVATE_TOKEN']  # sacado del .env (antes estaba hardcodeado)
H = {'Authorization': 'Bearer ' + TOKEN}
r = requests.get('https://api.hubapi.com/email/public/v1/events?campaign_id=1&limit=5', headers=H)
print(r.status_code)
d = r.json()
for e in d.get('events', [])[:3]:
    print(e.get('emailCampaignId'), e.get('type'))
r2 = requests.get('https://api.hubapi.com/email/public/v1/events?campaign_id=388790372&limit=5', headers=H)
print(r2.status_code)
d2 = r2.json()
for e in d2.get('events', [])[:3]:
    print(e.get('emailCampaignId'), e.get('type'))
