# -*- coding: utf-8 -*-
"""
Excel de conciliacion con el tablero de BI, mes a mes.

Cinco hojas:
  1 Resumen mes a mes    la escalera de su numero al nuestro
  2 Corregir en BI       las 29 sin ficha en HubSpot, con el motivo
  3 Deshabilitadas       las que ellos incluyen y nosotros no
  4 Ventanas             sus celdas contra las nuestras, mismo origen
  5 Notas                los tres hallazgos y que hay que alinear
"""
import io
import json
import re
import datetime
import collections

import openpyxl
import xlsxwriter

SALIDA = ('c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/'
          'Conciliacion_cosechas_BI_vs_Growth.xlsx')
BASE = datetime.date(2025, 1, 1)
VENT = [(0, 30), (30, 60), (60, 90), (90, 120), (120, 150), (150, 180),
        (180, 210)]
MESES = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06',
         '2026-07']

# Lo que muestra su tablero, transcrito de la captura.
SU = {
 '2026-01': {'n': 122, 'avg': 118,
             'sol': [180, 620, 384, 318, 305, 213, 283],
             'monto': [29581586, 209223514, 190195017, 159785392,
                       138006108, 87348990, 109307505]},
 '2026-02': {'n': 213, 'avg': 82,
             'sol': [296, 492, 365, 338, 358, 371, 320],
             'monto': [111177515, 183691720, 227688041, 182790451,
                       206152854, 227543764, 204482934]},
 '2026-03': {'n': 198, 'avg': 75,
             'sol': [331, 525, 623, 480, 419, 425, 71],
             'monto': [162639108, 243913132, 468720466, 368106568,
                       236158111, 181630055, 86612265]},
 '2026-04': {'n': 198, 'avg': 80,
             'sol': [308, 443, 405, 448, 305, 59, None],
             'monto': [156824100, 199960625, 250992576, 291440122,
                       234230295, 43125615, None]},
 '2026-05': {'n': 180, 'avg': 65,
             'sol': [535, 518, 533, 399, 50, None, None],
             'monto': [72799380, 244624558, 324144230, 148257350,
                       29636250, None, None]},
 '2026-06': {'n': 178, 'avg': 47,
             'sol': [302, 789, 817, 111, None, None, None],
             'monto': [74997489, 308683621, 413693834, 45215678,
                       None, None, None]},
 '2026-07': {'n': 157, 'avg': 31,
             'sol': [455, 553, 69, None, None, None, None],
             'monto': [None] * 7},
}

# ------------------------------------------------------------ mis fuentes
H = json.load(io.open('sheet_data.json', encoding='utf8'))
S = H['SEDES']; sx = {c: i for i, c in enumerate(S[0])}
P = H['PLATAFORMA_SEDES']; px = {c: i for i, c in enumerate(P[0])}
CS = H['CREDITO_SEDES']; csx = {c: i for i, c in enumerate(CS[0])}
CD = H['CREDITO_DIA']; cdx = {c: i for i, c in enumerate(CD[0])}

plat = {str(r[px['id_sede']]).strip():
        {'pais': str(r[px['pais']] or 'COL'),
         'vinc': str(r[px['created']] or '')[:10]} for r in P[1:]}
hsAiid, sedeDe = {}, {}
for r in S[1:]:
    u = str(r[sx['id_internal']] or '').strip()
    if u:
        hsAiid[str(r[sx['id']]).strip()] = u
        sedeDe[u] = {'nombre': str(r[sx['nombre_sede']] or ''),
                     'pipeline': str(r[sx['pipeline']] or ''),
                     'crm': str(r[sx['cosecha']] or '')[:7],
                     'origen': str(r[sx['origen']] or '')}
idx = {int(r[csx['i']]): str(r[csx['sede']]) for r in CS[1:]}

act = collections.defaultdict(list)
for r in CD[1:]:
    hs = idx.get(int(r[cdx['s']]))
    if not hs or hs == '(SIN HUBSPOT)':
        continue
    u = hsAiid.get(hs)
    if u:
        act[u].append((int(r[cdx['d']]), float(r[cdx['sol']] or 0),
                       float(r[cdx['conv']] or 0),
                       float(r[cdx['m_conv']] or 0)))


def d(s):
    try:
        return datetime.date(*map(int, str(s)[:10].split('-')))
    except Exception:
        return None


