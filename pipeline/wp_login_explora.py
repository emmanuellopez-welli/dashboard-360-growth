# -*- coding: utf-8 -*-
"""Exploracion en frio de lo que pide Emmanuel ahora (18-sep-2026, segundo
pedido): comparar desembolso de sedes con login en points.welli.com.co
contra sedes sin login, y ver la correlacion WP ganados vs desembolsado en
el tiempo. Antes de escribir el .gs, se verifica que haya variacion real
que mostrar (regla 19: un comparativo sin varianza es ruido, no insight)."""
import json, io, sys, datetime as dt
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

diario = defaultdict(lambda: defaultdict(lambda: [0.0, 0.0]))
for r in tabla('CREDITO_DIA'):
    iid = idx2id.get(str(r['s']))
    if not iid: continue
    c = float(r.get('conv') or 0); m = float(r.get('m_conv') or 0)
    if c or m:
        f = BASE + dt.timedelta(days=int(r['d']))
        b = diario[iid][f.strftime('%Y-%m')]
        b[0] += c; b[1] += m

habilitadas = set(str(r['id_sede']).strip() for r in tabla('WP_HABILITADAS') if r.get('id_sede'))
con_login = set(str(r['id_sede']).strip() for r in tabla('WP_LOGIN_SEDES') if r.get('id_sede'))
print('habilitadas:', len(habilitadas), '| con login:', len(con_login & habilitadas),
      '| sin login:', len(habilitadas - con_login))

sin_login = habilitadas - con_login
grupo_con = habilitadas & con_login

meses = sorted(set(k for s in diario.values() for k in s.keys()))
meses = [m for m in meses if m >= '2026-01']
print('meses disponibles:', meses)
print()
print('%-8s %10s %10s %14s %14s %8s %8s' % (
    'mes', 'n_con', 'n_sin', 'prom_con', 'prom_sin', 'pctD_con', 'pctD_sin'))
for m in meses:
    pc = [diario[i].get(m, [0, 0])[1] for i in grupo_con]
    ps = [diario[i].get(m, [0, 0])[1] for i in sin_login]
    dc = sum(1 for x in pc if x > 0); ds = sum(1 for x in ps if x > 0)
    print('%-8s %10d %10d %14.0f %14.0f %7.1f%% %7.1f%%' % (
        m, len(grupo_con), len(sin_login),
        sum(pc) / len(pc) if pc else 0, sum(ps) / len(ps) if ps else 0,
        100.0 * dc / len(pc) if pc else 0, 100.0 * ds / len(ps) if ps else 0))

print()
print('=== correlacion WP ganado vs desembolsado, por mes (todo el universo) ===')
gan = defaultdict(float)
for r in tabla('WP_SEDE_MES'):
    m = str(r.get('mes') or '')
    gan[m] += float(r.get('wp_ganado') or 0)
tot = defaultdict(float)
for iid, s in diario.items():
    for m, b in s.items():
        tot[m] += b[1]
for m in sorted(set(list(gan.keys()) + list(tot.keys()))):
    if m < '2026-01': continue
    print('%-8s wp_ganado=%8.0f  desembolsado=$%14.0f' % (m, gan.get(m, 0), tot.get(m, 0)))
