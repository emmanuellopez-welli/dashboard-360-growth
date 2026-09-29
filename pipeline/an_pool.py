# -*- coding: utf-8 -*-
"""Se puede saber cuanta plata habia DISPONIBLE cada dia?

La bolsa de un dia X es un STOCK: creditos aprobados en [X-30, X] que a esa
fecha todavia no habian firmado. CREDITO_DIA da los aprobados por dia, pero
su columna conv esta atribuida al dia de la APROBACION, asi que no dice
cuando firmo nadie. Las fechas de firma salen de RESCATE_BQ2:
fecha_desembolso menos dias_aprobado_a_desembolso = fecha de aprobacion.
"""
import io, json, collections, datetime
H = json.load(io.open('sheet_data.json', encoding='utf8'))
def T(n):
    v = H[n]; return [dict(zip(v[0], r)) for r in v[1:]]
def num(x):
    try: return float(x or 0)
    except Exception: return 0.0
def dia(s): return datetime.date(*map(int, str(s)[:10].split('-')))

BASE = datetime.date(2025, 1, 1)
IDX = {int(num(r['i'])): str(r['sede'] or '').strip() for r in T('CREDITO_SEDES')}
apr = collections.Counter(); mapr = collections.Counter()
conv = collections.Counter()
for r in T('CREDITO_DIA'):
    d = (BASE + datetime.timedelta(days=int(num(r['d'])))).isoformat()
    apr[d] += num(r['apr']); mapr[d] += num(r['m_apr']); conv[d] += num(r['conv'])

B = T('RESCATE_BQ2')
print('RESCATE_BQ2 %d filas · rango %s a %s'
      % (len(B), min(str(r['fecha_desembolso'])[:10] for r in B),
         max(str(r['fecha_desembolso'])[:10] for r in B)))
c26 = sum(v for k, v in conv.items() if k >= '2026-01-01')
print('conv 2026 en CREDITO_DIA: %.0f · filas BQ2: %d · dif %.1f%%'
      % (c26, len(B), 100*(len(B)-c26)/c26))

# firmas con sus dos fechas
firm = collections.defaultdict(lambda: collections.Counter())   # [aprob][desemb]
mfirm = collections.defaultdict(lambda: collections.Counter())
for r in B:
    fd = dia(r['fecha_desembolso'])
    fa = fd - datetime.timedelta(days=int(num(r['dias_aprobado_a_desembolso'])))
    firm[fa.isoformat()][fd.isoformat()] += 1
    mfirm[fa.isoformat()][fd.isoformat()] += num(r['monto'])

VIDA = 30
def pool(X):
    """casos y plata aprobados sin firmar, vivos, al cierre del dia X."""
    x = dia(X); n = m = 0.0
    for k in range(VIDA + 1):
        d = (x - datetime.timedelta(days=k)).isoformat()
        n += apr[d]; m += mapr[d]
        for fd, c in firm[d].items():
            if fd <= X:
                n -= c; m -= mfirm[d][fd]
    return n, m

G = T('RESCATE_GESTION')
porDia = collections.defaultdict(lambda: collections.Counter())
for r in G:
    d = str(r['fecha'])[:10]
    for c in ['casos', 'llamadas', 'contesto', 'hablo', 'firmo', 'monto_trabajado']:
        porDia[d][c] += num(r[c])

print('\nDIAS DE OPERACION (%d dias con gestion)' % len(porDia))
DOW = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom']
cuenta = collections.Counter()
for d in sorted(porDia): cuenta[DOW[dia(d).weekday()]] += 1
print('   por dia de semana: %s' % dict(cuenta))

print('\n%-12s %4s %9s %13s %7s %7s %7s %13s %7s'
      % ('dia', 'dow', 'poolCasos', 'poolPlata(M)', 'casos', 'contest', 'firmo',
         'trabaj(M)', 'cober%'))
for d in sorted(porDia):
    b = porDia[d]; pn, pm = pool(d)
    print('%-12s %4s %9.0f %13.0f %7.0f %7.0f %7.0f %13.0f %6.1f%%'
          % (d, DOW[dia(d).weekday()], pn, pm/1e6, b['casos'], b['contesto'],
             b['firmo'], b['monto_trabajado']/1e6,
             100*b['casos']/max(1, pn)))
