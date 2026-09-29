import lib, json
HS = 'ca_13P0RgH6oZrv'
def proxy(ep):
    r = lib.C.tools.proxy(endpoint=ep, method='GET', connected_account_id=HS)
    d = getattr(r, 'data', r)
    if isinstance(d, str): d = json.loads(d)
    return d
r = proxy('/marketing/v3/emails/199217937265')
print(list(r.keys()))
print(json.dumps(r.get('stats'), indent=2)[:800] if r.get('stats') else 'no stats key')
