# -*- coding: utf-8 -*-
"""Exploracion en frio: hay senal real de que Welli Points mueva la aguja?
Se corre ANTES de disenar la pestana (regla 2 y 19 de CLAUDE.md): si el
efecto es cero, el tablero tiene que decir "no mueve la aguja", no maquillar.
Nada de esto toca produccion, solo lee sheet_data.json."""
import json, io, sys, datetime as dt
from collections import defaultdict

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
H = json.load(io.open('sheet_data.json', encoding='utf8'))

def tabla(n):
    v = H.get(n) or []
    if not v: return []
    head = v[0]
    return [dict(zip(head, r)) for r in v[1:]]

BASE = dt.date(2025, 1, 1)
def dia(off):  return BASE + dt.timedelta(days=int(off))

# ---- 1. mapa de sedes -----------------------------------------------------
idx2nom = {}
for r in tabla('CREDITO_SEDES'):
    idx2nom[str(r['i'])] = str(r['sede']).strip().lower()

# CREDITO_SEDES.sede NO es un nombre: es el id numerico del objeto Sede de
# HubSpot. La cadena real es sede(id HS) -> SEDES.id -> SEDES.id_internal
# (el UUID de plataforma), que es la llave que usan todas las tablas de WP.
hs2int = {}
for r in tabla('SEDES'):
    a = str(r.get('id') or '').strip()
    b = str(r.get('id_internal') or '').strip()
    if a and b: hs2int[a] = b

idx2id = {}
sin = 0
for i, hs in idx2nom.items():
    if hs in hs2int: idx2id[i] = hs2int[hs]
    else: sin += 1
print('CREDITO_SEDES:', len(idx2nom), ' SEDES id->id_internal:', len(hs2int))
print('indices de credito que cruzan a id_internal:', len(idx2id), ' sin cruce:', sin)

# ---- 2. serie mensual de desembolsos por sede -----------------------------
# conv = desembolsos (count), m_conv = plata desembolsada
desem = defaultdict(lambda: defaultdict(lambda: [0, 0.0]))  # id -> mes -> [n, monto]
minD, maxD = None, None
for r in tabla('CREDITO_DIA'):
    i = str(r['s'])
    iid = idx2id.get(i)
    d = dia(r['d'])
    if minD is None or d < minD: minD = d
    if maxD is None or d > maxD: maxD = d
    if not iid: continue
    c = float(r.get('conv') or 0)
    m = float(r.get('m_conv') or 0)
    if c or m:
        k = d.strftime('%Y-%m')
        b = desem[iid][k]
        b[0] += c; b[1] += m

print('rango CREDITO_DIA:', minD, '->', maxD)
print('sedes con algun desembolso:', len(desem))

# ---- 3. canjes ------------------------------------------------------------
canj = tabla('WP_CANJES2')
primer = {}
pts_por_sede = defaultdict(float)
cop_por_sede = defaultdict(float)
fechas = []
for r in canj:
    iid = str(r.get('id_sede') or '').strip()
    f = str(r.get('fecha') or '')[:10]
    if not iid or not f: continue
    fechas.append(f)
    pts_por_sede[iid] += float(r.get('pts_solicitados') or 0)
    cop_por_sede[iid] += float(r.get('cop_solicitados') or 0)
    if iid not in primer or f < primer[iid]: primer[iid] = f
print('canjes:', len(canj), ' sedes distintas que canjearon:', len(primer))
print('rango canjes:', min(fechas), '->', max(fechas))
print('WP canjeados total:', sum(pts_por_sede.values()),
      ' COP:', sum(cop_por_sede.values()))
print('implicito COP/WP:', (sum(cop_por_sede.values()) / sum(pts_por_sede.values()))
      if sum(pts_por_sede.values()) else 0)

# cuantas de las que canjearon cruzan contra desembolsos
cruzan = [i for i in primer if i in desem]
print('sedes que canjearon Y tienen desembolsos:', len(cruzan))

# ---- 4. WP ganados por sede (universo del programa) ------------------------
gan = defaultdict(float)
for r in tabla('WP_SEDE_MES'):
    iid = str(r.get('id_sede') or '').strip()
    if iid: gan[iid] += float(r.get('wp_ganado') or 0)
conGan = {i: v for i, v in gan.items() if v > 0}
print('sedes que GANARON wp alguna vez:', len(conGan))
print('sedes que ganaron pero NUNCA canjearon:', len([i for i in conGan if i not in primer]))


