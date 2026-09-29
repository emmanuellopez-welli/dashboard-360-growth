import lib, json
HS = 'ca_13P0RgH6oZrv'
def proxy(ep):
    r = lib.C.tools.proxy(endpoint=ep, method='GET', connected_account_id=HS)
    d = getattr(r, 'data', r)
    if isinstance(d, str): d = json.loads(d)
    return d
r = proxy('/marketing/v3/emails/statistics/list?emailIds=199217937265&startTimestamp=2026-06-01T00%3A00%3A00Z&endTimestamp=2026-09-14T23%3A59%3A59Z')
print(json.dumps(r, indent=2)[:1500])
