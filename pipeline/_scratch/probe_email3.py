import lib, json
HS = 'ca_13P0RgH6oZrv'

def proxy(ep):
    r = lib.C.tools.proxy(endpoint=ep, method='GET', connected_account_id=HS)
    d = getattr(r, 'data', r)
    if isinstance(d, str):
        d = json.loads(d)
    return d

r = proxy('/marketing/v3/emails/?limit=100')
names = [(e.get('id'), e.get('name')) for e in r.get('results', [])]
for i, n in names:
    if any(k in (n or '').lower() for k in ['mail_1w','mail_2w','mail_3w','wa_1','04_','02_','wq','perfil','reactiv','vuelve']):
        print(i, n)
print('total en pagina 1:', len(names))