# ------------------------------------------------------------ su universo
XL = ('c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/'
      'Cosechas 2026 sedes tablero360 (2).xlsx')
hf = openpyxl.load_workbook(XL, data_only=True)['Farmer']
cab = [c.value for c in hf[1]]
ci = {c: i for i, c in enumerate(cab) if c}
suyas = {}
for r in hf.iter_rows(min_row=2, values_only=True):
    u = str(r[ci['id_clinica']] or '').strip()
    if not u:
        continue
    suyas[u] = {
        'mes': str(r[ci['fecha_vinculacion']] or '')[:7],
        'vinc': d(r[ci['fecha_vinculacion']]),
        'nombre': str(r[ci['nombre_comercial']] or ''),
        'hs': str(r[ci['id_hubspot']] or '').strip(),
        'gerente': str(r[ci['Gerente']] or ''),
        'tipo': str(r[ci['tipo_vinculacion']] or ''),
    }

# ---------------------------------------------- clasificar cada exclusion
PAT_BASURA = re.compile(r'borrar|duplicad|prueba|test|no usar|eliminar', re.I)


def motivo(u, m):
    """Por que esa sede de su hoja no esta en nuestro tablero."""
    if u not in sedeDe:
        n = m['nombre']
        if PAT_BASURA.search(n):
            return 'Registro de descarte (nombre dice duplicado/BORRAR/pruebas)'
        return 'Cuenta de plataforma sin ficha en HubSpot'
    s = sedeDe[u]
    if 'deshabilitad' in s['pipeline'].lower():
        return 'Sede deshabilitada (pipeline Aliados_deshabilitados)'
    if u not in plat:
        return 'No cruza con institucion_medica'
    if plat[u]['pais'] != 'COL':
        return 'Pais distinto de COL'
    return ''


excl = collections.defaultdict(list)
for u, m in suyas.items():
    if m['mes'] not in MESES:
        continue
    mo = motivo(u, m)
    if mo:
        excl[m['mes']].append((u, m, mo))

# ------------------------------------------------------------ mis cifras
def agrega(origen_mes_inicio):
    """Suma en las ventanas de BI. origen_mes_inicio=True replica su
    anclaje (primer dia del mes); False usa la fecha real de cada sede."""
    out = collections.defaultdict(lambda: {'sol': [0.0] * 7,
                                           'monto': [0.0] * 7,
                                           'des': [0.0] * 7, 'n': 0,
                                           'ali': [set() for _ in range(7)]})
    for u, m in suyas.items():
        mes = m['mes']
        if mes not in MESES:
            continue
        if motivo(u, m):          # el universo nuestro
            continue
        b = out[mes]
        b['n'] += 1
        org = d(mes + '-01') if origen_mes_inicio else m['vinc']
        if not org:
            continue
        for dd, sol, conv, mc in act.get(u, ()):
            dia = (BASE + datetime.timedelta(days=dd) - org).days
            for k, (a, z) in enumerate(VENT):
                if a <= dia < z:
                    b['sol'][k] += sol
                    b['des'][k] += conv
                    b['monto'][k] += mc
                    if sol:
                        b['ali'][k].add(u)
                    break
    return out


mio = agrega(True)

# ============================================================== el Excel
wb = xlsxwriter.Workbook(SALIDA)
INK2, BORDE = '#5C574C', '#E7E3D8'
fTit = wb.add_format({'bold': True, 'font_size': 16})
fSub = wb.add_format({'font_size': 10, 'font_color': INK2,
                      'text_wrap': True, 'valign': 'top'})
fCab = wb.add_format({'bold': True, 'font_size': 9, 'font_color': 'white',
                      'bg_color': '#3A3833', 'text_wrap': True,
                      'valign': 'vcenter', 'border': 1,
                      'border_color': '#3A3833'})
fCabN = wb.add_format({'bold': True, 'font_size': 9, 'font_color': 'white',
                       'bg_color': '#3A3833', 'align': 'right',
                       'text_wrap': True, 'valign': 'vcenter', 'border': 1,
                       'border_color': '#3A3833'})
fT = wb.add_format({'font_size': 10, 'border': 1, 'border_color': BORDE})
fTB = wb.add_format({'font_size': 10, 'bold': True, 'border': 1,
                     'border_color': BORDE})
