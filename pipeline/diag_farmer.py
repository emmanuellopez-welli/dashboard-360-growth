# -*- coding: utf-8 -*-
"""
Por que el XLOOKUP de BI no encuentra mi cosecha para tantas sedes.

Su hoja Farmer cruza id_clinica (el UUID de la plataforma) contra mi Excel de
cosechas 2026. Cada #N/A tiene una causa distinta y hay que separarlas: unas
son reglas mias que hacen bien en excluir, otras son un bug real.

Fuentes que se cruzan:
  · su hoja Farmer
  · mi Excel (coh2026.json, las 1.456 que publique)
  · la hoja SEDES completa (3.603, antes de mis reglas)
  · PLATAFORMA_SEDES (institucion_medica)
"""
import io
import json
import collections

import openpyxl

XL = ('c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/'
      'Cosechas 2026 sedes tablero360 (2).xlsx')

# --- su hoja ------------------------------------------------------------
wb = openpyxl.load_workbook(XL, data_only=True)
h = wb['Farmer']
cab = [c.value for c in h[1]]
ci = {c: i for i, c in enumerate(cab) if c}
filas = []
for r in h.iter_rows(min_row=2, values_only=True):
    if not r or not r[ci['id_clinica']]:
        continue
    filas.append({
        'uuid': str(r[ci['id_clinica']]).strip(),
        'hs': str(r[ci['id_hubspot']] or '').strip(),
        'nombre': str(r[ci['nombre_comercial']] or '').strip(),
        'gerente': str(r[ci['Gerente']] or '').strip(),
        'vinc': str(r[ci['fecha_vinculacion']] or '')[:10],
        'mia': str(r[ci['Fecha emmanuel']] or '').strip(),
        'pipe': str(r[ci['pipeline_actual']] or '').strip(),
    })
print('hoja Farmer: %d filas con id_clinica' % len(filas))

# --- mis fuentes --------------------------------------------------------
mio = {x['id_interno']: x for x in
       json.load(io.open('coh2026.json', encoding='utf8'))}
H = json.load(io.open('sheet_data.json', encoding='utf8'))
S = H['SEDES']
sx = {c: i for i, c in enumerate(S[0])}
sedes_por_uuid, sedes_por_hs = {}, {}
for r in S[1:]:
    d = {c: r[i] for c, i in sx.items()}
    iid = str(d.get('id_internal') or '').strip()
    if iid:
        sedes_por_uuid[iid] = d
    sedes_por_hs[str(d.get('id') or '').strip()] = d
P = H['PLATAFORMA_SEDES']
px = {c: i for i, c in enumerate(P[0])}
plat = {str(r[px['id_sede']]).strip(): r[px['pais']] for r in P[1:]}

print('mi Excel: %d sedes | hoja SEDES: %d | plataforma: %d'
      % (len(mio), len(sedes_por_uuid), len(plat)))


def es_na(v):
    return v.upper().startswith('#N/A') or v in ('', 'None')


# --- diagnostico --------------------------------------------------------
causas = collections.Counter()
detalle = collections.defaultdict(list)

for f in filas:
    if not es_na(f['mia']):
        causas['CRUZO bien'] += 1
        continue
    u, hs = f['uuid'], f['hs']
    if u in mio:
        c = 'BUG DE ELLOS: el uuid SI esta en mi Excel'
    elif u in sedes_por_uuid:
        s = sedes_por_uuid[u]
        cos = str(s.get('cosecha') or '')[:7]
        pipe = str(s.get('pipeline') or '')
        if 'deshabilitad' in pipe.lower():
            c = 'REGLA MIA: sede deshabilitada'
        elif cos == '2025-10':
            c = 'REGLA MIA: cosecha 2025-10 (carga inicial de HubSpot)'
        elif cos and cos < '2026-01':
            c = 'REGLA MIA: cosecha anterior a 2026'
        elif u not in plat:
            c = 'REGLA MIA: no existe en la plataforma'
        elif plat.get(u) != 'COL':
            c = 'REGLA MIA: pais != COL'
        elif cos >= '2026-09':
            c = 'FUERA DE RANGO: cosecha 2026-09, posterior a mi Excel'
        else:
            c = 'SIN EXPLICAR (esta en SEDES y pasa mis reglas)'
    elif hs and hs in sedes_por_hs:
        c = 'BUG REAL: la sede esta en HubSpot pero SIN id_internal en mi hoja'
    else:
        c = 'NO ESTA en mi hoja SEDES (refresh viejo o sede nueva)'
    causas[c] += 1
    if len(detalle[c]) < 8:
        detalle[c].append(f)

print('\n=== POR QUE NO CRUZO (%d filas) ==='
      % (len(filas) - causas['CRUZO bien']))
for c, n in causas.most_common():
    print('   %5d  %s' % (n, c))

for c in causas:
    if c == 'CRUZO bien' or not detalle[c]:
        continue
    print('\n--- %s ---' % c)
    for f in detalle[c]:
        s = sedes_por_uuid.get(f['uuid']) or sedes_por_hs.get(f['hs']) or {}
        print('   %-36s vinc %s | mi cosecha %-8s | pipe %s'
              % (f['nombre'][:36], f['vinc'],
                 str(s.get('cosecha') or '-')[:7],
                 str(s.get('pipeline') or f['pipe'])[:22]))

json.dump({'filas': filas}, io.open('farmer.json', 'w', encoding='utf8'),
          ensure_ascii=False)
