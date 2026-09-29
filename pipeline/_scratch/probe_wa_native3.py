import lib, json
HS = 'ca_13P0RgH6oZrv'
def proxy(ep, method='GET', body=None):
    r = lib.C.tools.proxy(endpoint=ep, method=method, body=body, connected_account_id=HS)
    d = getattr(r, 'data', r)
    if isinstance(d, str): d = json.loads(d)
    return d

r = proxy('/crm/v3/properties/communications')
for p in r.get('results', []):
    print(p['name'], '|', p.get('label'))
