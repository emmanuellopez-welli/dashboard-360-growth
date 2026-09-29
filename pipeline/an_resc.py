# -*- coding: utf-8 -*-
"""Numeros reales del frente 4 para disenar contra la realidad, no contra
   supuestos. Todo sobre 2026-08-01..2026-09-06 (el periodo por defecto)."""
import io, json, collections
H = json.load(io.open('sheet_data.json', encoding='utf8'))

def T(n):
    v = H[n]; ix = {c: i for i, c in enumerate(v[0])}
    return [dict(zip(v[0], r)) for r in v[1:]], ix

INI, FIN = '2026-08-01', '2026-09-06'
def num(x):
    try: return float(x or 0)
    except Exception: return 0.0

# --- gestion -----------------------------------------------------------
G, _ = T('RESCATE_GESTION')
D, _ = T('RESCATE_DESENLACE')
C, _ = T('RESCATE_CAUSAL')
P, _ = T('RESCATE_POOL')

def rango(rows, i=INI, f=FIN):
    return [r for r in rows if i <= str(r['fecha'])[:10] <= f]

g = rango(G)
tot = collections.Counter()
for r in g:
    for k in ['casos','llamadas','contesto','colgo','tercero','hablo','interesado','firmo','monto_trabajado','sin_nota']:
        tot[k] += num(r[k])
print('GESTION %s a %s' % (INI, FIN))
for k in ['casos','llamadas','contesto','colgo','hablo','interesado','firmo']:
    print('   %-14s %8.0f' % (k, tot[k]))
print('   monto_trabajado %.0f' % tot['monto_trabajado'])
print('   dias distintos: %d' % len({str(r['fecha'])[:10] for r in g}))
print('   sedes distintas: %d' % len({r['sede'] for r in g}))

# --- desenlace ---------------------------------------------------------
dd = collections.Counter(); dm = collections.Counter()
for r in rango(D):
    dd[r['desenlace']] += num(r['casos']); dm[r['desenlace']] += num(r['monto'])
print('\nDESENLACE (casos / monto)')
for k, v in dd.most_common():
    print('   %-12s %6.0f  %14.0f' % (k, v, dm[k]))
print('   suma casos %.0f (gestion dice %.0f)' % (sum(dd.values()), tot['casos']))

# --- causales ----------------------------------------------------------
cc = collections.Counter()
for r in rango(C):
    cc[r['causal']] += num(r['casos'])
print('\nCAUSALES (%.0f casos)' % sum(cc.values()))
for k, v in cc.most_common():
    print('   %-34s %5.0f  %5.1f%%' % (k, v, 100*v/max(1,sum(cc.values()))))

# --- pool --------------------------------------------------------------
pp = collections.Counter()
for r in rango(P):
    for k in ['rescatados','monto_rescatado','trabajados','monto_trabajado']:
        pp[k] += num(r[k])
print('\nPOOL: %s' % {k: round(v) for k, v in pp.items()})

# --- la oportunidad, desde la tabla de hechos --------------------------
CD, _ = T('CREDITO_DIA')
print('\nCREDITO_DIA columnas: %s' % list(CD[0].keys()))
S, _ = T('SEDES')
print('SEDES columnas: %s' % list(S[0].keys())[:20])
