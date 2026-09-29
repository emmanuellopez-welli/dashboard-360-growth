# -*- coding: utf-8 -*-
"""Se puede poner plata en cada paso del embudo? Solo si cuadra contra
   monto_trabajado, que es el unico monto que la fuente da directo."""
import io, json, collections, datetime
H = json.load(io.open('sheet_data.json', encoding='utf8'))
def T(n): 
    v = H[n]; return [dict(zip(v[0], r)) for r in v[1:]]
def num(x):
    try: return float(x or 0)
    except Exception: return 0.0

INI, FIN = '2026-08-01', '2026-09-06'
def rg(rows, k='fecha'):
    return [r for r in rows if INI <= str(r[k])[:10] <= FIN]

G, C, D = rg(T('RESCATE_GESTION')), rg(T('RESCATE_CAUSAL')), rg(T('RESCATE_DESENLACE'))

trab = sum(num(r['monto_trabajado']) for r in G)
casos = sum(num(r['casos']) for r in G)
print('GESTION · %d casos · $%.0f trabajado' % (casos, trab))

cm = collections.Counter(); cc = collections.Counter()
for r in C:
    cm[r['causal']] += num(r['monto']); cc[r['causal']] += num(r['casos'])
print('\nCAUSAL · suma de montos $%.0f  (trabajado $%.0f) · dif %.2f%%'
      % (sum(cm.values()), trab, 100*(sum(cm.values())-trab)/trab))
NOC = ['No contesta', 'Cuelga']
print('\n%-34s %6s %16s' % ('causal', 'casos', 'monto'))
for k, v in cc.most_common():
    print('%-34s %6.0f %16.0f %s' % (k, v, cm[k], '  <- no contacto' if k in NOC else ''))

nc = sum(cm[k] for k in NOC if k in cm)
ncc = sum(cc[k] for k in NOC if k in cc)
print('\nno contacto: %d casos · $%.0f' % (ncc, nc))
print('hablaron   : %d casos · $%.0f' % (casos-ncc, trab-nc))
print('   (gestion dice hablo = %d)' % sum(num(r['hablo']) for r in G))
print('   monto(Cuelga) = $%.0f -> contesto = $%.0f'
      % (cm.get('Cuelga', 0), trab - cm.get('No contesta', 0)))
inte = cm.get('Interesado \u00b7 va a firmar', 0) or cm.get('Interesado · va a firmar', 0)
print('   interesado: %d casos · $%.0f (gestion dice %d)'
      % (cc.get('Interesado · va a firmar', 0), inte,
         sum(num(r['interesado']) for r in G)))

dm = collections.Counter(); dc = collections.Counter()
for r in D:
    dm[r['desenlace']] += num(r['monto']); dc[r['desenlace']] += num(r['casos'])
print('\nDESENLACE  firmo: %d casos · $%.0f' % (dc['firmo'], dm['firmo']))
print('           suma montos $%.0f' % sum(dm.values()))
