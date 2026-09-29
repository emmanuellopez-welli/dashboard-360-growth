# -*- coding: utf-8 -*-
"""Cuanto peso pierde el tablero al sacar las deshabilitadas."""
import json, io, collections
sedes = json.load(io.open('sedes_deshab.json', encoding='utf8'))
DES = '1327734139'
MKT = {'PAGINA WEB','SOCIAL MEDIA','EVENTO','FREELANCE','REFERIDO','DENTALINK',
       'OK VET','DT DENTAL','STARKEY','ESSILOR','ANDREC','NOVO NORDISK'}

def n(v):
    try: return float(v)
    except Exception: return 0.0

tA = tP = 0.0; dA = dP = 0.0; tot = des = 0
sin_op = 0
det26 = collections.defaultdict(list)
for x in sedes:
    p = x.get('properties') or {}
    a, m = n(p.get('aplicaciones')), n(p.get('monto_total_desembolsado'))
    tot += 1; tA += a; tP += m
    if p.get('hs_pipeline_stage') != DES: continue
    des += 1; dA += a; dP += m
    if a == 0: sin_op += 1
    cos = str(p.get('hs_createdate') or '')[:7]
    if cos[:4] == '2026':
        det26[cos].append((p.get('nombre_sede') or '?',
                           (p.get('origen') or '(sin origen)').upper(),
                           int(a), int(m)))

f = lambda v: format(int(v), ',d').replace(',', '.')
print('PESO DE LAS DESHABILITADAS')
print('  sedes        %4d de %4d   = %.1f%%' % (des, tot, 100.0*des/tot))
print('  aplicaciones %s de %s = %.1f%%' % (f(dA), f(tA), 100.0*dA/tA))
print('  plata        $%s de $%s = %.1f%%' % (f(dP), f(tP), 100.0*dP/tP))
print('  de las 344, %d nunca hicieron una aplicacion' % sin_op)

print('\nLAS DE COSECHA 2026 (las que si mueven los mapas de cohortes)')
tm = 0
for k in sorted(det26):
    fs = det26[k]
    mk = [r for r in fs if r[1] in MKT]
    tm += len(mk)
    print('  %s  %2d sedes  (%d de marketing)' % (k, len(fs), len(mk)))
    for nm, o, a, m in sorted(fs, key=lambda r: -r[3]):
        print('        %-38s %-14s %3d apps  $%s' % (nm[:38], o, a, f(m)))
print('  ---- total 2026: %d sedes, %d de origen marketing' %
      (sum(len(v) for v in det26.values()), tm))