# ---- 5. serie DIARIA por sede (para ventanas exactas) ---------------------
# Las ventanas por mes no sirven: los canjes empiezan el 3-jul-2026 y el dato
# corta el 17-sep, asi que un "mes despues" siempre quedaria incompleto y
# sesgaria el resultado hacia abajo. Se trabaja con dias exactos.
dsem = defaultdict(lambda: defaultdict(lambda: [0.0, 0.0]))  # id -> fecha -> [n, cop]
for r in tabla('CREDITO_DIA'):
    iid = idx2id.get(str(r['s']))
    if not iid: continue
    c = float(r.get('conv') or 0); m = float(r.get('m_conv') or 0)
    if c or m:
        b = dsem[iid][dia(r['d'])]
        b[0] += c; b[1] += m

def vent(iid, ini, fin):
    """suma [n, cop] en [ini, fin)"""
    n = 0.0; mo = 0.0
    for f, b in dsem.get(iid, {}).items():
        if ini <= f < fin: n += b[0]; mo += b[1]
    return n, mo

# control: sedes con desembolsos que NUNCA canjearon. Es el contrafactual
# correcto -- toda sede que desembolsa gana WP automaticamente por la tabla
# de tramos, asi que el corte real de comportamiento es canjear o no.
todos = set(dsem.keys())
tratados = set(i for i in primer if i in dsem)
control = sorted(todos - set(primer.keys()))
print()
print('universo con desembolsos:', len(todos), '| tratados:', len(tratados),
      '| control:', len(control))

for W in (30, 45, 60):
    print()
    print('=' * 60)
    print('VENTANA %d DIAS' % W)
    eleg = [i for i in tratados
            if dt.datetime.strptime(primer[i], '%Y-%m-%d').date() + dt.timedelta(days=W) <= maxD
            and dt.datetime.strptime(primer[i], '%Y-%m-%d').date() - dt.timedelta(days=W) >= minD]
    print('sedes tratadas con ventana completa: %d de %d' % (len(eleg), len(tratados)))
    if not eleg: continue
    tan = tam = tdn = tdm = 0.0
    subieron = 0
    for i in eleg:
        f0 = dt.datetime.strptime(primer[i], '%Y-%m-%d').date()
        a1, a2 = vent(i, f0 - dt.timedelta(days=W), f0)
        d1, d2 = vent(i, f0, f0 + dt.timedelta(days=W))
        tan += a1; tam += a2; tdn += d1; tdm += d2
        if d2 > a2: subieron += 1
    lt_n = ((tdn / tan - 1) * 100) if tan else float('nan')
    lt_m = ((tdm / tam - 1) * 100) if tam else float('nan')
    print('TRATADOS  antes: %.0f desemb / $%.0f   despues: %.0f desemb / $%.0f'
          % (tan, tam, tdn, tdm))
    print('TRATADOS  lift n: %.1f%%   lift plata: %.1f%%' % (lt_n, lt_m))
    print('sedes que subieron plata: %d de %d (%.0f%%)'
          % (subieron, len(eleg), 100.0 * subieron / len(eleg)))

    # control con el MISMO calendario: se usa la fecha de canje mediana de los
    # elegibles como corte unico, para netear estacionalidad del mercado.
    fs = sorted(dt.datetime.strptime(primer[i], '%Y-%m-%d').date() for i in eleg)
    corte = fs[len(fs) // 2]
    can = cam = cdn = cdm = 0.0
    for i in control:
        a1, a2 = vent(i, corte - dt.timedelta(days=W), corte)
        d1, d2 = vent(i, corte, corte + dt.timedelta(days=W))
        can += a1; cam += a2; cdn += d1; cdm += d2
    lc_n = ((cdn / can - 1) * 100) if can else float('nan')
    lc_m = ((cdm / cam - 1) * 100) if cam else float('nan')
    print('corte calendario del control:', corte)
    print('CONTROL   antes: %.0f desemb / $%.0f   despues: %.0f desemb / $%.0f'
          % (can, cam, cdn, cdm))
    print('CONTROL   lift n: %.1f%%   lift plata: %.1f%%' % (lc_n, lc_m))
    print('>>> DiD   n: %+.1f pp   plata: %+.1f pp' % (lt_n - lc_n, lt_m - lc_m))

    # ROI incremental: la plata de mas atribuible vs lo que costaron los canjes
    esperado = tam * (1 + lc_m / 100.0)   # lo que habrian desembolsado sin WP
    incr = tdm - esperado
    costo_eleg = sum(cop_por_sede[i] for i in eleg)
    print('plata esperada sin WP (contrafactual): $%.0f' % esperado)
    print('plata incremental atribuible: $%+.0f' % incr)
    print('costo de canjes de esas sedes: $%.0f' % costo_eleg)
    if costo_eleg:
        print('>>> ROI incremental: %.1f x  (por cada $1 en WP, $%.1f desembolsados de mas)'
              % (incr / costo_eleg, incr / costo_eleg))
