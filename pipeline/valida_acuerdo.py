# -*- coding: utf-8 -*-
"""Valida los tres acuerdos del 7-sep-2026 sobre las cosechas:
     1. la fecha es la MAS TEMPRANA entre HubSpot y plataforma
        (= fecha_minima_admin_hubspot de la vista de BI)
     2. el universo filtra pais COL
     3. el universo filtra deshabilitadas
   Y compara el conteo del tablero contra la vista, para saber exactamente
   cuanto queda de brecha y por que."""
import io, json, collections

H = json.load(io.open('sheet_data.json', encoding='utf8'))
def T(n):
    v = H[n]; return [dict(zip(v[0], r)) for r in v[1:]]

S, P = T('SEDES'), T('PLATAFORMA_SEDES')
plat = {}
for r in P:
    k = str(r['id_sede']).strip()
    if k:
        plat[k] = {'created': str(r['created'] or '')[:10],
                   'pais': str(r.get('pais') or 'COL')}

DESH = ('deshabilitad',)
def deshab(s):
    return any(d in str(s.get('pipeline') or '').lower() for d in DESH)

def unif(s):
    iid = str(s.get('id_internal') or '').strip()
    fc = str(s.get('fecha_creacion') or '')[:10]
    fv = plat.get(iid, {}).get('created', '')[:10]
    if fc and fv:
        return min(fc, fv)
    return fc or fv

# --- la escalera, paso por paso ---------------------------------------
print('EL UNIVERSO, PASO POR PASO')
n0 = len(S); print('   fichas en HubSpot                  %5d' % n0)
a = [s for s in S if not deshab(s)]
print('   - deshabilitadas                    %5d  -> %d' % (n0-len(a), len(a)))
b = [s for s in a if str(s.get('id_internal') or '').strip()]
print('   - sin id_internal                   %5d  -> %d' % (len(a)-len(b), len(b)))
c = [s for s in b if str(s['id_internal']).strip() in plat]
print('   - no existen en la plataforma       %5d  -> %d' % (len(b)-len(c), len(c)))
d = [s for s in c if plat[str(s['index'] if False else s['id_internal']).strip()]['pais'] == 'COL']
print('   - pais distinto de COL              %5d  -> %d' % (len(c)-len(d), len(d)))

# cuantas NO son COL y de que pais
otros = collections.Counter(plat[str(s['id_internal']).strip()]['pais']
                            for s in c
                            if plat[str(s['id_internal']).strip()]['pais'] != 'COL')
print('   paises descartados: %s' % dict(otros))

# --- cosechas 2026 -----------------------------------------------------
print('\nCOSECHAS 2026 CON LA FECHA ACORDADA')
def cos(filas):
    k = collections.Counter()
    for s in filas:
        f = unif(s)
        if len(f) >= 7 and f[:7] >= '2026-01':
            k[f[:7]] += 1
    return k
tab = cos(d)          # el tablero: COL, sin deshabilitadas
sinPais = cos(c)      # lo mismo pero sin filtrar pais = lo que hace la vista
print('%-9s %10s %10s %8s' % ('cosecha', 'tablero', 'sin filtro pais', 'dif'))
tot = [0, 0]
for m in sorted(set(list(tab) + list(sinPais))):
    print('%-9s %10d %10d %8d' % (m, tab[m], sinPais[m], sinPais[m]-tab[m]))
    tot[0] += tab[m]; tot[1] += sinPais[m]
print('%-9s %10d %10d %8d' % ('TOTAL', tot[0], tot[1], tot[1]-tot[0]))

# --- el test que decide ------------------------------------------------
A = T('ACT_SEDE_MES')
act = collections.defaultdict(dict)
for x in A:
    u = str(x['id_sede']).strip(); m = str(x['mes'] or '')[:7]
    if u and len(m) == 7:
        act[u][m] = float(x['solicitudes'] or 0)
def off(a, b):
    return (int(b[:4])*12+int(b[5:7])) - (int(a[:4])*12+int(a[5:7]))
def test(nombre, fn):
    n = mal = 0
    for s in d:
        f = fn(s)
        if len(f) < 7 or f[:7] < '2026-01':
            continue
        n += 1
        u = str(s['id_internal']).strip()
        if any(off(f[:7], m) < 0 and v > 0 for m, v in act.get(u, {}).items()):
            mal += 1
    print('   %-30s %5d cosechas · %4d imposibles · %5.1f%%'
          % (nombre, n, mal, 100.0*mal/max(1, n)))
print('\nEL TEST QUE DECIDE (solicitudes antes de la propia cosecha)')
test('solo HubSpot', lambda s: str(s.get('fecha_creacion') or '')[:10])
test('solo vinculacion',
     lambda s: plat.get(str(s['id_internal']).strip(), {}).get('created', ''))
test('la ACORDADA (la mas temprana)', unif)

# --- salida de CS ------------------------------------------------------
print('\nSALIDA DE CS (fecha_salida_pipeline_cs -> columna salida_cs)')
con = [s for s in d if str(s.get('salida_cs') or '').strip()]
print('   %d de %d sedes del universo (%.1f%%)' % (len(con), len(d), 100*len(con)/len(d)))
porc = collections.Counter(str(s['salida_cs'])[:7] for s in con)
for m in sorted(porc):
    if m >= '2026-01':
        print('      sale en %s: %4d' % (m, porc[m]))
