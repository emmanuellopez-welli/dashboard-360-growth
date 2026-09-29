# -*- coding: utf-8 -*-
"""Cuanta brecha queda contra la vista de BI, y de que esta hecha.

La vista arranca de institucion_medica (toda cuenta vinculada). El tablero
arranca de HubSpot. Con la misma fecha, la diferencia que queda es de
UNIVERSO, no de definicion — y conviene tenerla desglosada para la proxima
conversacion con Fabian."""
import io, json, collections

H = json.load(io.open('sheet_data.json', encoding='utf8'))
def T(n):
    v = H[n]; return [dict(zip(v[0], r)) for r in v[1:]]

S, P = T('SEDES'), T('PLATAFORMA_SEDES')
plat = {str(r['id_sede']).strip(): r for r in P if str(r['id_sede']).strip()}
hub = {}
for s in S:
    iid = str(s.get('id_internal') or '').strip()
    if iid:
        hub.setdefault(iid, s)

# Las 22 de Peru: tienen ficha en HubSpot?
per = [k for k, r in plat.items() if str(r['pais']) == 'PER']
conFicha = [k for k in per if k in hub]
print('cuentas PER en la plataforma: %d · con ficha en HubSpot: %d'
      % (len(per), len(conFicha)))
print('   -> el filtro de pais esta puesto y es correcto, pero hoy no quita')
print('      nada: esas 22 ya salen antes, por no existir en HubSpot. Entran')
print('      al conteo de BI porque su vista arranca de la plataforma.')

def unif_view(k):
    """La fecha de la vista: MIN(created del admin, hs_createdate)."""
    fa = str(plat.get(k, {}).get('created') or '')[:10]
    fh = str(hub.get(k, {}).get('fecha_creacion') or '')[:10]
    if fa and fh:
        return min(fa, fh)
    return fa or fh

def deshab(s):
    return 'deshabilitad' in str(s.get('pipeline') or '').lower()

# LA VISTA: toda cuenta de plataforma, sin filtrar nada
vista = {k: unif_view(k) for k in plat}
# LA VISTA solo COL
vistaCOL = {k: v for k, v in vista.items() if str(plat[k]['pais']) == 'COL'}
# EL TABLERO: ancla en HubSpot, COL, sin deshabilitadas
tablero = {}
for s in S:
    iid = str(s.get('id_internal') or '').strip()
    if not iid or deshab(s) or iid not in plat:
        continue
    if str(plat[iid]['pais']) != 'COL':
        continue
    tablero[iid] = unif_view(iid)

def cos(m):
    c = collections.Counter()
    for v in m.values():
        if len(v) >= 7 and v[:7] >= '2026-01':
            c[v[:7]] += 1
    return c

cv, cc, ct = cos(vista), cos(vistaCOL), cos(tablero)
print('\n%-9s %9s %9s %9s %9s' % ('cosecha', 'vista', 'vista COL', 'tablero', 'brecha'))
tot = [0, 0, 0]
for m in sorted(set(list(cv) + list(ct))):
    print('%-9s %9d %9d %9d %9d' % (m, cv[m], cc[m], ct[m], cc[m]-ct[m]))
    tot[0] += cv[m]; tot[1] += cc[m]; tot[2] += ct[m]
print('%-9s %9d %9d %9d %9d' % ('TOTAL', tot[0], tot[1], tot[2], tot[1]-tot[2]))

# De que esta hecha la brecha
print('\nDE QUE ESTA HECHA LA BRECHA (vista COL menos tablero, 2026)')
mot = collections.Counter()
for k, v in vistaCOL.items():
    if len(v) < 7 or v[:7] < '2026-01':
        continue
    if k in tablero:
        continue
    s = hub.get(k)
    if s is None:
        mot['no tiene ficha en HubSpot'] += 1
    elif deshab(s):
        mot['ficha deshabilitada'] += 1
    else:
        mot['otra razon'] += 1
for k, n in mot.most_common():
    print('   %-34s %4d' % (k, n))
print('   PER en la vista sin filtrar 2026:  %4d'
      % sum(1 for k, v in vista.items()
            if str(plat[k]['pais']) == 'PER' and len(v) >= 7 and v[:7] >= '2026-01'))
