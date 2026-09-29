import lib, json
HS = 'ca_13P0RgH6oZrv'

def proxy(ep):
    r = lib.C.tools.proxy(endpoint=ep, method='GET', connected_account_id=HS)
    d = getattr(r, 'data', r)
    if isinstance(d, str):
        d = json.loads(d)
    return d

# Analytics endpoint por email
r = proxy('/marketing/v3/emails/statistics/histogram?interval=DAY')
print('histogram:', json.dumps(r, indent=2)[:800])

r2 = proxy('/email/public/v1/events?limit=5&eventType=OPEN')
print()
print('events open:', json.dumps(r2, indent=2)[:1500])
