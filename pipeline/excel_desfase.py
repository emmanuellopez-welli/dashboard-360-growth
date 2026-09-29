# -*- coding: utf-8 -*-
"""
Excel con TODAS las sedes cuya cosecha cae en un mes distinto segun el reloj.

Nuestra fecha = hs_createdate (cuando se creo la ficha en HubSpot).
Su fecha      = institucion_medica.created (fecha_vinculacion).

Dos direcciones, y son fenomenos distintos:
  · vinculada ANTES de crear la ficha  -> la ficha llego tarde. En enero, 41
    de 56 se crearon el 16-ene-2026 a las 17:44, todas a la misma hora: fue
    una carga masiva de sedes vinculadas entre oct y dic de 2025.
  · vinculada DESPUES de crear la ficha -> flujo normal: el prospecto entra
    al CRM y se vincula despues (mediana 14 dias).
"""
import io
import json
import datetime
import collections

import openpyxl
import xlsxwriter

SALIDA = ('c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/'
          'Desfase_cosechas_HubSpot_vs_vinculacion.xlsx')
MESES = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06',
         '2026-07', '2026-08']

H = json.load(io.open('sheet_data.json', encoding='utf8'))
S = H['SEDES']
sx = {c: i for i, c in enumerate(S[0])}
P = H['PLATAFORMA_SEDES']
px = {c: i for i, c in enumerate(P[0])}
plat = {str(r[px['id_sede']]).strip():
        {'pais': str(r[px['pais']] or 'COL'),
         'vinc': str(r[px['created']] or '')[:10],
         'esp': str(r[px['especialidad']] or '')} for r in P[1:]}

crea = {}
for x in json.load(io.open('sedes_traspaso.json', encoding='utf8')):
    p = x.get('properties') or {}
    u = str(p.get('id_internal') or '').strip()
    if u:
        crea[u] = str(p.get('hs_createdate') or '')

XL = ('c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/'
      'Cosechas 2026 sedes tablero360 (2).xlsx')
hf = openpyxl.load_workbook(XL, data_only=True)['Farmer']
cab = [c.value for c in hf[1]]
ci = {c: i for i, c in enumerate(cab) if c}
ger = {}
for r in hf.iter_rows(min_row=2, values_only=True):
    u = str(r[ci['id_clinica']] or '').strip()
    if u:
        ger[u] = {'gerente': str(r[ci['Gerente']] or ''),
                  'tipo': str(r[ci['tipo_vinculacion']] or ''),
                  'nombre': str(r[ci['nombre_comercial']] or '')}


def d(s):
    try:
        return datetime.date(*map(int, str(s)[:10].split('-')))
    except Exception:
        return None


filas = []
for r in S[1:]:
    desh = 'deshabilitad' in str(r[sx['pipeline']] or '').lower()
    u = str(r[sx['id_internal']] or '').strip()
    if not u or u not in plat or plat[u]['pais'] != 'COL':
        continue
    cd = crea.get(u, '')
    fc, fv = d(cd), d(plat[u]['vinc'])
    if not fc or not fv:
        continue
    mc, mv = fc.strftime('%Y-%m'), fv.strftime('%Y-%m')
    if mc == mv:
        continue
    # entra si CUALQUIERA de los dos meses es del 2026 que nos interesa
    if mc not in MESES and mv not in MESES:
        continue
    dias = (fc - fv).days
    filas.append({
        'cos_hs': mc, 'cos_vi': mv,
        'nombre': str(r[sx['nombre_sede']] or '') or ger.get(u, {}).get('nombre', ''),
        'id_hs': str(r[sx['id']] or ''), 'uuid': u,
        'f_creada': cd[:16].replace('T', ' '),
        'f_vinc': plat[u]['vinc'],
        'dias': dias,
        'dir': 'Vinculada ANTES de crear la ficha' if dias > 0
               else 'Vinculada DESPUÉS de crear la ficha',
        'lote': 'Sí · carga del 16-ene-2026 17:44' if cd[:16] == '2026-01-16T17:44'
                else '',
        'origen': str(r[sx['origen']] or '') or '(sin origen)',
        'esp': plat[u]['esp'],
        'gerente': ger.get(u, {}).get('gerente', ''),
        'tipo': ger.get(u, {}).get('tipo', ''),
        'desh': 'Sí' if desh else 'No',
    })

filas.sort(key=lambda x: (x['cos_hs'], -abs(x['dias']), x['nombre'].lower()))
print('%d sedes con desfase de mes' % len(filas))

