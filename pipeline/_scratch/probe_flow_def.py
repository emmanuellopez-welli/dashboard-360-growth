import lib, json
HS = 'ca_13P0RgH6oZrv'

def proxy(ep):
    r = lib.C.tools.proxy(endpoint=ep, method='GET', connected_account_id=HS)
    d = getattr(r, 'data', r)
    if isinstance(d, str):
        d = json.loads(d)
    return d

r = proxy('/automation/v4/flows/1872026920')
json.dump(r, open('wf_1872026920.json', 'w', encoding='utf8'), ensure_ascii=False, indent=2)
print('actions:', len(r.get('actions', [])))
for a in r.get('actions', []):
    print(a.get('actionId'), a.get('actionTypeId'), a.get('type'), list(a.get('fields', {}).keys()) if a.get('fields') else None)
