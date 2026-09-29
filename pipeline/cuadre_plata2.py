# -*- coding: utf-8 -*-
"""
Por que la plata sigue distinta aunque ya contemos las MISMAS sedes.

Antes compare sobre mi universo (104 sedes en enero). Ahora que puedo
reproducir el suyo exacto (122), la comparacion aisla lo que queda: la
medicion.

Se usa ACT_SEDE_MES y no CREDITO_DIA porque la primera esta indexada por el
UUID de plataforma y cubre TAMBIEN las cuentas sin ficha en HubSpot; la
segunda esta indexada por id de HubSpot y esas sedes quedarian en cero.

Sus ventanas estan ancladas al primer dia del mes de vinculacion, asi que
equivalen a meses de calendario: la ventana 0-30d es el mes de la cosecha,
30-60d el siguiente, y asi.
"""
import io
import json
import collections

import openpyxl

MESES = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06',
         '2026-07']
SU_MONTO = {
 '2026-01': [29581586, 209223514, 190195017, 159785392, 138006108,
             87348990, 109307505],
 '2026-02': [111177515, 183691720, 227688041, 182790451, 206152854,
             227543764, 204482934],
 '2026-03': [162639108, 243913132, 468720466, 368106568, 236158111,
             181630055, 86612265],
 '2026-04': [156824100, 199960625, 250992576, 291440122, 234230295,
             43125615, None],
 '2026-05': [72799380, 244624558, 324144230, 148257350, 29636250, None, None],
 '2026-06': [74997489, 308683621, 413693834, 45215678, None, None, None],
 '2026-07': [None] * 7,
}
SU_SOL = {
 '2026-01': [180, 620, 384, 318, 305, 213, 283],
 '2026-02': [296, 492, 365, 338, 358, 371, 320],
 '2026-03': [331, 525, 623, 480, 419, 425, 71],
 '2026-04': [308, 443, 405, 448, 305, 59, None],
 '2026-05': [535, 518, 533, 399, 50, None, None],
 '2026-06': [302, 789, 817, 111, None, None, None],
 '2026-07': [455, 553, 69, None, None, None, None],
}

H = json.load(io.open('sheet_data.json', encoding='utf8'))
A = H['ACT_SEDE_MES']
ax = {c: i for i, c in enumerate(A[0])}
act = collections.defaultdict(dict)
for r in A[1:]:
    u = str(r[ax['id_sede']]).strip()
    m = str(r[ax['mes']] or '')[:7]
    if u and len(m) == 7:
        act[u][m] = {'sol': float(r[ax['solicitudes']] or 0),
                     'apr': float(r[ax['aprobados']] or 0),
                     'des': float(r[ax['desembolsos']] or 0),
                     'monto': float(r[ax['monto']] or 0)}

XL = ('c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/'
      'Cosechas 2026 sedes tablero360 (2).xlsx')
hf = openpyxl.load_workbook(XL, data_only=True)['Farmer']
cab = [c.value for c in hf[1]]
ci = {c: i for i, c in enumerate(cab) if c}
su = {}
for r in hf.iter_rows(min_row=2, values_only=True):
    u = str(r[ci['id_clinica']] or '').strip()
    if u:
        su[u] = str(r[ci['fecha_vinculacion']] or '')[:7]


def mesMas(m, k):
    t = int(m[:4]) * 12 + int(m[5:7]) - 1 + k
    return '%04d-%02d' % (t // 12, t % 12 + 1)


ag = collections.defaultdict(lambda: {'sol': [0.0] * 7, 'monto': [0.0] * 7,
                                      'des': [0.0] * 7, 'n': 0,
                                      'sin_act': 0})
for u, m in su.items():
    if m not in MESES:
        continue
    b = ag[m]
    b['n'] += 1
    a = act.get(u)
    if not a:
        b['sin_act'] += 1
        continue
    for k in range(7):
        mm = mesMas(m, k)
        v = a.get(mm)
        if v:
            b['sol'][k] += v['sol']
            b['des'][k] += v['des']
            b['monto'][k] += v['monto']

f = lambda v: format(int(round(v)), ',d').replace(',', '.')
print('SOBRE SU UNIVERSO EXACTO · %d sedes cruzadas' % sum(ag[m]['n'] for m in MESES))
print('sedes sin NINGUNA fila en ACT_SEDE_MES: %d'
      % sum(ag[m]['sin_act'] for m in MESES))

print('\n=== SOLICITUDES ===')
print('%-9s %-9s %s' % ('cosecha', 'fuente',
                        ' '.join('%9s' % ('v%d' % (k + 1)) for k in range(7))))
tb = tn = 0
for m in MESES:
    b = ag[m]
    print('%-9s %-9s %s' % (m, 'ellos', ' '.join(
        '%9s' % ('-' if SU_SOL[m][k] is None else f(SU_SOL[m][k]))
        for k in range(7))))
    print('%-9s %-9s %s' % ('', 'nosotros', ' '.join(
        '%9s' % f(b['sol'][k]) for k in range(7))))
    tb += sum(v for v in SU_SOL[m] if v)
    tn += sum(b['sol'])
print('   TOTAL  ellos %s   nosotros %s   dif %.1f%%'
      % (f(tb), f(tn), 100.0 * (tn - tb) / tb))

print('\n=== PLATA (millones) ===')
mb = mn = 0
for m in MESES:
    b = ag[m]
    print('%-9s %-9s %s' % (m, 'ellos', ' '.join(
        '%9s' % ('-' if SU_MONTO[m][k] is None else f(SU_MONTO[m][k] / 1e6))
        for k in range(7))))
    print('%-9s %-9s %s' % ('', 'nosotros', ' '.join(
        '%9s' % f(b['monto'][k] / 1e6) for k in range(7))))
    mb += sum(v for v in SU_MONTO[m] if v)
    mn += sum(b['monto'])
print('   TOTAL  ellos $%s M   nosotros $%s M   dif %.1f%%'
      % (f(mb / 1e6), f(mn / 1e6), 100.0 * (mn - mb) / mb))

print('\n=== DESEMBOLSOS (conteo) · su tablero no lo muestra, va de referencia ===')
for m in MESES:
    print('%-9s %s' % (m, ' '.join('%9s' % f(ag[m]['des'][k])
                                   for k in range(7))))
