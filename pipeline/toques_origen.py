# -*- coding: utf-8 -*-
"""
Cuantos toques tiene un deal antes de cerrarse, por origen.

'Toque' = num_contacted_notes, que es el contador de HubSpot de veces que se
contacto al deal. Se compara contra los que NO cerraron, porque el promedio de
los ganados solo no dice nada: si los ganados tienen 4 y los perdidos 4, el
seguimiento no es lo que decide.

Se excluyen las mismas cinco causales que el resto del tablero: son registros
que no debieron existir y sus toques ensucian el promedio.
"""
import lib, json, io, collections, unicodedata

HS = 'ca_13P0RgH6oZrv'
FUERA = {'Duplicado/Existente', 'No paso SARLAFT', 'Medicina Alternativa',
         'Le faltan Documentos', 'Pruebas'}
PROPS = ['origen', 'hs_is_closed_won', 'hs_is_closed_lost',
         'num_contacted_notes', 'num_notes', 'createdate', 'closedate',
         'causal_principal_de_cerrado_perdido']


def N(o):
    s = (o or '').strip().upper()
    if not s or s == 'UNASSIGNED':
        return '(SIN ORIGEN)'
    s = ''.join(c for c in unicodedata.normalize('NFD', s)
                if unicodedata.category(c) != 'Mn')
    s = ' '.join(s.split())
    return {'NOVONORDISK': 'NOVO NORDISK'}.get(s, s)


def n(v):
    try:
        return int(float(v))
    except Exception:
        return 0


def proxy(ep):
    r = lib.C.tools.proxy(endpoint=ep, method='GET', connected_account_id=HS)
    d = getattr(r, 'data', r)
    if isinstance(d, str):
        d = json.loads(d)
    if isinstance(d, dict) and d.get('status') == 'error':
        raise RuntimeError('HubSpot: ' + str(d.get('message'))[:200])
    return d


if __name__ == '__main__':
    base = '/crm/v3/objects/deals?limit=100&properties=' + ','.join(PROPS)
    after, deals, pag = None, [], 0
    while True:
        d = proxy(base + ('&after=' + after if after else ''))
        deals.extend(d.get('results') or [])
        pag += 1
        after = (((d.get('paging') or {}).get('next') or {}).get('after'))
        if not after:
            break
    print('%d deals leidos' % len(deals))
    json.dump(deals, io.open('deals_raw.json', 'w', encoding='utf8'),
              ensure_ascii=False)

    # origen -> resultado -> lista de toques
    ag = collections.defaultdict(lambda: collections.defaultdict(list))
    fuera = 0
    for x in deals:
        p = x.get('properties') or {}
        if str(p.get('causal_principal_de_cerrado_perdido') or '') in FUERA:
            fuera += 1
            continue
        cd = str(p.get('createdate') or '')[:10]
        if len(cd) != 10 or cd[:7] < '2026-01':
            continue
        gano = str(p.get('hs_is_closed_won')).lower() == 'true'
        perdio = str(p.get('hs_is_closed_lost')).lower() == 'true'
        res = 'ganado' if gano else ('perdido' if perdio else 'abierto')
        ag[N(p.get('origen'))][res].append(n(p.get('num_contacted_notes')))
    print('   %d excluidos por causal · cosechas desde 2026-01' % fuera)

    def prom(v):
        return sum(v) / len(v) if v else 0

    def med(v):
        return sorted(v)[len(v) // 2] if v else 0

    filas = []
    for o, r in ag.items():
        g, pd, ab = r['ganado'], r['perdido'], r['abierto']
        if len(g) < 3:
            continue
        filas.append((o, len(g), prom(g), med(g), len(pd), prom(pd),
                      len(ab), prom(ab)))
    filas.sort(key=lambda x: -x[1])

    print()
    print('TOQUES PROMEDIO PARA CERRAR, POR ORIGEN  (deals de 2026)')
    print('%-16s %7s %7s %7s | %8s %7s | %8s %7s' %
          ('origen', 'ganados', 'toques', 'mediana', 'perdidos', 'toques',
           'abiertos', 'toques'))
    for f in filas:
        print('%-16s %7d %7.1f %7d | %8d %7.1f | %8d %7.1f' % f)

    tg = [v for o in ag for v in ag[o]['ganado']]
    tp = [v for o in ag for v in ag[o]['perdido']]
    ta = [v for o in ag for v in ag[o]['abierto']]
    print()
    print('%-16s %7d %7.1f %7d | %8d %7.1f | %8d %7.1f' %
          ('TODOS', len(tg), prom(tg), med(tg), len(tp), prom(tp),
           len(ta), prom(ta)))

    print()
    print('DISTRIBUCION de toques en los GANADOS (todos los origenes)')
    c = collections.Counter(tg)
    acum = 0
    for k in sorted(c):
        acum += c[k]
        print('   %2d toques: %4d deals   acumulado %5.1f%%'
              % (k, c[k], 100.0 * acum / len(tg)))
