# -*- coding: utf-8 -*-
"""Paso 2: para cada pieza de Email, trae el subject real y el
primaryEmailCampaignId (la llave para pedir eventos de apertura/clic)."""
import lib, json, io, sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
HS = 'ca_13P0RgH6oZrv'

def proxy(ep):
    r = lib.C.tools.proxy(endpoint=ep, method='GET', connected_account_id=HS)
    d = getattr(r, 'data', r)
    if isinstance(d, str):
        d = json.loads(d)
    return d

piezas = json.load(io.open('lt_piezas_raw.json', encoding='utf8'))
for p in piezas:
    if p['canal'] != 'Email' or not p['ref']:
        continue
    try:
        e = proxy('/marketing/v3/emails/%s' % p['ref'])
        p['subject'] = e.get('subject') or e.get('name') or ''
        p['campaignId'] = str(e.get('primaryEmailCampaignId') or '')
    except Exception as ex:
        p['subject'] = ''
        p['campaignId'] = ''
        p['error'] = str(ex)[:120]
    print(p['workflow'], p['canal'], p['orden'], '-', p.get('subject'), '| campaignId', p.get('campaignId'))

json.dump(piezas, io.open('lt_piezas_raw.json', 'w', encoding='utf8'), ensure_ascii=False, indent=1)
