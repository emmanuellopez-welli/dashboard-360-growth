# -*- coding: utf-8 -*-
"""
Replica la logica EXACTA de welli-data.data_ops.v_datos_hubspot.

No puedo leer la vista: se apoya en t_datos_creacion_hubspot, que es una
tabla EXTERNAL sobre Drive (el CSV del 4-sep), y consultarla exige scope de
Drive que este token no tiene. Pero la definicion de la vista si se puede
leer, asi que se reimplementa tal cual y se valida con los mismos datos.

La logica de la vista, copiada de INFORMATION_SCHEMA.VIEWS:

  FROM institucion_medica t1
  LEFT JOIN t_datos_creacion_hubspot t2 ON t1.id = t2.id_internal
  fecha_minima_admin_hubspot =
    si t1.created es null      -> fecha de hubspot
    si t2.fecha_creacion null  -> fecha del admin
    si admin <= hubspot        -> admin
    en otro caso               -> hubspot

Dos cosas que se revisan de esa definicion:
  · El JOIN arranca de institucion_medica, asi que una sede que existe en
    HubSpot y NO en la plataforma queda FUERA de la vista por completo.
  · La tabla de HubSpot es un CSV estatico: no se actualiza.
"""
import io
import json
import collections

import rq

LOC = 'us-central1'

# --- las dos fuentes, en vivo -----------------------------------------
print('leyendo institucion_medica (el t1 de la vista)...')
admin = {}
for r in rq.q("""
SELECT id, CAST(DATE(created) AS STRING) AS creada,
       country_code, nombre_comercial
FROM `welli-tecnologia.public.institucion_medica`
""", proy='welli-data', loc=LOC):
    k = str(r['id'] or '').strip()
    if k:
        admin[k] = {'creada': str(r['creada'] or ''),
                    'pais': str(r['country_code'] or ''),
                    'nombre': str(r['nombre_comercial'] or '')}
print('   %d cuentas de plataforma' % len(admin))

print('leyendo HubSpot (el t2 de la vista, que alla es el CSV)...')
hub = {}
for x in json.load(io.open('sedes_traspaso.json', encoding='utf8')):
    p = x.get('properties') or {}
    u = str(p.get('id_internal') or '').strip()
    f = str(p.get('hs_createdate') or '')[:10]
    if u and len(f) == 10:
        hub[u] = {'creada': f, 'nombre': str(p.get('nombre_sede') or ''),
                  'hs': str(x.get('id') or '')}
print('   %d fichas de HubSpot con id_internal' % len(hub))


def minima(a, h):
    """La misma cascada de CASE de la vista."""
    if not a and not h:
        return '', ''
    if not a:
        return h, 'hubspot'
    if not h:
        return a, 'admin'
    return (a, 'admin') if a <= h else (h, 'hubspot')


# --- la vista tal cual: LEFT JOIN desde el admin ----------------------
vista = {}
fuente = collections.Counter()
for k, a in admin.items():
    h = hub.get(k, {}).get('creada', '')
    f, src = minima(a['creada'], h)
    if f:
        vista[k] = f
        fuente[src] += 1
print('\nLA VISTA · %d filas (arranca de institucion_medica)' % len(vista))
print('   fecha que gana: %s' % dict(fuente))

# --- lo que la vista NO ve --------------------------------------------
solo_hs = [k for k in hub if k not in admin]
print('\nFUERA DE LA VISTA por el sentido del JOIN:')
print('   %d fichas de HubSpot cuyo id_internal no existe en '
      'institucion_medica' % len(solo_hs))
for k in solo_hs[:6]:
    print('      %-40s hs=%s creada %s'
          % (hub[k]['nombre'][:40], hub[k]['hs'], hub[k]['creada']))
# Y las que no tienen id_internal del todo no llegan ni al CSV.
sin_id = sum(1 for x in json.load(io.open('sedes_traspaso.json',
                                          encoding='utf8'))
             if not str((x.get('properties') or {}).get('id_internal')
                        or '').strip())
print('   %d fichas de HubSpot SIN id_internal: no llegan ni al CSV' % sin_id)

# --- contra mi calculo -------------------------------------------------
mio = {}
for k in set(list(admin) + list(hub)):
    f, _ = minima(admin.get(k, {}).get('creada', ''),
                  hub.get(k, {}).get('creada', ''))
    if f:
        mio[k] = f
comunes = set(vista) & set(mio)
c = collections.Counter()
for k in comunes:
    if vista[k] == mio[k]:
        c['idénticas'] += 1
    elif vista[k][:7] == mio[k][:7]:
        c['mismo mes'] += 1
    else:
        c['distinto MES'] += 1
print('\nCONTRA MI CALCULO · %d llaves en común' % len(comunes))
for k, v in c.most_common():
    print('   %6d  %s' % (v, k))

# --- el test que decide ------------------------------------------------
H = json.load(io.open('sheet_data.json', encoding='utf8'))
A = H['ACT_SEDE_MES']
ax = {c2: i for i, c2 in enumerate(A[0])}
act = collections.defaultdict(dict)
for x in A[1:]:
    u = str(x[ax['id_sede']]).strip()
    m = str(x[ax['mes']] or '')[:7]
    if u and len(m) == 7:
        act[u][m] = float(x[ax['solicitudes']] or 0)


def offs(a, b):
    return (int(b[:4]) * 12 + int(b[5:7])) - (int(a[:4]) * 12 + int(a[5:7]))


def test(nombre, fechas):
    n = mal = 0
    for u, f in fechas.items():
        if len(f) < 7 or f[:7] < '2026-01':
            continue
        n += 1
        if any(offs(f[:7], m) < 0 and v > 0
               for m, v in act.get(u, {}).items()):
            mal += 1
    print('   %-34s %5d cosechas · %4d imposibles · %5.1f%%'
          % (nombre, n, mal, 100.0 * mal / max(1, n)))


print('\nEL TEST QUE DECIDE · solicitudes ANTES de la propia cosecha')
test('hs_createdate solo', {k: v['creada'] for k, v in hub.items()})
test('admin solo', {k: v['creada'] for k, v in admin.items() if v['creada']})
test('LA VISTA (fecha_minima)', vista)

# --- cosechas ----------------------------------------------------------
print('\nCOSECHAS 2026')


def cos(f):
    c2 = collections.Counter()
    for v in f.values():
        if len(v) >= 7 and v[:7] >= '2026-01':
            c2[v[:7]] += 1
    return c2


# La vista sin filtrar y filtrada a COL, porque el conteo cambia y hay que
# saber cual de los dos se va a publicar.
vista_col = {k: v for k, v in vista.items()
             if admin.get(k, {}).get('pais') == 'COL'}
defs = [('vista (todo)', cos(vista)), ('vista solo COL', cos(vista_col)),
        ('mi tablero', cos({k: v for k, v in mio.items()
                            if admin.get(k, {}).get('pais') == 'COL'}))]
print('%-10s %s' % ('cosecha', ''.join('%16s' % d[0] for d in defs)))
tot = [0] * len(defs)
for m in sorted({m for _, c2 in defs for m in c2}):
    fila = ''
    for i, (_, c2) in enumerate(defs):
        fila += '%16d' % c2.get(m, 0)
        tot[i] += c2.get(m, 0)
    print('%-10s %s' % (m, fila))
print('%-10s %s' % ('TOTAL', ''.join('%16d' % t for t in tot)))
