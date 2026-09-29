# -*- coding: utf-8 -*-
"""Paso final: arma LT_PIEZAS (una fila por pieza real, decodificada de la
definicion viva de los 5 workflows de Long Tail -- no del nombre en
LT_CADENCIA). Email trae stats reales (sent/delivered/open/click, via
/marketing/v3/emails/statistics/list). WhatsApp NO trae engagement todavia:
Long Tail manda WhatsApp por el canal NATIVO de HubSpot (rootMicId), que es
un sistema DISTINTO al que usa Rescate (Hilos/eventos_hilos) -- se probo
cruzar por telefono y de 149 sedes con telefono conocido solo 5 tuvieron
algun evento en Hilos, confirmando que es el canal equivocado, no un hueco
de cobertura. Pendiente: encontrar el API de analitica del WhatsApp nativo
de HubSpot."""
import json, io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

piezas = json.load(io.open('lt_piezas_raw.json', encoding='utf8'))
stats = json.load(io.open('lt_email_stats.json', encoding='utf8'))

filas = [['workflow_id', 'workflow', 'orden', 'canal', 'dia', 'etiqueta',
          'sent', 'delivered', 'open', 'click', 'openrate', 'clickrate']]
for p in piezas:
    if p['canal'] == 'Email':
        s = stats.get(p['ref'], {})
        sent = s.get('sent', 0)
        deliv = s.get('delivered', 0)
        openn = s.get('open', 0)
        click = s.get('click', 0)
        openrate = round((openn / deliv) * 1000) / 10 if deliv else None
        clickrate = round((click / deliv) * 1000) / 10 if deliv else None
        etiqueta = p.get('subject', '') or ('Email #%d' % p['orden'])
        filas.append([p['workflow_id'], p['workflow'], p['orden'], 'Email', p['dia'],
                      etiqueta, sent, deliv, openn, click, openrate, clickrate])
    else:
        etiqueta = 'WhatsApp #%d (día ~%s)' % (p['orden'], p['dia'])
        filas.append([p['workflow_id'], p['workflow'], p['orden'], 'WhatsApp', p['dia'],
                      etiqueta, None, None, None, None, None, None])

print('%d piezas' % (len(filas) - 1))
for f in filas[1:]:
    print(f)

json.dump({'LT_PIEZAS': filas}, io.open('tables_lt_piezas.json', 'w', encoding='utf8'), ensure_ascii=False)
print('escrito tables_lt_piezas.json')
