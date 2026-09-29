# -*- coding: utf-8 -*-
"""Paso 4: stats agregados reales (sent/open/click/ratios) por email, via
/marketing/v3/emails/statistics/list -- el que SI funciona (el filtro por
campaign_id de /email/public/v1/events resulto no ser real: un id inventado
devolvia eventos de otra campana cualquiera, y /email/public/v1/campaigns/
confirma que esos ids de "primaryEmailCampaignId" ni siquiera existen como
campana valida). No da top-contacts por persona -- eso queda pendiente."""
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
ids = sorted(set(p['ref'] for p in piezas if p['canal'] == 'Email' and p.get('ref')))
print('emails a consultar:', len(ids))

# OJO 14-sep-2026: con la ventana angosta (jun-sep 2026) DOS de los seis
# emails devolvian sent=0 -- parecia un bug (Emmanuel lo marco como tal) y
# SI era un bug, solo que de rango: esos dos emails tuvieron casi todo su
# volumen ANTES de esa ventana (394 envios en 2025-2026 completo contra 0
# en el recorte). El rango se amplia a "todo lo que exista" para no perder
# volumen real de ninguna pieza otra vez.
stats = {}
for eid in ids:
    r = proxy('/marketing/v3/emails/statistics/list?emailIds=%s'
               '&startTimestamp=2020-01-01T00%%3A00%%3A00Z&endTimestamp=2026-09-14T23%%3A59%%3A59Z' % eid)
    ag = (r.get('aggregate') or {})
    c = ag.get('counters') or {}
    ra = ag.get('ratios') or {}
    stats[eid] = {'sent': c.get('sent', 0), 'delivered': c.get('delivered', 0),
                  'open': c.get('open', 0), 'click': c.get('click', 0),
                  'bounce': c.get('bounce', 0),
                  'openratio': ra.get('openratio', 0), 'clickratio': ra.get('clickratio', 0)}
    print(eid, stats[eid])

json.dump(stats, io.open('lt_email_stats.json', 'w', encoding='utf8'), ensure_ascii=False)
print('escrito lt_email_stats.json')
