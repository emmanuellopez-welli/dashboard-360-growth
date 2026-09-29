import requests, json, io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
TOKEN = __import__('lib').KEYS['HUBSPOT_PRIVATE_TOKEN']  # sacado del .env (antes estaba hardcodeado)
H = {'Authorization': 'Bearer ' + TOKEN}
cid = '199336843163'
for start, end in [
    ('2026-06-01T00:00:00Z', '2026-09-14T23:59:59Z'),
    ('2026-08-01T00:00:00Z', '2026-09-14T23:59:59Z'),
    ('2026-08-20T00:00:00Z', '2026-09-14T23:59:59Z'),
]:
    r = requests.get('https://api.hubapi.com/marketing/v3/emails/statistics/list?emailIds=%s'
                      '&startTimestamp=%s&endTimestamp=%s' % (cid, start.replace(':','%3A'), end.replace(':','%3A')), headers=H)
    print(start, '->', r.json().get('aggregate', {}).get('counters'))