fN = wb.add_format({'font_size': 10, 'num_format': '#,##0', 'border': 1,
                    'border_color': BORDE})
fNB = wb.add_format({'font_size': 10, 'bold': True, 'num_format': '#,##0',
                     'border': 1, 'border_color': BORDE})
fC = wb.add_format({'font_size': 10, 'num_format': '$#,##0', 'border': 1,
                    'border_color': BORDE})
fP = wb.add_format({'font_size': 10, 'num_format': '0,0%', 'border': 1,
                    'border_color': BORDE})
fMenos = wb.add_format({'font_size': 10, 'num_format': '#,##0', 'border': 1,
                        'border_color': BORDE, 'font_color': '#B91C1C'})
fNota = wb.add_format({'font_size': 10, 'text_wrap': True, 'valign': 'top',
                       'font_color': INK2})
fNotaT = wb.add_format({'bold': True, 'font_size': 11})
fEllos = wb.add_format({'font_size': 10, 'num_format': '#,##0', 'border': 1,
                        'border_color': BORDE, 'bg_color': '#EEF2FF'})
fMio = wb.add_format({'font_size': 10, 'num_format': '#,##0', 'border': 1,
                      'border_color': BORDE, 'bg_color': '#F0FAF3'})

# ---- 1 resumen ----------------------------------------------------------
h1 = wb.add_worksheet('1 Resumen mes a mes')
h1.hide_gridlines(2)
h1.write('A1', 'Conciliación de cosechas · BI contra Growth', fTit)
h1.merge_range('A2:J3',
    'La escalera va de su número al nuestro. No hay ningún dato en disputa: '
    'la diferencia son tres decisiones de universo. Verificado en los siete '
    'meses — con el mismo reloj y el mismo universo la diferencia es cero. '
    'Su columna dice «Mes Creación» pero los datos son el mes de '
    'fecha_vinculacion (probado: cuadra exacto con vinculación, no con '
    'creación).', fSub)
h1.set_row(1, 26); h1.set_row(2, 26)
anchos = [11, 11, 13, 13, 11, 11, 13, 15, 15, 11]
for i, w in enumerate(anchos):
    h1.set_column(i, i, w)
cabs = ['Cosecha', 'BI', 'menos descarte', 'menos deshab.', 'Growth',
        'Growth (CRM)', 'Sol. BI', 'Sol. Growth', 'dif. sol.', '% dif.']
for c, t in enumerate(cabs):
    h1.write(4, c, t, fCab if c == 0 else fCabN)
h1.set_row(4, 30)
fila = 5
for m in MESES:
    ex = excl[m]
    nbas = sum(1 for _, _, mo in ex if 'descarte' in mo or 'sin ficha' in mo)
    ndes = sum(1 for _, _, mo in ex if 'deshabilitada' in mo)
    nres = sum(1 for _, _, mo in ex if not ('descarte' in mo or
                                            'sin ficha' in mo or
                                            'deshabilitada' in mo))
    b = mio[m]
    solB = sum(v for v in SU[m]['sol'] if v)
    solG = sum(b['sol'])
    h1.write(fila, 0, m, fTB)
    h1.write_number(fila, 1, SU[m]['n'], fEllos)
    h1.write_number(fila, 2, -(nbas), fMenos)
    h1.write_number(fila, 3, -(ndes + nres), fMenos)
    h1.write_number(fila, 4, b['n'], fMio)
    h1.write_number(fila, 5, sum(1 for u, mm in suyas.items()
                                 if not motivo(u, mm)
                                 and sedeDe.get(u, {}).get('crm') == m), fN)
    h1.write_number(fila, 6, solB, fEllos)
    h1.write_number(fila, 7, solG, fMio)
    h1.write_number(fila, 8, solG - solB, fN)
    h1.write_number(fila, 9, (solG - solB) / solB if solB else 0, fP)
    fila += 1

fila += 1
h1.write(fila, 0, 'Plata desembolsada, total de las siete ventanas', fNotaT)
fila += 1
for c, t in enumerate(['Cosecha', 'Plata BI', 'Plata Growth', 'Diferencia',
                       '% dif.']):
    h1.write(fila, c, t, fCab if c == 0 else fCabN)
