import lib, json, time
HS = 'ca_13P0RgH6oZrv'
def proxy(ep):
    r = lib.C.tools.proxy(endpoint=ep, method='GET', connected_account_id=HS)
    d = getattr(r, 'data', r)
    if isinstance(d, str): d = json.loads(d)
    return d
start = int(time.mktime((2026,6,1,0,0,0,0,0,0)))*1000
end = int(time.mktime((2026,9,14,23,59,59,0,0,0)))*1000
r = proxy('/marketing/v3/emails/statistics/list?emailIds=199217937265&startTimestamp=%d&endTimestamp=%d' % (start, end))
print(json.dumps(r, indent=2)[:1500])
