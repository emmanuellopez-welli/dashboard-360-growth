import requests, json
TOKEN = __import__('lib').KEYS['HUBSPOT_PRIVATE_TOKEN']  # sacado del .env (antes estaba hardcodeado)
H = {'Authorization': 'Bearer ' + TOKEN}
r = requests.get('https://api.hubapi.com/marketing/v3/emails/199217937265', headers=H)
d = r.json()
print('allEmailCampaignIds:', d.get('allEmailCampaignIds'))
print('primaryEmailCampaignId:', d.get('primaryEmailCampaignId'))
print('emailCampaignGroupId:', d.get('emailCampaignGroupId'))

# probar el endpoint viejo de campanas con estos ids
for cid in (d.get('allEmailCampaignIds') or []) + [d.get('primaryEmailCampaignId')]:
    r2 = requests.get('https://api.hubapi.com/email/public/v1/campaigns/%s' % cid, headers=H)
    print(cid, '->', r2.status_code, r2.text[:150])