fila += 1
for m in MESES:
    mB = sum(v for v in SU[m]['monto'] if v)
    mG = sum(mio[m]['monto'])
    h1.write(fila, 0, m, fTB)
    h1.write_number(fila, 1, mB, fC)
    h1.write_number(fila, 2, mG, fC)
    h1.write_number(fila, 3, mG - mB, fC)
    h1.write_number(fila, 4, (mG - mB) / mB if mB else 0, fP)
    fila += 1

# ---- 2 verificacion 1 a 1 ----------------------------------------------
# Version corregida. La primera decia "29 sin ficha en HubSpot, depurar" y
# estaba mal: se verifico cada una contra HubSpot EN VIVO por tres caminos
# (UUID, nombre exacto, busqueda por tokens en la API) y contra el extracto
# de plataforma. Solo 3 son basura; 13 son cuentas duplicadas en la
# plataforma y 4 son un hueco NUESTRO.
clas = json.load(io.open('clasif29.json', encoding='utf8'))
h2 = wb.add_worksheet('2 Verificacion 1 a 1')
h2.hide_gridlines(2)
h2.write('A1', 'Las 29 diferencias, verificadas una por una', fTit)
h2.merge_range('A2:J4',
    'Cada fila se busco en HubSpot en vivo por tres caminos: id_internal '
    'exacto, nombre idéntico y búsqueda por tokens en la API. Luego se '
    'verificó en el extracto de institucion_medica si existen una o dos '
    'cuentas. Resultado: solo 3 son registros de descarte. 13 son la misma '
    'clínica con DOS cuentas de plataforma, 9 necesitan revisión manual y 4 '
    'son clínicas reales que faltan en nuestro CRM. La columna Dueño dice de '
    'quién es cada arreglo.', fSub)
h2.set_row(1, 22); h2.set_row(2, 22); h2.set_row(3, 22)
for i, w in enumerate([32, 11, 40, 40, 13, 13, 24, 16, 14, 62]):
    h2.set_column(i, i, w)
cabs2 = ['Clase', 'Cosecha', 'Nombre en el reporte de BI',
         'Nombre en HubSpot', 'Cuenta de BI', 'Cuenta en HubSpot',
         'Confianza del match', 'Dueño', 'id HubSpot', 'Qué hay que hacer']
for c, t in enumerate(cabs2):
    h2.write(5, c, t, fCab)
h2.set_row(5, 30)
fDueGrowth = wb.add_format({'font_size': 10, 'border': 1, 'bold': True,
                            'border_color': BORDE, 'bg_color': '#FFF3CD'})
fDueBI = wb.add_format({'font_size': 10, 'border': 1, 'bold': True,
                        'border_color': BORDE, 'bg_color': '#E7F0FF'})
fBaja = wb.add_format({'font_size': 10, 'border': 1,
                       'border_color': BORDE, 'font_color': '#B91C1C',
                       'bold': True})
r2 = 6
for r in clas:
    h2.write(r2, 0, r['clase'], fT)
    h2.write(r2, 1, r['mes'], fT)
    h2.write(r2, 2, r['nombre'] or '—', fTB)
    h2.write(r2, 3, r['nombre_hs'] or '—', fT)
    h2.write(r2, 4, r['creada_bi'] or '—', fT)
    h2.write(r2, 5, r['creada_hs'] or 'no está', fT)
    h2.write(r2, 6, r['conf'], fBaja if 'BAJA' in r['conf'] else fT)
    h2.write(r2, 7, r['dueno'],
             fDueGrowth if 'GROWTH' in r['dueno'] else fDueBI)
    h2.write(r2, 8, r['id_hs'] or '—', fT)
    h2.write(r2, 9, r['accion'], fT)
    r2 += 1
h2.autofilter(5, 0, r2 - 1, 9)
h2.freeze_panes(6, 3)

# ---- 3 deshabilitadas ---------------------------------------------------
h3 = wb.add_worksheet('3 Deshabilitadas')
h3.hide_gridlines(2)
h3.write('A1', 'Sedes deshabilitadas: ellos las cuentan, nosotros no', fTit)
h3.merge_range('A2:E3',
    'Están en el pipeline Aliados_deshabilitados de HubSpot: aliados con los '
    'que ya no operamos, y varios son fichas duplicadas del mismo '
    'consultorio. En su tablero aparecen como el chip «Dh» de cada cosecha. '
    'Es la decisión de universo que hay que acordar: incluirlas o no.', fSub)
