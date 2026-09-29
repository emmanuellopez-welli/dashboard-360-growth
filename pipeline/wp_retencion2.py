# -*- coding: utf-8 -*-
"""El +17 pp de retencion puede ser un artefacto: la sede tratada esta viva
por definicion el dia exacto del canje, mientras que a la de control solo se
le pedia estar viva en algun punto de la ventana previa. Aca se le exige al
control la MISMA condicion (desembolso en los ultimos RECIEN dias antes del
corte) y se le pone intervalo de confianza."""
import json, io, sys, datetime as dt, random
from collections import defaultdict

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
random.seed(13)
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
maxD = None
for r in tabla('CREDITO_DIA'):
    d = BASE + dt.timedelta(days=int(r['d']))
    if maxD is None or d > maxD: maxD = d
    iid = idx2id.get(str(r['s']))
    if not iid: continue
    c = float(r.get('conv') or 0); m = float(r.get('m_conv') or 0)
    if c or m:
        b = dsem[iid][d]; b[0] += c; b[1] += m

primer = {}
for r in tabla('WP_CANJES2'):
    iid = str(r.get('id_sede') or '').strip(); f = str(r.get('fecha') or '')[:10]
    if not iid or not f: continue
    if iid not in primer or f < primer[iid]: primer[iid] = f

def vent(iid, ini, fin):
    n = 0.0; mo = 0.0
    for f, b in dsem.get(iid, {}).items():
        if ini <= f < fin: n += b[0]; mo += b[1]
    return n, mo

RECIEN = 15   # "vivo justo antes del corte"

for W in (30, 45):
    eleg = []
    for i in primer:
        if i not in dsem: continue
        f0 = dt.datetime.strptime(primer[i], '%Y-%m-%d').date()
        if f0 + dt.timedelta(days=W) <= maxD: eleg.append((i, f0))
    if len(eleg) < 8: continue
    fs = sorted(f for _, f in eleg)
    corte = fs[len(fs) // 2]
    control = [i for i in dsem if i not in primer]

    pre_c = {}; act_c = {}; vivo_c = {}
    for c in control:
        _, a = vent(c, corte - dt.timedelta(days=W), corte)
        n, _ = vent(c, corte, corte + dt.timedelta(days=W))
        nr, _ = vent(c, corte - dt.timedelta(days=RECIEN), corte)
        pre_c[c] = a; act_c[c] = 1 if n > 0 else 0; vivo_c[c] = nr > 0

    pares = []
    for i, f0 in eleg:
        _, pre_t = vent(i, f0 - dt.timedelta(days=W), f0)
        if pre_t <= 0: continue
        # al tratado se le exige la misma condicion de "vivo reciente"
        nr, _ = vent(i, f0 - dt.timedelta(days=RECIEN), f0)
        if nr <= 0: continue
        n, _ = vent(i, f0, f0 + dt.timedelta(days=W))
        cand = [c for c in control
                if vivo_c[c] and 0.6 * pre_t <= pre_c[c] <= 1.4 * pre_t]
        if not cand: continue
        pares.append((1 if n > 0 else 0,
                      sum(act_c[c] for c in cand) / float(len(cand)),
                      len(cand)))

    def dif(m):
        if not m: return float('nan')
        return 100.0 * (sum(x[0] for x in m) / len(m) - sum(x[1] for x in m) / len(m))

    pt = dif(pares)
    boots = []
    for _ in range(3000):
        m = [random.choice(pares) for _ in pares]
        v = dif(m)
        if v == v: boots.append(v)
    boots.sort()
    lo = boots[int(0.05 * len(boots))]; hi = boots[int(0.95 * len(boots))]
    print()
    print('W=%d dias | pares usados: %d | controles por sede: mediana %d'
          % (W, len(pares), sorted(x[2] for x in pares)[len(pares) // 2] if pares else 0))
    print('   retencion TRATADAS: %.1f%%   CONTROL emparejado y vivo: %.1f%%'
          % (100.0 * sum(x[0] for x in pares) / len(pares),
             100.0 * sum(x[1] for x in pares) / len(pares)))
    print('   >>> diferencia: %+.1f pp   IC90: [%+.1f , %+.1f]  cruza cero: %s'
          % (pt, lo, hi, 'SI' if lo < 0 < hi else 'NO'))
