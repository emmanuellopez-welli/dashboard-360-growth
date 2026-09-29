import lib, json
HS = 'ca_13P0RgH6oZrv'
def proxy(ep):
    r = lib.C.tools.proxy(endpoint=ep, method='GET', connected_account_id=HS)
    d = getattr(r, 'data', r)
    if isinstance(d, str): d = json.loads(d)
    return d
r = proxy('/crm/v3/properties/2-50958246')
props = [p['name'] for p in r.get('results', []) if 'tel' in p['name'].lower() or 'cel' in p['name'].lower() or 'phone' in p['name'].lower() or 'whats' in p['name'].lower()]
print(props)