# ------------------------------------------------------------------ Excel
wb = xlsxwriter.Workbook(SALIDA)
INK2, BORDE = '#5C574C', '#E7E3D8'
fTit = wb.add_format({'bold': True, 'font_size': 16})
fSub = wb.add_format({'font_size': 10, 'font_color': INK2,
                      'text_wrap': True, 'valign': 'top'})
fCab = wb.add_format({'bold': True, 'font_size': 9, 'font_color': 'white',
                      'bg_color': '#3A3833', 'text_wrap': True,
                      'valign': 'vcenter', 'border': 1,
                      'border_color': '#3A3833'})
fT = wb.add_format({'font_size': 10, 'border': 1, 'border_color': BORDE})
fTB = wb.add_format({'font_size': 10, 'bold': True, 'border': 1,
                     'border_color': BORDE})
fN = wb.add_format({'font_size': 10, 'num_format': '#,##0', 'border': 1,
                    'border_color': BORDE})
fAntes = wb.add_format({'font_size': 10, 'border': 1, 'border_color': BORDE,
                        'bg_color': '#FDECEC', 'num_format': '#,##0'})
fDesp = wb.add_format({'font_size': 10, 'border': 1, 'border_color': BORDE,
                       'bg_color': '#E8F5EC', 'num_format': '#,##0'})
fLote = wb.add_format({'font_size': 10, 'border': 1, 'border_color': BORDE,
                       'bg_color': '#FFF3CD', 'bold': True})
fNota = wb.add_format({'font_size': 10, 'text_wrap': True, 'valign': 'top',
                       'font_color': INK2})
fNotaT = wb.add_format({'bold': True, 'font_size': 11})

# ---- 1 resumen ----------------------------------------------------------
h1 = wb.add_worksheet('1 Resumen')
h1.hide_gridlines(2)
h1.write('A1', 'Sedes cuya cosecha cambia según el reloj', fTit)
h1.merge_range('A2:H4',
    'Nuestra fecha es hs_createdate: cuándo se creó la ficha en HubSpot. La '
    'de BI es institucion_medica.created (fecha_vinculacion): cuándo la sede '
    'quedó habilitada para operar. Cuando los dos eventos caen en meses '
    'distintos, la misma sede aparece en cosechas distintas — y ninguno de '
    'los dos números está mal. La causa principal en enero es una CARGA '
    'MASIVA: 41 fichas creadas el 16-ene-2026 a las 17:44, todas a la misma '
    'hora, de sedes vinculadas entre octubre y diciembre de 2025.', fSub)
for i in range(1, 4):
    h1.set_row(i, 20)
for i, w in enumerate([13, 13, 11, 13, 13, 13, 13, 13]):
    h1.set_column(i, i, w)
cabs = ['Nuestra cosecha', 'Con desfase', 'de los cuales', 'vinculada antes',
        'vinculada después', 'de la carga masiva', 'mediana días',
        'máx días']
for c, t in enumerate(cabs):
    h1.write(5, c, t, fCab)
h1.set_row(5, 32)
fila = 6
por = collections.defaultdict(list)
for x in filas:
    por[x['cos_hs']].append(x)
