# -*- coding: utf-8 -*-
"""Dos refinamientos:
  1) Denominador honesto de la tasa de canje: no "toda sede que alguna vez
     desembolso desde 2023", sino las que estaban ACTIVAS en la ventana en que
     se podia canjear (jul-sep 2026).
  2) Un angulo menos contaminado por reversion a la media: canjear predice
     que la sede SIGA DESEMBOLSANDO (retencion, variable binaria) en vez de
     cuanta plata mueve. El volumen revierte a la media; el "sigue viva" no
     tanto."""
import json, io, sys, datetime as dt, random
from collections import defaultdict

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
random.seed(11)
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

print('=' * 64)
print('1) TASA DE CANJE CON DENOMINADOR HONESTO')
print('=' * 64)
ini_prog = dt.date(2026, 7, 1)   # primer canje: 3-jul-2026
for etq, desde in (('historico completo', dt.date(2023, 1, 1)),
                   ('desembolso en 2026', dt.date(2026, 1, 1)),
                   ('desembolso en los 90d previos al programa',
                    ini_prog - dt.timedelta(days=90))):
    univ = set()
    for i, s in dsem.items():
        for f, b in s.items():
            if f >= desde and f < ini_prog and b[1] > 0:
                univ.add(i); break
    canj = len([i for i in primer if i in univ])
    print('%-42s universo %5d | canjearon %3d | %.1f%%'
          % (etq, len(univ), canj, 100.0 * canj / len(univ) if univ else 0))

print()
print('=' * 64)
print('2) CANJEAR PREDICE QUE LA SEDE SIGA DESEMBOLSANDO?')
print('=' * 64)
# Para cada tratada: estaba activa antes (por definicion, gano puntos) y
# sigue activa despues? Se compara contra control emparejado por plata previa.
for W in (30, 45):
    eleg = []
    for i in primer:
        if i not in dsem: continue
        f0 = dt.datetime.strptime(primer[i], '%Y-%m-%d').date()
        if f0 + dt.timedelta(days=W) <= maxD:
            eleg.append((i, f0))
    if len(eleg) < 8: continue
    fs = sorted(f for _, f in eleg)
    corte = fs[len(fs) // 2]
    control = [i for i in dsem if i not in primer]
    pre_c = {}; act_c = {}
    for c in control:
        _, a = vent(c, corte - dt.timedelta(days=W), corte)
        n, _ = vent(c, corte, corte + dt.timedelta(days=W))
        pre_c[c] = a; act_c[c] = 1 if n > 0 else 0

    t_act = 0; t_n = 0; c_act = 0.0; c_n = 0
    for i, f0 in eleg:
        _, pre_t = vent(i, f0 - dt.timedelta(days=W), f0)
        if pre_t <= 0: continue
        n, _ = vent(i, f0, f0 + dt.timedelta(days=W))
        t_act += 1 if n > 0 else 0; t_n += 1
        cand = [c for c in control if 0.6 * pre_t <= pre_c[c] <= 1.4 * pre_t]
        if cand:
            c_act += sum(act_c[c] for c in cand) / float(len(cand)); c_n += 1
    if not t_n or not c_n: continue
    pt = 100.0 * t_act / t_n
    pc = 100.0 * c_act / c_n
    print()
    print('W=%d dias | tratadas: %d | controles emparejados: %d' % (W, t_n, c_n))
    print('   siguen desembolsando TRATADAS: %.1f%%  (%d de %d)' % (pt, t_act, t_n))
    print('   siguen desembolsando CONTROL : %.1f%%' % pc)
    print('   >>> diferencia: %+.1f pp' % (pt - pc))
