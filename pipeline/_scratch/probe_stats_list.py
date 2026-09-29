import lib, json
HS = 'ca_13P0RgH6oZrv'
def proxy(ep):
    r = lib.C.tools.proxy(endpoint=ep, method='GET', connected_account_id=HS)
    d = getattr(r, 'data', r)
    if isinstance(d, str): d = json.loads(d)
    return d
for ep in [
    '/marketing/v3/emails/statistics/list?emailIds=199217937265',
    '/marketing-emails/v1/campaigns/388790372',
    '/email/public/v1/campaigns/388790372',
    '/email/public/v1/campaigns/by-id/388790372',
]:
    try:
        r = proxy(ep)
        print(ep, '->', json.dumps(r)[:400])
    except Exception as e:
        print(ep, 'ERR', str(e)[:150])
