# -*- coding: utf-8 -*-
"""
Cuadre de la plata contra el tablero de BI, en SUS ventanas de dias.

Su mapa corta por dias desde la vinculacion (0-30, 30-60, ... 180-210), no
por meses de calendario. Para comparar hay que recalcular lo nuestro igual,
y sobre SU universo: asi cualquier diferencia que quede es de medicion, no
de que estemos contando sedes distintas.

CREDITO_DIA: s = indice de sede (CREDITO_SEDES lo traduce a id de HubSpot),
d = dias desde 2025-01-01, conv = desembolsos, m_conv = plata desembolsada.
"""
import io
import json
import datetime
import collections

import openpyxl

BASE = datetime.date(2025, 1, 1)
VENTANAS = [(0, 30), (30, 60), (60, 90), (90, 120), (120, 150), (150, 180),
            (180, 210)]

H = json.load(io.open('sheet_data.json', encoding='utf8'))
S = H['SEDES']; sx = {c: i for i, c in enumerate(S[0])}
P = H['PLATAFORMA_SEDES']; px = {c: i for i, c in enumerate(P[0])}
CS = H['CREDITO_SEDES']; cs = {c: i for i, c in enumerate(CS[0])}
CD = H['CREDITO_DIA']; cd = {c: i for i, c in enumerate(CD[0])}

vincDe = {str(r[px['id_sede']]).strip(): str(r[px['created']] or '')[:10]
          for r in P[1:]}
# HubSpot id -> id_internal
hsAiid = {}
for r in S[1:]:
    u = str(r[sx['id_internal']] or '').strip()
    if u:
        hsAiid[str(r[sx['id']]).strip()] = u
idxAhs = {int(r[cs['i']]): str(r[cs['sede']]) for r in CS[1:]}


def d(s):
    try:
        return datetime.date(*map(int, str(s)[:10].split('-')))
    except Exception:
        return None


# --- su universo ---------------------------------------------------------
XL = ('c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/'
      'Cosechas 2026 sedes tablero360 (2).xlsx')
h = openpyxl.load_workbook(XL, data_only=True)['Farmer']
cab = [c.value for c in h[1]]
ci = {c: i for i, c in enumerate(cab) if c}
suyas = {}
for r in h.iter_rows(min_row=2, values_only=True):
    u = str(r[ci['id_clinica']] or '').strip()
    if not u:
        continue
    suyas[u] = {'mes': str(r[ci['fecha_vinculacion']] or '')[:7],
                'vinc': d(r[ci['fecha_vinculacion']]),
                'nombre': str(r[ci['nombre_comercial']] or ''),
                'hs': str(r[ci['id_hubspot']] or '').strip()}
print('su universo: %d sedes' % len(suyas))

# --- la actividad diaria, por sede ---------------------------------------
# Se agrupa por id_internal para poder cruzar con la vinculacion.
porIid = collections.defaultdict(list)
sin_cruce = 0
for r in CD[1:]:
    hs = idxAhs.get(int(r[cd['s']]))
    if not hs or hs == '(SIN HUBSPOT)':
        sin_cruce += 1
        continue
    u = hsAiid.get(hs)
    if not u:
        sin_cruce += 1
        continue
    porIid[u].append((int(r[cd['d']]), float(r[cd['conv']] or 0),
                      float(r[cd['m_conv']] or 0), float(r[cd['sol']] or 0)))
print('filas de CREDITO_DIA sin cruce a id_internal: %d de %d'
      % (sin_cruce, len(CD) - 1))


