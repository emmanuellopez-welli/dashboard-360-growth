# -*- coding: utf-8 -*-
"""Stock contra flujo. El "cuanto habia posible" de un dia se puede leer de
   dos formas y dan numeros 45 veces distintos:
     STOCK  todo lo aprobado sin firmar y vivo ese dia (bolsa de 30 dias)
     FLUJO  lo que ENTRO a la bolsa ese dia (aprobado ese dia, sin firmar)
   Con el stock la cobertura diaria da 1% y se lee como que no hacemos nada.
   Con el flujo se compara flujo contra flujo, que es lo que se opera."""
import io, json, collections, datetime
H = json.load(io.open('sheet_data.json', encoding='utf8'))
def T(n):
    v = H[n]; return [dict(zip(v[0], r)) for r in v[1:]]
def num(x):
    try: return float(x or 0)
    except Exception: return 0.0
def dia(s): return datetime.date(*map(int, str(s)[:10].split('-')))

BASE = datetime.date(2025, 1, 1)
sf = collections.Counter(); msf = collections.Counter()
for r in T('CREDITO_DIA'):
    d = (BASE + datetime.timedelta(days=int(num(r['d'])))).isoformat()
    sf[d] += num(r['apr']) - num(r['conv'])
    msf[d] += num(r['m_apr']) - num(r['m_conv'])

def stock(X):
    x = dia(X); n = m = 0.0
    for k in range(31):
        d = (x - datetime.timedelta(days=k)).isoformat()
        n += sf[d]; m += msf[d]
    return n, m

G = T('RESCATE_GESTION'); C = T('RESCATE_CAUSAL'); D = T('RESCATE_DESENLACE')
por = collections.defaultdict(lambda: collections.Counter())
for r in G:
    d = str(r['fecha'])[:10]
    for c in ['casos', 'contesto', 'hablo', 'firmo', 'monto_trabajado']:
        por[d][c] += num(r[c])
for r in C:
    d = str(r['fecha'])[:10]
    k = str(r['causal'])
    if k not in ('No contesta', 'Cuelga'):
        por[d]['mHablo'] += num(r['monto'])
for r in D:
    if str(r['desenlace']) == 'firmo':
        por[str(r['fecha'])[:10]]['mFirmo'] += num(r['monto'])

DOW = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']
print('%-11s %3s | %8s %10s | %8s %10s | %6s %6s %6s %9s | %7s'
      % ('dia', 'dow', 'entroN', 'entroM(M)', 'stockN', 'stockM(M)',
         'trab', 'contes', 'firmo', 'trabM(M)', 'cober%'))
tot = collections.Counter()
for d in sorted(por):
    b = por[d]; sn, sm = stock(d)
    en, em = sf[d], msf[d]
    tot['en'] += en; tot['em'] += em
    tot['trab'] += b['casos']; tot['mtrab'] += b['monto_trabajado']
    print('%-11s %3s | %8.0f %10.0f | %8.0f %10.0f | %6.0f %6.0f %6.0f %9.0f | %6.1f%%'
          % (d, DOW[dia(d).weekday()], en, em/1e6, sn, sm/1e6, b['casos'],
             b['contesto'], b['firmo'], b['monto_trabajado']/1e6,
             100*b['monto_trabajado']/max(1, em)))
print('\nsuma de dias con gestion: entro %.0f casos / $%.0f M · trabajado %.0f / $%.0f M'
      % (tot['en'], tot['em']/1e6, tot['trab'], tot['mtrab']/1e6))
print('cobertura sobre lo que entro esos dias: %.1f%% casos · %.1f%% plata'
      % (100*tot['trab']/tot['en'], 100*tot['mtrab']/tot['em']))
