import requests, json, io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
TOKEN = __import__('lib').KEYS['HUBSPOT_PRIVATE_TOKEN']  # sacado del .env (antes estaba hardcodeado)
H = {'Authorization': 'Bearer ' + TOKEN}

for cid in ['199336843163', '199339523390']:
    r = requests.get('https://api.hubapi.com/marketing/v3/emails/%s' % cid, headers=H)
    d = r.json()
    print(cid, '| subject:', d.get('subject'), '| state:', d.get('state'),
          '| isPublished:', d.get('isPublished'), '| publishDate:', d.get('publishDate'))
    print('  allEmailCampaignIds:', d.get('allEmailCampaignIds'))
    r2 = requests.get('https://api.hubapi.com/marketing/v3/emails/statistics/list?emailIds=%s'
                       '&startTimestamp=2025-01-01T00%%3A00%%3A00Z&endTimestamp=2026-09-14T23%%3A59%%3A59Z' % cid, headers=H)
    print('  stats (rango amplio):', r2.json().get('aggregate', {}).get('counters'))
