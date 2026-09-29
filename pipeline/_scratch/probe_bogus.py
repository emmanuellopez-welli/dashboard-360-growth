import lib, json
HS = 'ca_13P0RgH6oZrv'
def proxy(ep):
    r = lib.C.tools.proxy(endpoint=ep, method='GET', connected_account_id=HS)
    d = getattr(r, 'data', r)
    if isinstance(d, str): d = json.loads(d)
    return d
r = proxy('/email/public/v1/events?campaign_id=1&limit=5')
print(len(r.get('events',[])), r.get('hasMore'))
for e in r.get('events',[])[:3]:
    print(e.get('emailCampaignId'), e.get('type'), e.get('recipient'))
