import requests, json, io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
TOKEN = __import__('lib').KEYS['HUBSPOT_PRIVATE_TOKEN']  # sacado del .env (antes estaba hardcodeado)
H = {'Authorization': 'Bearer ' + TOKEN}

r = requests.get('https://api.hubapi.com/marketing/v3/emails/220196503572', headers=H)
d = r.json()
print('email 220196503572 (Cada vez mas clinicas...) allEmailCampaignIds:', d.get('allEmailCampaignIds'))

for cid in d.get('allEmailCampaignIds', []):
    r2 = requests.get('https://api.hubapi.com/email/public/v1/campaigns/%s' % cid, headers=H)
    c = r2.json()
    print(cid, '->', c.get('name'), '|', c.get('counters'))
