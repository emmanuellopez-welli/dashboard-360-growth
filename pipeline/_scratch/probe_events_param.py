import lib, json
HS = 'ca_13P0RgH6oZrv'
def proxy(ep):
    r = lib.C.tools.proxy(endpoint=ep, method='GET', connected_account_id=HS)
    d = getattr(r, 'data', r)
    if isinstance(d, str): d = json.loads(d)
    return d

for param in ['campaignId', 'emailCampaignId', 'campaign_id']:
    r = proxy('/email/public/v1/events?%s=434793852&limit=5' % param)
    print(param, '->', len(r.get('events', [])), r.get('hasMore'))
