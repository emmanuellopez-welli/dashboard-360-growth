# -*- coding: utf-8 -*-
"""El DiD crudo daba -15 a -30 pp (las sedes que canjean desembolsan MENOS
despues). Antes de creerlo hay que descartar reversion a la media: una sede
canjea JUSTO despues de acumular puntos, o sea justo despues de un pico de
desembolsos, asi que la ventana "antes" esta seleccionada para ser alta.

Dos pruebas:
  A) PLACEBO: a las mismas sedes se les pone una fecha de canje FALSA, 60
     dias antes de la real. Si el "efecto" negativo reaparece con una fecha
     inventada, no es el canje: es el artefacto.
  B) CONTROL EMPAREJADO: se comparan contra sedes que NO canjearon pero que
     venian del mismo nivel de desembolso en la ventana previa."""
import json, io, sys, datetime as dt, random
from collections import defaultdict

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
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

primer = {}
cop_sede = defaultdict(float)
for r in tabla('WP_CANJES2'):
    iid = str(r.get('id_sede') or '').strip(); f = str(r.get('fecha') or '')[:10]
    if not iid or not f: continue
    cop_sede[iid] += float(r.get('cop_solicitados') or 0)
    if iid not in primer or f < primer[iid]: primer[iid] = f

def vent(iid, ini, fin):
    n = 0.0; mo = 0.0
    for f, b in dsem.get(iid, {}).items():
        if ini <= f < fin: n += b[0]; mo += b[1]
    return n, mo

def lift(ids, fecha_de, W):
    """lift agregado de plata en ventana W, con fecha de corte por sede"""
    a = d = 0.0
    for i in ids:
        f0 = fecha_de(i)
        if f0 is None: continue
        _, a2 = vent(i, f0 - dt.timedelta(days=W), f0)
        _, d2 = vent(i, f0, f0 + dt.timedelta(days=W))
        a += a2; d += d2
    return (((d / a - 1) * 100) if a else float('nan')), a, d

W = 30
tratados = [i for i in primer if i in dsem]
def freal(i):
    f0 = dt.datetime.strptime(primer[i], '%Y-%m-%d').date()
    return f0 if (f0 + dt.timedelta(days=W) <= maxD and f0 - dt.timedelta(days=W) >= minD) else None

eleg = [i for i in tratados if freal(i)]
print('ventana: %d dias | sedes tratadas elegibles: %d' % (W, len(eleg)))

l_real, a_real, d_real = lift(eleg, freal, W)
print()
print('--- A) PLACEBO -------------------------------------------------')
print('REAL      (fecha de canje verdadera)  lift plata: %+.1f%%' % l_real)
for atras in (60, 90, 120):
    def ffake(i, atras=atras):
        f0 = freal(i)
        return (f0 - dt.timedelta(days=atras)) if f0 else None
    lf, af, df = lift(eleg, ffake, W)
    print('PLACEBO   (canje falso %3d dias antes) lift plata: %+.1f%%' % (atras, lf))

print()
print('--- B) CONTROL EMPAREJADO POR NIVEL PREVIO ---------------------')
# Para cada tratada se buscan sedes de control con plata previa parecida
# (+-40%) en la MISMA ventana calendario, y se mide su lift.
control = [i for i in dsem if i not in primer]
fs = sorted(freal(i) for i in eleg)
corte = fs[len(fs) // 2]
print('corte calendario:', corte)

pre_ctrl = {}
for i in control:
    _, m = vent(i, corte - dt.timedelta(days=W), corte)
    pre_ctrl[i] = m

emp_a = emp_d = 0.0
usadas = 0
sin_match = 0
for i in eleg:
    f0 = freal(i)
    _, pre_t = vent(i, f0 - dt.timedelta(days=W), f0)
    if pre_t <= 0: continue
    cand = [c for c in control if 0.6 * pre_t <= pre_ctrl[c] <= 1.4 * pre_t]
    if not cand:
        sin_match += 1
        continue
    usadas += 1
    # promedio del grupo emparejado, para que cada tratada pese igual
    sa = sd = 0.0
    for c in cand:
        _, a2 = vent(c, corte - dt.timedelta(days=W), corte)
        _, d2 = vent(c, corte, corte + dt.timedelta(days=W))
        sa += a2; sd += d2
    emp_a += sa / len(cand); emp_d += sd / len(cand)

l_emp = ((emp_d / emp_a - 1) * 100) if emp_a else float('nan')
print('tratadas con match: %d (sin match: %d)' % (usadas, sin_match))
print('CONTROL EMPAREJADO lift plata: %+.1f%%' % l_emp)
print('TRATADAS           lift plata: %+.1f%%' % l_real)
print('>>> DiD emparejado: %+.1f pp' % (l_real - l_emp))
