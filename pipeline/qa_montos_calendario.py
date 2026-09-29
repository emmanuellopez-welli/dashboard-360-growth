# -*- coding: utf-8 -*-
"""Verifica, dia por dia, cada monto que aparece en la tarjeta del
   calendario: entroMonto, monto (trabajado), mFirmo, mHablo.
   Se recalcula desde cero contra sheet_data.json y se compara contra el
   payload que produce el motor (f4.gestion.calendario)."""
import io, json, collections, datetime

H = json.load(io.open('sheet_data.json', encoding='utf8'))
def T(n):
    v = H[n]; return [dict(zip(v[0], r)) for r in v[1:]]
def num(x):
    try: return float(x or 0)
    except Exception: return 0.0

# --- CreditUp fuera, igual que el motor ---------------------------------
S = T('SEDES')
fueraHS, fueraInt, fueraNom = set(), set(), set()
for s in S:
    if str(s.get('origen') or '').strip().upper() != 'CREDITOP':
        continue
    if str(s.get('id') or '').strip(): fueraHS.add(str(s['id']).strip())
    if str(s.get('id_internal') or '').strip(): fueraInt.add(str(s['id_internal']).strip())
    nm = str(s.get('nombre_sede') or '').strip().upper()
    if nm: fueraNom.add(nm)

def norm(n):
    return str(n or '').strip().upper()

# --- CREDITO_DIA: lo que entro a la bolsa cada dia (apr - conv, en plata)
BASE = datetime.date(2025, 1, 1)
IDX = {int(num(r['i'])): str(r['sede'] or '').strip() for r in T('CREDITO_SEDES')}
entroMonto = collections.Counter()
entroCasos = collections.Counter()
diasCredito = set()
deshab = {str(s['id']).strip() for s in S
          if 'deshabilitad' in str(s.get('pipeline') or '').lower()
          and str(s.get('id') or '').strip()}
for r in T('CREDITO_DIA'):
    d = (BASE + datetime.timedelta(days=int(num(r['d'])))).isoformat()
    sede = IDX.get(int(num(r['s'])), '')
    diasCredito.add(d)
    if sede in fueraHS or sede in deshab:
        continue
    entroMonto[d] += num(r['m_apr']) - num(r['m_conv'])
    entroCasos[d] += num(r['apr']) - num(r['conv'])

# --- RESCATE_GESTION: monto_trabajado, casos, contesto, hablo, firmo por dia
G = T('RESCATE_GESTION')
def filtrada(hoja):
    return [r for r in hoja if norm(r.get('sede')) not in fueraNom]
G = filtrada(G)
gPorDia = collections.defaultdict(lambda: collections.Counter())
for r in G:
    d = str(r['fecha'])[:10]
    b = gPorDia[d]
    b['casos'] += num(r['casos']); b['contesto'] += num(r['contesto'])
    b['hablo'] += num(r['hablo']); b['firmo'] += num(r['firmo'])
    b['monto'] += num(r['monto_trabajado'])

# --- RESCATE_DESENLACE: monto de las firmas (mFirmo) por dia
D = filtrada(T('RESCATE_DESENLACE'))
mFirmoDia = collections.Counter()
for r in D:
    if str(r['desenlace']) == 'firmo':
        mFirmoDia[str(r['fecha'])[:10]] += num(r['monto'])

# --- RESCATE_CAUSAL: para mHablo = trabajado - noContesta - colgo
C = filtrada(T('RESCATE_CAUSAL'))
mNoContesta = collections.Counter(); mColgo = collections.Counter()
for r in C:
    d = str(r['fecha'])[:10]
    n = str(r['causal'])
    if 'no contesta' in n.lower() or 'no contactad' in n.lower():
        mNoContesta[d] += num(r['monto'])
    elif 'cuelga' in n.lower():
        mColgo[d] += num(r['monto'])

# --- payload del motor ---------------------------------------------------
pay = json.load(io.open('f4/out11.json', encoding='utf8'))['f4']['gestion']
porDia = {}
for w in pay['calendario']:
    for d in w['dias']:
        if d['hubo']:
            porDia[d['fecha']] = d

print('%-11s | %14s %14s | %14s %14s | %13s %13s | %13s %13s | %13s %13s'
      % ('fecha', 'entroM motor', 'entroM mio', 'trabaj motor', 'trabaj mio',
         'mFirmo motor', 'mFirmo mio', 'mHablo motor', 'mHablo mio',
         'entroC motor', 'entroC mio'))
mal = 0
for d in sorted(porDia):
    p = porDia[d]
    em_m, em_y = p['entroMonto'], round(entroMonto.get(d, 0))
    tr_m, tr_y = p['monto'], round(gPorDia[d]['monto'])
    mf_m, mf_y = p['mFirmo'], round(mFirmoDia.get(d, 0))
    mh_m = p['mHablo']
    mh_y = None
    if gPorDia[d]['monto'] > 0:
        mh_y = round(gPorDia[d]['monto'] - mNoContesta.get(d, 0) - mColgo.get(d, 0))
    ec_m, ec_y = p['entroCasos'], round(entroCasos.get(d, 0))
    difs = []
    if em_m != em_y: difs.append('entroMonto')
    if tr_m != tr_y: difs.append('trabajado')
    if mf_m != mf_y: difs.append('mFirmo')
    if mh_y is not None and (mh_m != mh_y): difs.append('mHablo')
    if ec_m != ec_y: difs.append('entroCasos')
    marca = '  <-- ' + ','.join(difs) if difs else ''
    if difs: mal += 1
    print('%-11s | %14s %14s | %13s %13s | %13s %13s | %13s %13s | %10s %10s%s'
          % (d, em_m, em_y, tr_m, tr_y, mf_m, mf_y,
             mh_m, mh_y, ec_m, ec_y, marca))
print('\ndias con alguna discrepancia: %d de %d' % (mal, len(porDia)))