def agrega(universo, vincf):
    """universo: dict uuid -> {mes}. vincf(uuid) -> date de vinculacion."""
    out = collections.defaultdict(
        lambda: {'sol': [0] * 7, 'monto': [0.0] * 7, 'des': [0] * 7,
                 'n': 0, 'aliados_sol': [set() for _ in range(7)],
                 'aliados_des': [set() for _ in range(7)]})
    for u, meta in universo.items():
        m = meta['mes']
        if not m or m < '2026-01' or m > '2026-07':
            continue
        b = out[m]
        b['n'] += 1
        v = vincf(u)
        if not v:
            continue
        for dd, conv, mconv, sol in porIid.get(u, ()):
            dia = (BASE + datetime.timedelta(days=dd) - v).days
            for k, (a, z) in enumerate(VENTANAS):
                if a <= dia < z:
                    b['sol'][k] += sol
                    b['des'][k] += conv
                    b['monto'][k] += mconv
                    if sol:
                        b['aliados_sol'][k].add(u)
                    if conv:
                        b['aliados_des'][k].add(u)
                    break
    return out


mio_su_univ = agrega(suyas, lambda u: suyas[u]['vinc'])

# --- lo que muestra su tablero, transcrito -------------------------------
SU = {
 '2026-01': {'n': 122,
   'sol': [180, 620, 384, 318, 305, 213, 283],
   'monto': [29581586, 209223514, 190195017, 159785392, 138006108,
             87348990, 109307505]},
 '2026-02': {'n': 213,
   'sol': [296, 492, 365, 338, 358, 371, 320],
   'monto': [111177515, 183691720, 227688041, 182790451, 206152854,
             227543764, 204482934]},
 '2026-03': {'n': 198,
   'sol': [331, 525, 623, 480, 419, 425, 71],
   'monto': [162639108, 243913132, 468720466, 368106568, 236158111,
             181630055, 86612265]},
 '2026-04': {'n': 198,
   'sol': [308, 443, 405, 448, 305, 59, None],
   'monto': [156824100, 199960625, 250992576, 291440122, 234230295,
             43125615, None]},
 '2026-05': {'n': 180,
   'sol': [535, 518, 533, 399, 50, None, None],
   'monto': [72799380, 244624558, 324144230, 148257350, 29636250,
             None, None]},
 '2026-06': {'n': 178,
   'sol': [302, 789, 817, 111, None, None, None],
   'monto': [74997489, 308683621, 413693834, 45215678, None, None, None]},
 '2026-07': {'n': 157,
   'sol': [455, 553, 69, None, None, None, None],
   'monto': [None] * 7},
}

f = lambda v: format(int(round(v)), ',d').replace(',', '.')
print('\n=== SOLICITUDES · su tablero contra el mio, MISMO universo y ventanas ===')
print('%-9s %-8s %s' % ('cosecha', 'fuente',
                        ' '.join('%9s' % ('%d-%dd' % v) for v in VENTANAS)))
for m in sorted(SU):
    b = mio_su_univ.get(m, {'sol': [0] * 7})
    print('%-9s %-8s %s' % (m, 'ellos',
          ' '.join('%9s' % ('-' if SU[m]['sol'][k] is None
                            else f(SU[m]['sol'][k])) for k in range(7))))
    print('%-9s %-8s %s' % ('', 'nosotros',
          ' '.join('%9s' % f(b['sol'][k]) for k in range(7))))

print('\n=== PLATA (millones) ===')
for m in sorted(SU):
    b = mio_su_univ.get(m, {'monto': [0.0] * 7})
    print('%-9s %-8s %s' % (m, 'ellos',
          ' '.join('%9s' % ('-' if SU[m]['monto'][k] is None
                            else f(SU[m]['monto'][k] / 1e6))
                   for k in range(7))))
    print('%-9s %-8s %s' % ('', 'nosotros',
          ' '.join('%9s' % f(b['monto'][k] / 1e6) for k in range(7))))

json.dump({'mio_su_univ': {m: {'sol': v['sol'], 'monto': v['monto'],
                               'des': v['des'], 'n': v['n'],
                               'aliados_sol': [len(s) for s in v['aliados_sol']],
                               'aliados_des': [len(s) for s in v['aliados_des']]}
                           for m, v in mio_su_univ.items()}},
          io.open('cuadre.json', 'w', encoding='utf8'), ensure_ascii=False)
