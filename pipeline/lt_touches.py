# -*- coding: utf-8 -*-
"""
LT_TOUCHES: el log real de impactos de los workflows Long Tail.

El historial de la propiedad lt_ultima_pieza es el log de envios con fecha (lo
dice su propia descripcion en HubSpot y lo escriben los workflows con la accion
0-5). El conector MCP de HubSpot no lee historial de propiedades; el proxy de
Composio si, via /crm/v3/objects/.../batch/read con propertiesWithHistory.

Sale una fila por (fecha, audiencia, pieza, canal) con el numero de sedes
impactadas ese dia. Eso es lo que se marca en la grafica.
"""
import lib, json, io, collections

HS = 'ca_13P0RgH6oZrv'
ACC = {'PERFILAMIENTO', 'REACTIVAR', 'DESEMBOLSO', 'RECONOCIMIENTO', 'ESTRENA'}


def canal_de(pieza):
    p = str(pieza or '').lower()
    if '_wa' in p:
        return 'WhatsApp'
    if '_mail' in p:
        return 'Email'
    return 'Otro'


if __name__ == '__main__':
    d = json.load(io.open('sheet_data.json', encoding='utf8'))
    S = d['SEDES']
    h = S[0]
    iId, iInt, iA = h.index('id'), h.index('id_internal'), h.index('audiencia_long_tail')

    pob = []
    for r in S[1:]:
        if str(r[iA] or '').strip() in ACC:
            pob.append((str(r[iId]), str(r[iInt] or '').strip(), str(r[iA]).strip()))
    print('poblacion LT: %d sedes' % len(pob))

    audDe, hist = {}, {}
    for i in range(0, len(pob), 50):
        lote = pob[i:i + 50]
        r = lib.C.tools.proxy(
            endpoint='/crm/v3/objects/2-50958246/batch/read', method='POST',
            connected_account_id=HS,
            body={'propertiesWithHistory': ['lt_ultima_pieza'],
                  'properties': ['audiencia_long_tail'],
                  'inputs': [{'id': x[0]} for x in lote]})
        dd = getattr(r, 'data', r)
        if isinstance(dd, str):
            dd = json.loads(dd)
        if dd.get('status') == 'error':
            raise RuntimeError('HubSpot: ' + str(dd.get('message'))[:200])
        for res in (dd.get('results') or []):
            sid = str(res.get('id'))
            audDe[sid] = (res.get('properties') or {}).get('audiencia_long_tail') or ''
            hist[sid] = (res.get('propertiesWithHistory') or {}).get('lt_ultima_pieza') or []
        print('  lote %d-%d: %d sedes leidas' % (i, i + len(lote), len(dd.get('results') or [])))

    ag = collections.Counter()
    conHist = 0
    porSede = collections.Counter()
    for sid, hs in hist.items():
        if hs:
            conHist += 1
        porSede[len(hs)] += 1
        for e in hs:
            f = str(e.get('timestamp'))[:10]
            pieza = str(e.get('value') or '')
            ag[(f, audDe.get(sid, ''), pieza, canal_de(pieza))] += 1

    filas = [['fecha', 'audiencia', 'pieza', 'canal', 'sedes']]
    for k in sorted(ag):
        filas.append([k[0], k[1], k[2], k[3], ag[k]])

    print()
    print('%d de %d sedes tienen historial de envio' % (conHist, len(hist)))
    print('impactos por sede:', dict(sorted(porSede.items())))
    print()
    print('LOG DE IMPACTOS  (%d filas)' % (len(filas) - 1))
    print('  fecha       audiencia        pieza            canal      sedes')
    for f in filas[1:]:
        print('  %-11s %-16s %-16s %-10s %5d' % (f[0], f[1][:16], f[2][:16], f[3], f[4]))

    json.dump({'LT_TOUCHES': filas},
              io.open('tables_lt.json', 'w', encoding='utf8'), ensure_ascii=False)
    print()
    print('escrito tables_lt.json')
