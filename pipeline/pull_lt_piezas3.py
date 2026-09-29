# -*- coding: utf-8 -*-
"""Paso 3: para cada campaignId unico de Email, trae TODOS los eventos
(SENT/DELIVERED/OPEN/CLICK) y agrega: tasas, top contactos por apertura/clic,
e histograma de hora del dia (America/Bogota) de las aperturas."""
import lib, json, io, sys, collections, datetime

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
HS = 'ca_13P0RgH6oZrv'

def proxy(ep):
    r = lib.C.tools.proxy(endpoint=ep, method='GET', connected_account_id=HS)
    d = getattr(r, 'data', r)
    if isinstance(d, str):
        d = json.loads(d)
    return d

piezas = json.load(io.open('lt_piezas_raw.json', encoding='utf8'))
campaignIds = sorted(set(p['campaignId'] for p in piezas if p.get('campaignId')))
print('campaignIds unicos:', len(campaignIds))

def hora_bogota(ms):
    dt = datetime.datetime.utcfromtimestamp(ms / 1000.0) - datetime.timedelta(hours=5)
    return dt.hour

resultados = {}
for cid in campaignIds:
    contados = collections.Counter()
    porContacto = collections.defaultdict(lambda: {'open': 0, 'click': 0})
    horasOpen = collections.Counter()
    offset = None
    paginas = 0
    while True:
        ep = '/email/public/v1/events?campaign_id=%s&limit=300' % cid
        if offset:
            ep += '&offset=%s' % offset
        d = proxy(ep)
        evs = d.get('events') or []
        for e in evs:
            t = e.get('type')
            contados[t] += 1
            rec = e.get('recipient') or ''
            if t == 'OPEN':
                porContacto[rec]['open'] += 1
                horasOpen[hora_bogota(e.get('created') or 0)] += 1
            elif t == 'CLICK':
                porContacto[rec]['click'] += 1
        paginas += 1
        offset = d.get('offset') if d.get('hasMore') else None
        if not offset or paginas > 60:
            break
    top = sorted(porContacto.items(), key=lambda x: -(x[1]['open'] + x[1]['click']))[:10]
    resultados[cid] = {'contados': dict(contados), 'top': top, 'horasOpen': dict(horasOpen),
                        'paginas': paginas}
    print(cid, dict(contados), 'paginas:', paginas, 'contactos unicos con evento:', len(porContacto))

json.dump(resultados, io.open('lt_email_eventos.json', 'w', encoding='utf8'), ensure_ascii=False)
print('escrito lt_email_eventos.json')
