# -*- coding: utf-8 -*-
"""Cuanto pesa CREDITOP en el frente de rescate.

El negocio: CreditUp es una tablet en el mostrador donde el paciente ve a
Welli, Addi y otros al mismo tiempo y elige ahi mismo. No hay ventana de 30
dias que trabajar — si no nos eligio, ya eligio a otro. Meter esos creditos
en la bolsa de aprobados sin firmar infla el denominador con casos que nadie
podia rescatar.

Hay que medirlo antes de filtrar: si el reparto de dias hasta la firma de
esas sedes es igual al del resto, la hipotesis del negocio no se sostiene en
el dato y hay que decirlo."""
import io, json, collections, datetime
H = json.load(io.open('sheet_data.json', encoding='utf8'))
def T(n):
    v = H[n]; return [dict(zip(v[0], r)) for r in v[1:]]
def num(x):
    try: return float(x or 0)
    except Exception: return 0.0

S = T('SEDES')
cop = {str(s['id']).strip() for s in S
       if str(s.get('origen') or '').strip().upper() == 'CREDITOP'}
copI = {str(s['id_internal']).strip() for s in S
        if str(s.get('origen') or '').strip().upper() == 'CREDITOP'
        and str(s.get('id_internal') or '').strip()}
print('sedes con origen CREDITOP: %d (con id_internal: %d)' % (len(cop), len(copI)))
for s in S:
    if str(s.get('origen') or '').strip().upper() == 'CREDITOP':
        print('   %-44s apps=%-6s desemb=%-5s cosecha %s'
              % (str(s.get('nombre_sede'))[:43], s.get('aplicaciones'),
                 s.get('desembolsos'), s.get('cosecha')))

# --- peso en la tabla de hechos ---------------------------------------
BASE = datetime.date(2025, 1, 1)
IDX = {int(num(r['i'])): str(r['sede'] or '').strip() for r in T('CREDITO_SEDES')}
INI, FIN = '2026-08-01', '2026-09-06'
tot = collections.Counter(); ccop = collections.Counter()
for r in T('CREDITO_DIA'):
    d = (BASE + datetime.timedelta(days=int(num(r['d'])))).isoformat()
    if not (INI <= d <= FIN):
        continue
    sede = IDX.get(int(num(r['s'])), '')
    b = ccop if sede in cop else tot
    b['apr'] += num(r['apr']); b['conv'] += num(r['conv'])
    b['mApr'] += num(r['m_apr']); b['mConv'] += num(r['m_conv'])
print('\nEN LA BOLSA DE RESCATE (%s a %s)' % (INI, FIN))
for nom, b in (('resto', tot), ('CREDITOP', ccop)):
    sf = b['apr'] - b['conv']; msf = b['mApr'] - b['mConv']
    print('  %-9s aprobados %5.0f · firmados %5.0f (%4.1f%%) · sin firmar %5.0f · $%.0f M'
          % (nom, b['apr'], b['conv'], 100*b['conv']/max(1, b['apr']), sf, msf/1e6))
tA = tot['apr'] + ccop['apr']
print('  CREDITOP es %.1f%% de los aprobados y %.1f%% de la plata sin firmar'
      % (100*ccop['apr']/max(1, tA),
         100*(ccop['mApr']-ccop['mConv'])/max(1, (tot['mApr']-tot['mConv'])+(ccop['mApr']-ccop['mConv']))))

# --- la prueba del negocio: cuando firman -------------------------------
# Si CreditUp se decide en el mostrador, sus firmas deben concentrarse en el
# dia 0 mucho mas que el resto.
B = T('RESCATE_BQ2')
dias = collections.defaultdict(lambda: collections.Counter())
for r in B:
    sede = str(r.get('id_sede') or '').strip()
    g = 'CREDITOP' if sede in copI else 'resto'
    d = int(num(r.get('dias_aprobado_a_desembolso')))
    dias[g]['n'] += 1
    if d <= 0: dias[g]['d0'] += 1
    if d <= 3: dias[g]['d3'] += 1
    if d >= 4: dias[g]['d4mas'] += 1
    if d >= 16: dias[g]['d16mas'] += 1
print('\nCUANDO FIRMAN (dias entre aprobacion y desembolso)')
print('%-10s %7s %10s %10s %10s %10s' % ('grupo','firmas','mismo dia','<=3 dias','dia 4+','dia 16+'))
for g in ['resto', 'CREDITOP']:
    b = dias[g]; n = max(1, b['n'])
    print('%-10s %7d %8.1f%% %9.1f%% %9.1f%% %9.1f%%'
          % (g, b['n'], 100*b['d0']/n, 100*b['d3']/n, 100*b['d4mas']/n,
             100*b['d16mas']/n))

# --- y en la lista de Kevin? -------------------------------------------
G = T('RESCATE_GESTION')
nom = {}
for s in S:
    n = str(s.get('nombre_sede') or '').strip().upper()
    if n: nom[n] = str(s.get('origen') or '').strip().upper()
g = [r for r in G if INI <= str(r['fecha'])[:10] <= FIN]
cc = collections.Counter()
for r in g:
    o = nom.get(str(r.get('sede') or '').strip().upper(), '(sin cruce)')
    cc['CREDITOP' if o == 'CREDITOP' else 'resto'] += num(r['casos'])
print('\nEN LA LISTA DE KEVIN: %s' % dict(cc))
