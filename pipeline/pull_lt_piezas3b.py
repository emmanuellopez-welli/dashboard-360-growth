# -*- coding: utf-8 -*-
"""Paso 3 (corregido): el parametro campaign_id de /email/public/v1/events NO
filtra server-side (probado: un id inventado devuelve eventos de otra
campana cualquiera) -- hay que traer el stream de eventos del rango de
fechas y agrupar LOCAL por el campo real emailCampaignId de cada evento."""
import lib, json, io, sys, collections, datetime, time

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
HS = 'ca_13P0RgH6oZrv'

def proxy(ep):
    r = lib.C.tools.proxy(endpoint=ep, method='GET', connected_account_id=HS)
    d = getattr(r, 'data', r)
    if isinstance(d, str):
        d = json.loads(d)
    return d

piezas = json.load(io.open('lt_piezas_raw.json', encoding='utf8'))
idsLT = set(str(p['campaignId']) for p in piezas if p.get('campaignId'))
print('campaignIds de Long Tail a buscar:', idsLT)

start = int(time.mktime((2026, 6, 15, 0, 0, 0, 0, 0, 0))) * 1000
end = int(time.mktime((2026, 9, 14, 23, 59, 59, 0, 0, 0))) * 1000

def hora_bogota(ms):
    dt = datetime.datetime.utcfromtimestamp(ms / 1000.0) - datetime.timedelta(hours=5)
    return dt.hour

contados = collections.defaultdict(collections.Counter)
porContacto = collections.defaultdict(lambda: collections.defaultdict(lambda: {'open': 0, 'click': 0}))
horasOpen = collections.defaultdict(collections.Counter)
totalEventos = 0
offset = None
paginas = 0
t0 = time.time()
while True:
    ep = '/email/public/v1/events?startTimestamp=%d&endTimestamp=%d&limit=300' % (start, end)
    if offset:
        ep += '&offset=%s' % offset
    d = proxy(ep)
    evs = d.get('events') or []
    totalEventos += len(evs)
    for e in evs:
        cid = str(e.get('emailCampaignId') or '')
        if cid not in idsLT:
            continue
        t = e.get('type')
        contados[cid][t] += 1
        rec = e.get('recipient') or ''
        if t == 'OPEN':
            porContacto[cid][rec]['open'] += 1
            horasOpen[cid][hora_bogota(e.get('created') or 0)] += 1
        elif t == 'CLICK':
            porContacto[cid][rec]['click'] += 1
    paginas += 1
    if paginas % 25 == 0:
        print('  %d paginas, %d eventos totales leidos, %.0fs' % (paginas, totalEventos, time.time() - t0))
    offset = d.get('offset') if d.get('hasMore') else None
    if not offset or paginas > 500:
        break

print('TOTAL: %d paginas, %d eventos leidos en %.0fs' % (paginas, totalEventos, time.time() - t0))

resultados = {}
for cid in idsLT:
    top = sorted(porContacto[cid].items(), key=lambda x: -(x[1]['open'] + x[1]['click']))[:10]
    resultados[cid] = {'contados': dict(contados[cid]), 'top': top,
                        'horasOpen': dict(horasOpen[cid])}
    print(cid, dict(contados[cid]))

json.dump(resultados, io.open('lt_email_eventos.json', 'w', encoding='utf8'), ensure_ascii=False)
print('escrito lt_email_eventos.json')