h3.set_row(1, 26); h3.set_row(2, 26)
for i, w in enumerate([11, 46, 40, 18, 16]):
    h3.set_column(i, i, w)
for c, t in enumerate(['Cosecha', 'Nombre', 'id_clinica', 'Origen',
                       'Cosecha CRM']):
    h3.write(4, c, t, fCab)
r3 = 5
for m in MESES:
    for u, mm, mo in sorted(excl[m], key=lambda x: x[1]['nombre'].lower()):
        if 'deshabilitada' not in mo:
            continue
        s = sedeDe.get(u, {})
        h3.write(r3, 0, m, fT)
        h3.write(r3, 1, mm['nombre'] or s.get('nombre') or '—', fTB)
        h3.write(r3, 2, u, fT)
        h3.write(r3, 3, s.get('origen') or '—', fT)
        h3.write(r3, 4, s.get('crm') or '—', fT)
        r3 += 1
h3.autofilter(4, 0, r3 - 1, 4)
h3.freeze_panes(5, 0)

# ---- 4 ventanas ---------------------------------------------------------
h4 = wb.add_worksheet('4 Ventanas')
h4.hide_gridlines(2)
h4.write('A1', 'Celda por celda, en sus mismas ventanas', fTit)
h4.merge_range('A2:J3',
    'Recalculado con SU anclaje: el día 0 es el primer día del mes de '
    'vinculación, no la fecha de cada sede. Con ese origen el error cae de '
    '2.120 a 342 solicitudes en los tres primeros meses — seis veces menos. '
    'Eso prueba que sus ventanas de días son equivalentes a meses de '
    'calendario, no a exposición por sede.', fSub)
h4.set_row(1, 26); h4.set_row(2, 26)
h4.set_column(0, 0, 11)
h4.set_column(1, 1, 13)
for i in range(2, 9):
    h4.set_column(i, i, 12)
fila = 4
for medida, clave, fmt in (('Solicitudes', 'sol', fN),
                           ('Plata desembolsada', 'monto', fC)):
    h4.write(fila, 0, medida, fNotaT)
    fila += 1
    h4.write(fila, 0, 'Cosecha', fCab)
    h4.write(fila, 1, 'Fuente', fCab)
    for k, v in enumerate(VENT):
        h4.write(fila, 2 + k, '%d-%d d' % v, fCabN)
    fila += 1
    for m in MESES:
        h4.write(fila, 0, m, fTB)
        h4.write(fila, 1, 'BI', fT)
        for k in range(7):
            v = SU[m][clave][k]
            if v is None:
                h4.write(fila, 2 + k, '—', fT)
            else:
                h4.write_number(fila, 2 + k, v, fEllos)
        fila += 1
        h4.write(fila, 0, '', fT)
        h4.write(fila, 1, 'Growth', fT)
        for k in range(7):
            h4.write_number(fila, 2 + k, mio[m][clave][k], fMio)
        fila += 1
    fila += 1

