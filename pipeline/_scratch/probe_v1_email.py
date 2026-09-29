import lib, json
HS = 'ca_13P0RgH6oZrv'
def proxy(ep):
    r = lib.C.tools.proxy(endpoint=ep, method='GET', connected_account_id=HS)
    d = getattr(r, 'data', r)
    if isinstance(d, str): d = json.loads(d)
    return d
for ep in ['/marketing-emails/v1/emails/199217937265',
           '/marketing-emails/v1/emails/with-statistics/199217937265']:
    try:
        r = proxy(ep)
        print(ep, '->', list(r.keys()) if isinstance(r, dict) else type(r))
        if isinstance(r, dict) and 'stats' in r:
            print(json.dumps(r['stats'], indent=2)[:600])
    except Exception as e:
        print(ep, 'ERROR', str(e)[:150])