for m in sorted(por):
    L = por[m]
    a = [x for x in L if x['dias'] > 0]
    b = [x for x in L if x['dias'] < 0]
    lote = sum(1 for x in L if x['lote'])
    ds = sorted(abs(x['dias']) for x in L)
    h1.write(fila, 0, m, fTB)
    h1.write_number(fila, 1, len(L), fN)
    h1.write(fila, 2, '', fT)
    h1.write_number(fila, 3, len(a), fAntes)
    h1.write_number(fila, 4, len(b), fDesp)
    h1.write_number(fila, 5, lote, fLote if lote else fN)
    h1.write_number(fila, 6, ds[len(ds) // 2] if ds else 0, fN)
    h1.write_number(fila, 7, ds[-1] if ds else 0, fN)
    fila += 1

fila += 2
h1.write(fila, 0, 'Cómo se lee', fNotaT)
fila += 1
for t in ['"Vinculada antes" = la ficha de HubSpot se creó después de que la '
          'sede ya operaba. La cosecha nuestra queda más tarde que la suya.',
          '"Vinculada después" = flujo normal del pipeline: el prospecto '
          'entra al CRM y se vincula semanas más tarde. Mediana 14 días.',
          'Cuando el proceso corre bien las dos fechas quedan a 2 días '
          '(mediana de las 97 de enero que sí coinciden), y 26 de ellas se '
          'crearon el mismo día de la vinculación.',
          'El desfase se derrite con el tiempo: 83 sedes en enero, 12 en '
          'julio. En 2025 las clínicas se vinculaban primero y entraban al '
          'CRM después; desde marzo los dos eventos ocurren casi juntos.']:
    h1.merge_range(fila, 0, fila, 7, t, fNota)
    h1.set_row(fila, 26)
    fila += 1

# ---- 2 detalle ----------------------------------------------------------
h2 = wb.add_worksheet('2 Detalle sede por sede')
h2.hide_gridlines(2)
cols = [('Nuestra cosecha', 'cos_hs', 14), ('Su cosecha', 'cos_vi', 12),
        ('Sede', 'nombre', 44),
        ('Nuestra fecha · creación en HubSpot', 'f_creada', 26),
        ('Su fecha · vinculación', 'f_vinc', 18),
        ('Días de desfase', 'dias', 13),
        ('Dirección', 'dir', 30),
        ('¿De la carga masiva?', 'lote', 26),
        ('Origen', 'origen', 15), ('Especialidad', 'esp', 20),
        ('Gerente', 'gerente', 18), ('tipo_vinculacion', 'tipo', 15),
        ('Deshabilitada', 'desh', 12),
        ('id HubSpot', 'id_hs', 14), ('id_clinica', 'uuid', 38)]
for c, (t, _k, w) in enumerate(cols):
    h2.set_column(c, c, w)
    h2.write(0, c, t, fCab)
h2.set_row(0, 34)
for i, x in enumerate(filas, start=1):
    for c, (_t, k, _w) in enumerate(cols):
        v = x[k]
        if k == 'dias':
            h2.write_number(i, c, v, fAntes if v > 0 else fDesp)
        elif k == 'lote' and v:
            h2.write(i, c, v, fLote)
        elif k == 'nombre':
            h2.write(i, c, v or '—', fTB)
        else:
            h2.write(i, c, v if v else '—', fT)
h2.autofilter(0, 0, len(filas), len(cols) - 1)
h2.freeze_panes(1, 3)

# ---- 3 la carga masiva --------------------------------------------------
lote = [x for x in filas if x['lote']]
h3 = wb.add_worksheet('3 La carga del 16-ene')
h3.hide_gridlines(2)
h3.write('A1', 'La carga masiva del 16 de enero de 2026, 17:44', fTit)
h3.merge_range('A2:F3',
    'Estas %d fichas se crearon en HubSpot el mismo día a la misma hora. '
    'Sus sedes ya estaban vinculadas y operando desde octubre, noviembre o '
    'diciembre de 2025 — hasta 97 días antes. Es la causa principal de que '
    'nuestra cosecha de enero (173) sea más grande que la suya (122).'
    % len(lote), fSub)
h3.set_row(1, 20); h3.set_row(2, 20)
for i, w in enumerate([44, 20, 18, 13, 15, 20]):
    h3.set_column(i, i, w)
for c, t in enumerate(['Sede', 'Creada en HubSpot', 'Vinculada',
                       'Días antes', 'Origen', 'Especialidad']):
    h3.write(4, c, t, fCab)
for i, x in enumerate(sorted(lote, key=lambda r: -r['dias']), start=5):
    h3.write(i, 0, x['nombre'] or '—', fTB)
    h3.write(i, 1, x['f_creada'], fT)
    h3.write(i, 2, x['f_vinc'], fT)
    h3.write_number(i, 3, x['dias'], fAntes)
    h3.write(i, 4, x['origen'], fT)
    h3.write(i, 5, x['esp'] or '—', fT)
h3.autofilter(4, 0, 4 + len(lote), 5)

wb.close()
print('escrito ' + SALIDA)
print('  hoja 2: %d sedes' % len(filas))
print('  hoja 3: %d de la carga masiva' % len(lote))
print()
print('%-10s %6s %8s %9s %7s' % ('cosecha', 'total', 'antes', 'despues', 'lote'))
for m in sorted(por):
    L = por[m]
    print('%-10s %6d %8d %9d %7d'
          % (m, len(L), sum(1 for x in L if x['dias'] > 0),
             sum(1 for x in L if x['dias'] < 0),
             sum(1 for x in L if x['lote'])))