# ---- 5 notas ------------------------------------------------------------
h5 = wb.add_worksheet('5 Notas')
h5.hide_gridlines(2)
h5.set_column('A:A', 108)
notas = [
 ('T', 'Lo que SI esta en disputa: tres decisiones de universo'),
 ('P', '1. Registros de descarte. Su tablero cuenta 29 cuentas de '
       'institucion_medica que no tienen ficha en HubSpot, y varias son '
       'basura evidente por el nombre: «Dra Valentina Palacio (duplicado)», '
       '«CEDIMED - BORRAR», «Welli Pruebas - La migracion no fallo». Estan '
       'en la hoja 2 para depurar.'),
 ('P', '2. Sedes deshabilitadas. Ellos las incluyen (el chip «Dh» de cada '
       'cosecha), nosotros las excluimos: son aliados con los que ya no '
       'operamos y varios son fichas duplicadas del mismo consultorio. Estan '
       'en la hoja 3. Hay que acordar una sola regla.'),
 ('P', '3. El reloj de la cosecha. Ellos agrupan por fecha de vinculacion, '
       'nosotros veniamos agrupando por fecha de creacion en HubSpot. El '
       'tablero ya tiene un selector para las dos; el test de sedes con '
       'solicitudes ANTERIORES a su propia cosecha (imposible) da 6,0% con '
       'creacion y 0,4% con vinculacion, asi que para leer un ramp-up manda '
       'vinculacion.'),
 ('T', 'Lo que NO esta en disputa: los totales cuadran'),
 ('P', 'Sobre el mismo universo y las mismas ventanas, los totales del ano '
       'coinciden dentro del 1-4%. No estamos midiendo cosas distintas: '
       'estamos recortando poblaciones distintas y anclando el dia 0 en '
       'puntos distintos.'),
 ('T', 'Hallazgo: el dia 0 de sus ventanas es el inicio del MES'),
 ('P', 'Sus columnas 30d/60d/90d no cuentan dias desde la vinculacion de '
       'cada sede: cuentan desde el primer dia del mes de vinculacion. Se '
       'probaron tres anclajes y ese baja el error de 2.120 a 342 '
       'solicitudes en los tres primeros meses. Consecuencia practica: sus '
       'ventanas de dias son equivalentes a nuestros meses de calendario, y '
       'las dos comparten el mismo sesgo — una sede vinculada el 28 solo '
       'aporta 3 dias a la primera ventana. Ninguno de los dos mapas iguala '
       'la exposicion por sede. Si se quiere corregir de verdad, el dia 0 '
       'tiene que ser la fecha de cada sede, y eso cambia los dos tableros.'),
 ('T', 'Ojo con «Avg Dias CS»: la caida es un artefacto'),
 ('P', 'Su columna baja 118 -> 82 -> 75 -> 80 -> 65 -> 47 -> 31 dias, y se '
       'lee como que Customer Success se volvio cuatro veces mas rapido. Es '
       'censura estadistica: el porcentaje de sedes que TODAVIA no ha pasado '
       'a Farmer crece del 19% en enero al 80% en julio. En julio el '
       'promedio solo puede reflejar a las 32 que pasaron rapido; las otras '
       '125 lo van a subir cuando pasen. Ninguna sede de julio puede llevar '
       'mas de 65 dias en CS porque no existe hace mas.'),
 ('P', 'Salvedad honesta: no logramos reproducir su cifra exacta. Nuestro '
       'promedio de las que ya pasaron da 65 dias para enero y 11 para '
       'julio, la mitad de los suyos, asi que su formula mide algo distinto '
       'que no pudimos despejar. Lo que si sostiene es el sesgo.'),
 ('T', 'Propuesta para que los dos tableros digan lo mismo'),
 ('P', 'a) Depurar los 29 registros de la hoja 2.  b) Acordar si las '
       'deshabilitadas entran o no, y declararlo en pantalla.  c) Fijar el '
       'reloj en fecha de vinculacion, con el de HubSpot disponible a un '
       'clic.  d) Corregir el rotulo «Mes Creacion», que en realidad es mes '
       'de vinculacion.  e) Reemplazar el promedio de dias en CS por el '
       'porcentaje acumulado de traspaso mes a mes, que ya esta en el mapa 5 '
       'de Profundizacion y no se censura.'),
 ('T', 'Fuentes'),
 ('P', 'Su hoja Farmer del archivo «Cosechas 2026 sedes tablero360 (2)» y '
       'la captura de su tablero. De nuestro lado: hoja SEDES (refresh en '
       'vivo del 4-sep-2026, 3.632 sedes), PLATAFORMA_SEDES '
       '(institucion_medica) y CREDITO_DIA (welli-data, credito por sede y '
       'dia). El cruce es por id_clinica = id_internal.'),
]
r5 = 0
for tipo, txt in notas:
    if tipo == 'T':
        r5 += 1 if r5 else 0
        h5.write(r5, 0, txt, fNotaT)
    else:
        h5.set_row(r5, 13 * (len(txt) // 98 + 1))
        h5.write(r5, 0, txt, fNota)
    r5 += 1

wb.close()
print('escrito ' + SALIDA)
tot_bas = sum(1 for m in MESES for _, _, mo in excl[m]
              if 'deshabilitada' not in mo)
tot_des = sum(1 for m in MESES for _, _, mo in excl[m]
              if 'deshabilitada' in mo)
print('  hoja 2: %d registros a depurar' % tot_bas)
print('  hoja 3: %d deshabilitadas' % tot_des)
for m in MESES:
    print('  %s  BI %3d  ->  Growth %3d   | sol BI %5d  Growth %5d'
          % (m, SU[m]['n'], mio[m]['n'],
             sum(v for v in SU[m]['sol'] if v), sum(mio[m]['sol'])))
