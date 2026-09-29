# -*- coding: utf-8 -*-
"""Por que "Sedes exitosas" y "Salida de Customer Success" no cuadran.

La hipotesis del negocio: una sede sale de CS a Farmer CUANDO se vuelve
exitosa (3 solicitudes o 1 desembolso). Si eso es cier, los dos mapas
deberian moverse juntos. No lo hacen, y en las dos direcciones:
   cosecha 2026-02 M7: exitosas 111 (60,7%) · salida 42 (23,0%)
   cosecha 2026-05 M4: exitosas 101 (58,7%) · salida 149 (86,6%)

Se cruza sede por sede para ver de que esta hecha la diferencia."""
import io, json, collections
H = json.load(io.open('sheet_data.json', encoding='utf8'))
def T(n):
    v = H[n]; return [dict(zip(v[0], r)) for r in v[1:]]
def num(x):
    try: return float(x or 0)
    except Exception: return 0.0

S, P = T('SEDES'), T('PLATAFORMA_SEDES')
plat = {str(r['id_sede']).strip(): r for r in P if str(r['id_sede']).strip()}

def unif(s):
    iid = str(s.get('id_internal') or '').strip()
    fc = str(s.get('fecha_creacion') or '')[:10]
    fv = str(plat.get(iid, {}).get('created') or '')[:10]
    return min(fc, fv) if (fc and fv) else (fc or fv)

def deshab(s):
    return 'deshabilitad' in str(s.get('pipeline') or '').lower()

# el universo del tablero
base = []
for s in S:
    iid = str(s.get('id_internal') or '').strip()
    if not iid or deshab(s) or iid not in plat:
        continue
    if str(plat[iid].get('pais') or 'COL') != 'COL':
        continue
    base.append(s)
print('universo del tablero: %d sedes' % len(base))

# el estado acumulado por sede, del ultimo mes disponible
E = T('SEDE_ESTADO_MES')
ult = {}
for r in E:
    iid = str(r.get('id_sede') or '').strip()
    m = str(r.get('mes') or '')[:7]
    if not iid or len(m) != 7:
        continue
    if iid not in ult or m > ult[iid]['mes']:
        ult[iid] = {'mes': m, 'apps': num(r.get('apps_acum')),
                    'des': num(r.get('des_acum'))}

def exitosa(s):
    iid = str(s['id_internal']).strip()
    e = ult.get(iid)
    return bool(e and (e['apps'] >= 3 or e['des'] >= 1))

def salio(s):
    return bool(str(s.get('salida_cs') or '').strip())

def entroCS(s):
    return bool(str(s.get('cs_fecha_entrada') or '').strip())

# --- el cruce 2x2, por cosecha -----------------------------------------
print('\nCRUCE exitosa x salio de CS, por cosecha de 2026')
print('%-9s %5s | %7s %7s | %8s %8s %8s %8s'
      % ('cosecha', 'n', 'exitosa', 'salio', 'ambas', 'exi-NO', 'NOexi-sal', 'ninguna'))
tot = collections.Counter()
for m in sorted({unif(s)[:7] for s in base if unif(s)[:7] >= '2026-01'}):
    g = [s for s in base if unif(s)[:7] == m]
    a = sum(1 for s in g if exitosa(s) and salio(s))
    b = sum(1 for s in g if exitosa(s) and not salio(s))
    c = sum(1 for s in g if not exitosa(s) and salio(s))
    d = sum(1 for s in g if not exitosa(s) and not salio(s))
    print('%-9s %5d | %7d %7d | %8d %8d %8d %8d'
          % (m, len(g), a+b, a+c, a, b, c, d))
    tot['n'] += len(g); tot['a'] += a; tot['b'] += b
    tot['c'] += c; tot['d'] += d
print('%-9s %5d | %7d %7d | %8d %8d %8d %8d'
      % ('TOTAL', tot['n'], tot['a']+tot['b'], tot['a']+tot['c'],
         tot['a'], tot['b'], tot['c'], tot['d']))

# --- de que esta hecho el "exitosa pero NO salio" ----------------------
print('\nLAS %d QUE SON EXITOSAS Y NO TIENEN SALIDA: entraron a CS?' % tot['b'])
sub = [s for s in base if unif(s)[:7] >= '2026-01'
       and exitosa(s) and not salio(s)]
print('   entraron a CS y no salieron: %d' % sum(1 for s in sub if entroCS(s)))
print('   NUNCA entraron a CS:         %d' % sum(1 for s in sub if not entroCS(s)))
print('   -> las que nunca entraron NO PUEDEN salir: no es una discrepancia,')
print('      es que el mapa 5 mide un embudo por el que no pasaron.')

# --- y el "salio pero NO es exitosa" -----------------------------------
print('\nLAS %d QUE SALIERON DE CS SIN SER EXITOSAS' % tot['c'])
sub2 = [s for s in base if unif(s)[:7] >= '2026-01'
        and salio(s) and not exitosa(s)]
ap = collections.Counter()
for s in sub2:
    e = ult.get(str(s['id_internal']).strip()) or {'apps': 0, 'des': 0}
    if e['apps'] == 0: ap['0 solicitudes'] += 1
    elif e['apps'] < 3: ap['1 o 2 solicitudes'] += 1
    else: ap['3+ solicitudes'] += 1
print('   %s' % dict(ap))
print('   -> salir de CS NO es solo graduarse: tambien se sale por rendirse,')
print('      por reasignacion o por limpieza de pipeline.')

# --- cobertura de la propiedad en el universo --------------------------
print('\nCOBERTURA DE salida_cs EN EL UNIVERSO 2026')
g26 = [s for s in base if unif(s)[:7] >= '2026-01']
print('   sedes 2026: %d · con salida_cs: %d (%.1f%%) · entraron a CS: %d (%.1f%%)'
      % (len(g26), sum(1 for s in g26 if salio(s)),
         100*sum(1 for s in g26 if salio(s))/len(g26),
         sum(1 for s in g26 if entroCS(s)),
         100*sum(1 for s in g26 if entroCS(s))/len(g26)))
print('\n   por cosecha: %-8s %6s %8s %8s' % ('mes', 'n', 'entroCS', 'salio'))
for m in sorted({unif(s)[:7] for s in g26}):
    g = [s for s in base if unif(s)[:7] == m]
    print('                %-8s %6d %7d%% %7d%%'
          % (m, len(g), round(100*sum(1 for s in g if entroCS(s))/len(g)),
             round(100*sum(1 for s in g if salio(s))/len(g))))
