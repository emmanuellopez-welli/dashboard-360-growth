# -*- coding: utf-8 -*-
"""Paso final: mezcla el agregado real de WhatsApp (paso 5) dentro de
LT_PIEZAS -- cada fila WhatsApp de lt_piezas_raw.json (workflow_id+orden+dia,
sacado de la definicion viva del workflow) se empareja con su codigo de
pieza de LT_CADENCIA por (workflow, canal=WhatsApp, dia mas cercano), y ese
codigo se busca en el agregado real (audiencia, pieza) -> sent/delivered/
read/failed/respondio."""
import json, io, sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

sheet_data = json.load(io.open('sheet_data.json', encoding='utf8'))
piezas = json.load(io.open('lt_piezas_raw.json', encoding='utf8'))
waAgg = json.load(io.open('lt_wa_piezas_agg.json', encoding='utf8'))
stats = json.load(io.open('lt_email_stats.json', encoding='utf8'))
textosWa = json.load(io.open('tables_lt_wa_top2.json', encoding='utf8')).get('textos', {})

h = sheet_data['LT_CADENCIA'][0]
iW, iAu, iD, iC, iP = h.index('workflow_id'), h.index('audiencia'), h.index('dia'), h.index('canal'), h.index('pieza')
audDeWf = {}
cadWa = {}  # workflow_id -> lista de (dia, pieza)
for r in sheet_data['LT_CADENCIA'][1:]:
    wid = str(r[iW])
    if not wid:
        continue
    audDeWf[wid] = str(r[iAu])
    if r[iC] == 'WhatsApp':
        cadWa.setdefault(wid, []).append((float(r[iD]), str(r[iP])))

filas = [['workflow_id', 'workflow', 'orden', 'canal', 'dia', 'etiqueta',
          'sent', 'delivered', 'open', 'click', 'openrate', 'clickrate',
          'respondio', 'muestra', 'audiencia']]

# Varios workflows reusan EL MISMO email (mismo content_id) como su paso
# final -- HubSpot lo manda desde 4 cadencias distintas, pero es una sola
# pieza con un solo numero real de enviados/abiertos, medido a nivel de
# email, no por workflow. Repetir la fila 4 veces con el numero identico
# se leia como bug (Emmanuel lo marco el 14-sep-2026, con razon: sin esta
# nota, el mismo numero en 4 filas SI parece un error de copiar y pegar).
# Se agrupa en UNA fila con la lista de workflows/dias donde se usa.
emailPorRef = {}
ordenEmail = []
for p in piezas:
    if p['canal'] != 'Email':
        continue
    ref = p['ref']
    if ref not in emailPorRef:
        emailPorRef[ref] = {'ref': ref, 'subject': p.get('subject', ''), 'usos': []}
        ordenEmail.append(ref)
    emailPorRef[ref]['usos'].append((p['workflow'], p['dia'], p['workflow_id']))

for ref in ordenEmail:
    info = emailPorRef[ref]
    s = stats.get(ref, {})
    sent = s.get('sent', 0)
    deliv = s.get('delivered', 0)
    openn = s.get('open', 0)
    click = s.get('click', 0)
    openrate = round((openn / deliv) * 1000) / 10 if deliv else None
    clickrate = round((click / deliv) * 1000) / 10 if deliv else None
    usos = info['usos']
    audiencias = ','.join(sorted(set(audDeWf.get(w[2], '') for w in usos if audDeWf.get(w[2]))))
    if len(usos) > 1:
        # Mismo contenido, mas de un workflow: se declara la lista completa
        # en vez de repetir la fila. dia = el primero, solo para ordenar.
        workflowTxt = ' + '.join(sorted(set(w for w, _, _ in usos)))
        etiqueta = (info['subject'] or 'Email') + ' · compartida en ' + \
            ', '.join('%s (día %s)' % (w.replace('[Growth] ', ''), int(d)) for w, d, _ in usos)
        dia = min(d for _, d, _ in usos)
    else:
        workflowTxt = usos[0][0]
        etiqueta = info['subject'] or 'Email'
        dia = usos[0][1]
    filas.append([ref, workflowTxt, 0, 'Email', dia, etiqueta,
                  sent, deliv, openn, click, openrate, clickrate, None, None, audiencias])

for p in piezas:
    wid = p['workflow_id']
    if p['canal'] == 'Email':
        continue
    else:
        aud = audDeWf.get(wid, '')
        candidatos = cadWa.get(wid, [])
        pieza_code = None
        if candidatos:
            pieza_code = min(candidatos, key=lambda x: abs(x[0] - p['dia']))[1]
        agg = waAgg.get('%s|%s' % (aud, pieza_code)) if pieza_code else None
        etiqueta = 'WhatsApp #%d (día ~%s)' % (p['orden'], p['dia'])
        muestra = textosWa.get('%s|%s' % (aud, pieza_code)) if pieza_code else None
        if agg and agg.get('sent'):
            filas.append([wid, p['workflow'], p['orden'], 'WhatsApp', p['dia'], etiqueta,
                          agg['sent'], agg['delivered'], agg['read'], None,
                          round((agg['delivered'] / agg['sent']) * 1000) / 10 if agg['sent'] else None,
                          None, agg['respondio'], muestra, aud])
        else:
            filas.append([wid, p['workflow'], p['orden'], 'WhatsApp', p['dia'], etiqueta,
                          None, None, None, None, None, None, None, muestra, aud])

for f in filas[1:]:
    print(f)

json.dump({'LT_PIEZAS': filas}, io.open('tables_lt_piezas.json', 'w', encoding='utf8'), ensure_ascii=False)
print('escrito tables_lt_piezas.json (con WhatsApp real)')
