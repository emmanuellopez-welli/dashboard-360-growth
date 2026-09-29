import lib, json
HS = 'ca_13P0RgH6oZrv'
def proxy(ep):
    r = lib.C.tools.proxy(endpoint=ep, method='GET', connected_account_id=HS)
    d = getattr(r, 'data', r)
    if isinstance(d, str): d = json.loads(d)
    return d
r = proxy('/crm/v3/properties/contacts')
for p in r.get('results', []):
    n = p['name'].lower()
    if 'whatsapp' in n or ('wa_' in n) or ('read' in n and 'wa' in n):
        print(p['name'], '|', p.get('label'))
