import lib, json
HS = 'ca_13P0RgH6oZrv'
def proxy(ep, method='GET', body=None):
    r = lib.C.tools.proxy(endpoint=ep, method=method, body=body, connected_account_id=HS)
    d = getattr(r, 'data', r)
    if isinstance(d, str): d = json.loads(d)
    return d

r = proxy('/crm/v3/objects/communications?limit=5&properties=hs_object_source,hs_object_source_id,hs_object_source_detail_1,hs_object_source_detail_2,hs_object_source_detail_3,hs_engagement_source,hs_engagement_source_id,hubspot_owner_id,hs_timestamp,hs_communication_body,hs_communication_logged_from')
for x in r.get('results', []):
    print(json.dumps(x['properties'], indent=1))
    print('---')
