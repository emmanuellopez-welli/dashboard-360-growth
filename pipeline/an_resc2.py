# -*- coding: utf-8 -*-
import io, json, collections, datetime
H = json.load(io.open('sheet_data.json', encoding='utf8'))
def T(n):
    v = H[n]; return [dict(zip(v[0], r)) for r in v[1:]]
def num(x):
    try: return float(x or 0)
    except Exception: return 0.0

INI, FIN, HOY = '2026-08-01', '2026-09-06', '2026-09-07'
import datetime as _dt
BASE = _dt.date(2025, 1, 1)
CD = T('CREDITO_DIA')
IDX = {}
for r in T('CREDITO_SEDES'):
    IDX[int(num(r['i']))] = str(r['sede'] or '').strip()
for r in CD:
    r['d'] = (BASE + _dt.timedelta(days=int(num(r['d'])))).isoformat()
    r['sede'] = IDX.get(int(num(r['s'])), '')
print('CREDITO_DIA filas %d · rango %s a %s'
      % (len(CD), min(r['d'] for r in CD), max(r['d'] for r in CD)))

# oportunidad del periodo, por dia de aprobacion
porDia = collections.defaultdict(lambda: collections.Counter())
for r in CD:
    d = str(r['d'])[:10]
    if not (INI <= d <= FIN): continue
    b = porDia[d]
    b['apr'] += num(r['apr']); b['conv'] += num(r['conv'])
    b['mApr'] += num(r['m_apr']); b['mConv'] += num(r['m_conv'])

apr = sum(b['apr'] for b in porDia.values())
conv = sum(b['conv'] for b in porDia.values())
mApr = sum(b['mApr'] for b in porDia.values())
mConv = sum(b['mConv'] for b in porDia.values())
print('\nLA OPORTUNIDAD %s a %s' % (INI, FIN))
print('   aprobados %.0f · firmados %.0f (%.1f%%)' % (apr, conv, 100*conv/apr))
print('   plata aprobada %.0f · firmada %.0f' % (mApr, mConv))
print('   SIN FIRMAR: %.0f creditos · %.0f COP' % (apr-conv, mApr-mConv))

# vivo vs vencido: la ventana es de 30 dias desde la aprobacion
def dias(d):
    a = datetime.date(*map(int, d.split('-')))
    h = datetime.date(*map(int, HOY.split('-')))
    return (h - a).days
vivo = vencido = 0.0; mv = mvc = 0.0
for d, b in porDia.items():
    sc = b['apr'] - b['conv']; msc = b['mApr'] - b['mConv']
    if dias(d) <= 30: vivo += sc; mv += msc
    else: vencido += sc; mvc += msc
print('   de eso, VIVO (<=30d de aprobado): %.0f cred · %.0f COP' % (vivo, mv))
print('        y VENCIDO (>30d): %.0f cred · %.0f COP' % (vencido, mvc))

# cobertura
G = T('RESCATE_GESTION')
g = [r for r in G if INI <= str(r['fecha'])[:10] <= FIN]
casos = sum(num(r['casos']) for r in g)
mt = sum(num(r['monto_trabajado']) for r in g)
print('\nCOBERTURA DE KEVIN')
print('   casos trabajados %.0f de %.0f sin firmar = %.1f%%'
      % (casos, apr-conv, 100*casos/(apr-conv)))
print('   plata trabajada %.0f de %.0f = %.1f%%' % (mt, mApr-mConv, 100*mt/(mApr-mConv)))

# semana a semana: cobertura
def lunes(d):
    a = datetime.date(*map(int, d.split('-')))
    return (a - datetime.timedelta(days=a.weekday())).isoformat()
sem = collections.defaultdict(lambda: collections.Counter())
for d, b in porDia.items():
    k = lunes(d)
    sem[k]['apr'] += b['apr']; sem[k]['conv'] += b['conv']
    sem[k]['mApr'] += b['mApr']; sem[k]['mConv'] += b['mConv']
for r in g:
    k = lunes(str(r['fecha'])[:10])
    sem[k]['casos'] += num(r['casos']); sem[k]['firmo'] += num(r['firmo'])
    sem[k]['contesto'] += num(r['contesto']); sem[k]['hablo'] += num(r['hablo'])
    sem[k]['mt'] += num(r['monto_trabajado'])
print('\n%-12s %7s %7s %7s %7s %8s' % ('semana', 'sinFirm', 'casos', 'cobert', 'firmo', 'plataSF'))
for k in sorted(sem):
    b = sem[k]; sf = b['apr']-b['conv']
    print('%-12s %7.0f %7.0f %6.1f%% %7.0f %8.0f'
          % (k, sf, b['casos'], 100*b['casos']/max(1,sf), b['firmo'], (b['mApr']-b['mConv'])/1e6))

# desenlace por semana de gestion = las "cosechas" de rescate
D = T('RESCATE_DESENLACE')
coh = collections.defaultdict(lambda: collections.Counter())
for r in D:
    d = str(r['fecha'])[:10]
    if not (INI <= d <= FIN): continue
    coh[lunes(d)][r['desenlace']] += num(r['casos'])
    coh[lunes(d)]['_m_'+str(r['desenlace'])] += num(r['monto'])
print('\nCOSECHAS DE GESTION · desenlace por semana en que se trabajo el caso')
print('%-12s %6s %6s %6s %6s %6s %7s' % ('semana','casos','firmo','vivo','vencid','sinCru','%firma'))
for k in sorted(coh):
    b = coh[k]; n = b['firmo']+b['vivo']+b['vencido']+b['sin_cruce']+b['otro']
    res = b['firmo']+b['vencido']
    print('%-12s %6.0f %6.0f %6.0f %6.0f %6.0f %6.1f%%  (resuelto %.0f, cierre sobre resuelto %.1f%%)'
          % (k, n, b['firmo'], b['vivo'], b['vencido'], b['sin_cruce'],
             100*b['firmo']/max(1,n), res, 100*b['firmo']/max(1,res)))
