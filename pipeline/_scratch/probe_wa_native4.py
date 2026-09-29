import lib, json
HS = 'ca_13P0RgH6oZrv'
def proxy(ep, method='GET', body=None):
    r = lib.C.tools.proxy(endpoint=ep, method=method, body=body, connected_account_id=HS)
    d = getattr(r, 'data', r)
    if isinstance(d, str): d = json.loads(d)
    return d

r = proxy('/crm/v3/objects/communications?limit=1&properties=hs_communication_conversations_thread_id,hs_communication_conversations_channel_ids')
com = r['results'][0]
print(json.dumps(com, indent=2))
tid = com['properties'].get('hs_communication_conversations_thread_id')
print('thread id:', tid)
if tid:
    t = proxy('/conversations/v3/conversations/threads/%s/messages?limit=10' % tid)
    print(json.dumps(t, indent=2)[:2500])
