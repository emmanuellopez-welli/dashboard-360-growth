import lib, json
HS = 'ca_13P0RgH6oZrv'
def proxy(ep, method='GET', body=None):
    r = lib.C.tools.proxy(endpoint=ep, method=method, body=body, connected_account_id=HS)
    d = getattr(r, 'data', r)
    if isinstance(d, str): d = json.loads(d)
    return d

# Buscar el objeto "communications" (mensajes de WhatsApp/SMS/LinkedIn en HubSpot)
r = proxy('/crm/v3/objects/communications?limit=5&properties=hs_communication_channel_type,hs_communication_body,hs_timestamp')
print(json.dumps(r, indent=2)[:2000])
