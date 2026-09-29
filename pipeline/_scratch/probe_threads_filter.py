import requests, json
TOKEN = __import__('lib').KEYS['HUBSPOT_PRIVATE_TOKEN']  # sacado del .env (antes estaba hardcodeado)
H = {'Authorization': 'Bearer ' + TOKEN}
for params in ['?limit=5&channelId=1007', '?limit=5&originalChannelAccountId=2112793910', '?limit=5&channelAccountId=2112793910']:
    r = requests.get('https://api.hubapi.com/conversations/v3/conversations/threads' + params, headers=H)
    d = r.json()
    print(params, '->', r.status_code, len(d.get('results',[])), 'total' in d and d.get('total'))
    if d.get('results'):
        print('   primer originalChannelId:', d['results'][0].get('originalChannelId'), d['results'][0].get('originalChannelAccountId'))
