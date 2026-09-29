# -*- coding: utf-8 -*-
"""Robustez del efecto (DiD emparejado) + tamano real del programa.
El punto: decidir si el tablero puede afirmar algo o si tiene que decir
"no hay evidencia todavia". Bootstrap sobre las sedes, no sobre las filas."""
import json, io, sys, datetime as dt, random
from collections import defaultdict

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
random.seed(7)
H = json.load(io.open('sheet_data.json', encoding='utf8'))

def tabla(n):
    v = H.get(n) or []
    return [dict(zip(v[0], r)) for r in v[1:]] if v else []

BASE = dt.date(2025, 1, 1)
hs2int = {}
for r in tabla('SEDES'):
    a = str(r.get('id') or '').strip(); b = str(r.get('id_internal') or '').strip()
    if a and b: hs2int[a] = b
idx2id = {}
for r in tabla('CREDITO_SEDES'):
    hs = str(r['sede']).strip()
    if hs in hs2int: idx2id[str(r['i'])] = hs2int[hs]

dsem = defaultdict(lambda: defaultdict(lambda: [0.0, 0.0]))
maxD = minD = None
for r in tabla('CREDITO_DIA'):
    d = BASE + dt.timedelta(days=int(r['d']))
    if maxD is None or d > maxD: maxD = d
    if minD is None or d < minD: minD = d
    iid = idx2id.get(str(r['s']))
    if not iid: continue
    c = float(r.get('conv') or 0); m = float(r.get('m_conv') or 0)
    if c or m:
        b = dsem[iid][d]; b[0] += c; b[1] += m

primer = {}; cop_sede = defaultdict(float); pts_sede = defaultdict(float)
for r in tabla('WP_CANJES2'):
    iid = str(r.get('id_sede') or '').strip(); f = str(r.get('fecha') or '')[:10]
    if not iid or not f: continue
    cop_sede[iid] += float(r.get('cop_solicitados') or 0)
    pts_sede[iid] += float(r.get('pts_solicitados') or 0)
    if iid not in primer or f < primer[iid]: primer[iid] = f

def vent(iid, ini, fin):
    n = 0.0; mo = 0.0
    for f, b in dsem.get(iid, {}).items():
        if ini <= f < fin: n += b[0]; mo += b[1]
    return n, mo

control_all = [i for i in dsem if i not in primer]

print('=' * 64)
print('TAMANO DEL PROGRAMA')
print('=' * 64)
# Toda sede que desembolsa gana WP automaticamente (tabla de tramos B1),
# asi que el universo que ACUMULA puntos son las sedes con desembolsos.
print('sedes con al menos un desembolso (ganan WP por definicion): %d' % len(dsem))
print('sedes que alguna vez canjearon: %d' % len([i for i in primer if i in dsem]))
print('tasa de canje: %.1f%%' % (100.0 * len([i for i in primer if i in dsem]) / len(dsem)))
print('WP canjeados: %.0f  -> costo $%.0f' % (sum(pts_sede.values()), sum(cop_sede.values())))
tot_plata = sum(b[1] for s in dsem.values() for b in s.values())
print('plata desembolsada total (todo el historico del tablero): $%.0f' % tot_plata)
print('el programa cuesta %.3f%% de la plata desembolsada' % (100.0 * sum(cop_sede.values()) / tot_plata))

print()
print('=' * 64)
print('DiD EMPAREJADO CON BOOTSTRAP (intervalo de confianza 90%)')
print('=' * 64)

for W in (30, 45, 60):
    def freal(i):
        f0 = dt.datetime.strptime(primer[i], '%Y-%m-%d').date()
        return f0 if (f0 + dt.timedelta(days=W) <= maxD and
                      f0 - dt.timedelta(days=W) >= minD) else None
    eleg = [i for i in primer if i in dsem and freal(i)]
    if len(eleg) < 8:
        print('W=%d: solo %d sedes elegibles, no alcanza' % (W, len(eleg)))
        continue
    fs = sorted(freal(i) for i in eleg)
    corte = fs[len(fs) // 2]
    pre_ctrl = {}
    post_ctrl = {}
    for c in control_all:
        _, a = vent(c, corte - dt.timedelta(days=W), corte)
        _, d = vent(c, corte, corte + dt.timedelta(days=W))
        pre_ctrl[c] = a; post_ctrl[c] = d

    # por sede tratada: su par (antes, despues) y el de su grupo emparejado
    pares = []
    for i in eleg:
        f0 = freal(i)
        _, ta = vent(i, f0 - dt.timedelta(days=W), f0)
        _, td = vent(i, f0, f0 + dt.timedelta(days=W))
        if ta <= 0: continue
        cand = [c for c in control_all if 0.6 * ta <= pre_ctrl[c] <= 1.4 * ta]
        if not cand: continue
        ca = sum(pre_ctrl[c] for c in cand) / len(cand)
        cd = sum(post_ctrl[c] for c in cand) / len(cand)
        pares.append((ta, td, ca, cd, len(cand)))

    def did(muestra):
        ta = sum(x[0] for x in muestra); td = sum(x[1] for x in muestra)
        ca = sum(x[2] for x in muestra); cd = sum(x[3] for x in muestra)
        if not ta or not ca: return float('nan')
        return ((td / ta - 1) - (cd / ca - 1)) * 100

    pt = did(pares)
    boots = []
    for _ in range(2000):
        m = [random.choice(pares) for _ in pares]
        v = did(m)
        if v == v: boots.append(v)
    boots.sort()
    lo = boots[int(0.05 * len(boots))]; hi = boots[int(0.95 * len(boots))]
    print()
    print('W=%d dias | sedes tratadas usadas: %d | pares de control por sede: mediana %d'
          % (W, len(pares), sorted(x[4] for x in pares)[len(pares) // 2]))
    print('   DiD plata: %+.1f pp   IC90: [%+.1f , %+.1f]' % (pt, lo, hi))
    print('   cruza cero: %s' % ('SI -> no se puede afirmar efecto' if lo < 0 < hi else 'NO'))
