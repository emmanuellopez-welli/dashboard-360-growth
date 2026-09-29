# -*- coding: utf-8 -*-
"""
Excel de las sedes deshabilitadas que el Tablero 360 dejo de contar.

Sale de la MISMA hoja SEDES que lee el tablero, no de la API, para que el
archivo cuadre exactamente con lo que muestra el tablero desplegado.

Tres hojas: resumen por mes, el detalle de las 343 con filtros, y las notas
de definicion (por que el pipeline y no la bandera, y que NO alcanza a cubrir).
"""
import io
import json

import xlsxwriter

SALIDA = (r'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/'
          r'Sedes_deshabilitadas_tablero360.xlsx')
HOJAS = 'sheet_data.json'

MKT = {'PAGINA WEB', 'SOCIAL MEDIA', 'EVENTO', 'FREELANCE', 'REFERIDO',
       'DENTALINK', 'OK VET', 'DT DENTAL', 'STARKEY', 'ESSILOR', 'ANDREC',
       'NOVO NORDISK'}
MES = {'01': 'enero', '02': 'febrero', '03': 'marzo', '04': 'abril',
       '05': 'mayo', '06': 'junio', '07': 'julio', '08': 'agosto',
       '09': 'septiembre', '10': 'octubre', '11': 'noviembre',
       '12': 'diciembre'}


def etq(c):
    p = c.split('-')
    return (MES[p[1]] + ' ' + p[0]) if len(p) == 2 and p[1] in MES else c


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def cargar():
    hojas = json.load(io.open(HOJAS, encoding='utf8'))
    filas = hojas['SEDES']
    ix = {h: i for i, h in enumerate(filas[0])}
    out, total = [], {'n': 0, 'apps': 0.0, 'monto': 0.0}
    for r in filas[1:]:
        total['n'] += 1
        total['apps'] += num(r[ix['aplicaciones']])
        total['monto'] += num(r[ix['monto_total_desembolsado']])
        if 'deshabilitad' not in str(r[ix['pipeline']] or '').lower():
            continue
        origen = str(r[ix['origen']] or '').strip().upper()
        out.append({
            'cosecha': str(r[ix['cosecha']] or '')[:7] or '(sin fecha)',
            'nombre': str(r[ix['nombre_sede']] or '').strip(),
            'id_hs': str(r[ix['id']] or '').strip(),
            'id_interno': str(r[ix['id_internal']] or '').strip(),
            'etapa': str(r[ix['etapa']] or '').strip(),
            'origen': origen,
            'ciudad': str(r[ix['ciudad_municipio']] or '').strip(),
            'clasificacion': str(r[ix['clasificacion_aliado']] or '').strip(),
            'apps': int(num(r[ix['aplicaciones']])),
            'aprobados': int(num(r[ix['total_aprobados']])),
            'desembolsos': int(num(r[ix['desembolsos']])),
            'monto': num(r[ix['monto_total_desembolsado']]),
            'dias_sin_app': int(num(r[ix['dias_desde_ultima_app']])),
            'ultima_app': str(r[ix['fecha_ultima_app']] or '')[:10],
        })
    return out, total


def main():
    des, total = cargar()
    des.sort(key=lambda x: (x['cosecha'], -x['monto'], -x['apps'],
                            x['nombre'].lower()))

    wb = xlsxwriter.Workbook(SALIDA, {'constant_memory': False})

    # --- formatos. Un solo lugar para que las tres hojas se vean igual.
    AMA, AZUL, INK, INK2 = '#FFCE00', '#4C7DFF', '#141310', '#5C574C'
    fTitulo = wb.add_format({'bold': True, 'font_size': 16, 'font_color': INK,
                             'font_name': 'Calibri'})
    fSub = wb.add_format({'font_size': 10, 'font_color': INK2,
                          'text_wrap': True, 'valign': 'top'})
    fCab = wb.add_format({'bold': True, 'font_size': 9, 'font_color': 'white',
                          'bg_color': '#3A3833', 'align': 'left',
                          'valign': 'vcenter', 'border': 1,
                          'border_color': '#3A3833'})
    fCabNum = wb.add_format({'bold': True, 'font_size': 9,
                             'font_color': 'white', 'bg_color': '#3A3833',
                             'align': 'right', 'valign': 'vcenter',
                             'border': 1, 'border_color': '#3A3833'})
    fTxt = wb.add_format({'font_size': 10, 'border': 1,
                          'border_color': '#E7E3D8'})
    fTxtB = wb.add_format({'font_size': 10, 'bold': True, 'border': 1,
                           'border_color': '#E7E3D8'})
    fInt = wb.add_format({'font_size': 10, 'num_format': '#,##0',
                          'border': 1, 'border_color': '#E7E3D8'})
    fCop = wb.add_format({'font_size': 10, 'num_format': '$#,##0',
                          'border': 1, 'border_color': '#E7E3D8'})
    fCopB = wb.add_format({'font_size': 10, 'bold': True,
                           'num_format': '$#,##0', 'border': 1,
                           'border_color': '#E7E3D8'})
    fTotT = wb.add_format({'font_size': 10, 'bold': True, 'top': 2,
                           'top_color': '#3A3833'})
    fTotN = wb.add_format({'font_size': 10, 'bold': True, 'num_format': '#,##0',
                           'top': 2, 'top_color': '#3A3833'})
    fTotC = wb.add_format({'font_size': 10, 'bold': True,
                           'num_format': '$#,##0', 'top': 2,
                           'top_color': '#3A3833'})
    fMes = wb.add_format({'font_size': 10, 'bold': True, 'border': 1,
                          'border_color': '#E7E3D8'})
    fMes26 = wb.add_format({'font_size': 10, 'bold': True, 'border': 1,
                            'border_color': '#E7E3D8', 'left': 5,
                            'left_color': AMA})
    fPct = wb.add_format({'font_size': 10, 'num_format': '0,0%',
                          'border': 1, 'border_color': '#E7E3D8'})
    fNota = wb.add_format({'font_size': 10, 'text_wrap': True,
                           'valign': 'top', 'font_color': INK2})
    fNotaT = wb.add_format({'bold': True, 'font_size': 11, 'font_color': INK})

    # =============================================== 1 · resumen por mes
    porMes = {}
    for x in des:
        b = porMes.setdefault(x['cosecha'], {'n': 0, 'apps': 0, 'monto': 0.0,
                                             'opero': 0})
        b['n'] += 1
        b['apps'] += x['apps']
        b['monto'] += x['monto']
        if x['apps'] > 0:
            b['opero'] += 1

    h1 = wb.add_worksheet('Resumen por mes')
    h1.hide_gridlines(2)
    h1.set_column('A:A', 20)
    h1.set_column('B:B', 10)
    h1.set_column('C:C', 12)
    h1.set_column('D:D', 18)
    h1.set_column('E:E', 20)
    h1.set_column('F:F', 15)
    h1.write('A1', 'Sedes deshabilitadas fuera del Tablero 360', fTitulo)
    h1.merge_range(
        'A2:F3',
        'Toda sede que vive en el pipeline "Aliados_deshabilitados" de HubSpot '
        'dejo de contar en adquisicion y en los seis mapas de cohortes. '
        'Los meses marcados en amarillo son los unicos que cambian un '
        'denominador de cohorte: los mapas arrancan en enero 2026. '
        'Cuidado con octubre 2025 — es la fecha de la migracion a HubSpot, no '
        'una captacion real, y ahi cae toda la base historica.', fSub)
    h1.set_row(1, 26)
    h1.set_row(2, 26)

    fila = 4
    cabs = ['Cosecha', 'Sedes', 'Aplicaciones', 'Plata desembolsada',
            'Alcanzaron a operar', '% de las sedes']
    for c, t in enumerate(cabs):
        h1.write(fila, c, t, fCab if c == 0 else fCabNum)
    h1.set_row(fila, 26)
    fila += 1
    ini = fila
    for k in sorted(porMes):
        b = porMes[k]
        h1.write(fila, 0, etq(k), fMes26 if k >= '2026-01' else fMes)
        h1.write_number(fila, 1, b['n'], fInt)
        h1.write_number(fila, 2, b['apps'], fInt)
        h1.write_number(fila, 3, b['monto'], fCop)
        h1.write_number(fila, 4, b['opero'], fInt)
        h1.write_number(fila, 5, b['opero'] / b['n'] if b['n'] else 0, fPct)
        fila += 1
    h1.write(fila, 0, 'Total', fTotT)
    for c, col in zip((1, 2, 4), ('B', 'C', 'E')):
        h1.write_formula(fila, c,
                         '=SUM(%s%d:%s%d)' % (col, ini + 1, col, fila),
                         fTotN)
    h1.write_formula(fila, 3, '=SUM(D%d:D%d)' % (ini + 1, fila), fTotC)
    h1.write_formula(fila, 5, '=IF(B%d=0,0,E%d/B%d)' % (fila + 1, fila + 1,
                                                        fila + 1),
                     wb.add_format({'font_size': 10, 'bold': True,
                                    'num_format': '0,0%', 'top': 2,
                                    'top_color': '#3A3833'}))

    fila += 3
    h1.write(fila, 0, 'Peso del corte sobre toda la base', fNotaT)
    fila += 1
    peso = [
        ('Sedes', len(des), total['n']),
        ('Aplicaciones', sum(x['apps'] for x in des), total['apps']),
        ('Plata desembolsada', sum(x['monto'] for x in des), total['monto']),
    ]
    for c, t in enumerate(['Medida', 'Deshabilitadas', 'Toda la base',
                           '% que sale']):
        h1.write(fila, c, t, fCab if c == 0 else fCabNum)
    fila += 1
    for nom, parte, tot in peso:
        h1.write(fila, 0, nom, fTxt)
        f = fCop if 'Plata' in nom else fInt
        h1.write_number(fila, 1, parte, f)
        h1.write_number(fila, 2, tot, f)
        h1.write_number(fila, 3, (parte / tot) if tot else 0, fPct)
        fila += 1

    # =============================================== 2 · detalle
    h2 = wb.add_worksheet('Sedes deshabilitadas')
    h2.hide_gridlines(2)
    cols = [
        ('Cosecha', 'cosecha', 11, 'txt'),
        ('Sede', 'nombre', 44, 'txtb'),
        ('Origen', 'origen', 16, 'txt'),
        ('Es marketing', None, 13, 'txt'),
        ('Ciudad', 'ciudad', 18, 'txt'),
        ('Clasificacion', 'clasificacion', 14, 'txt'),
        ('Etapa', 'etapa', 15, 'txt'),
        ('Aplicaciones', 'apps', 13, 'int'),
        ('Aprobados', 'aprobados', 11, 'int'),
        ('Desembolsos', 'desembolsos', 12, 'int'),
        ('Plata desembolsada', 'monto', 19, 'copb'),
        ('Dias sin aplicar', 'dias_sin_app', 15, 'int'),
        ('Ultima aplicacion', 'ultima_app', 16, 'txt'),
        ('ID HubSpot', 'id_hs', 14, 'txt'),
        ('ID interno', 'id_interno', 12, 'txt'),
    ]
    for c, (t, _, w, _k) in enumerate(cols):
        h2.set_column(c, c, w)
        h2.write(0, c, t, fCabNum if _k in ('int', 'cop', 'copb') else fCab)
    h2.set_row(0, 30)
    fmap = {'txt': fTxt, 'txtb': fTxtB, 'int': fInt, 'cop': fCop,
            'copb': fCopB}
    for i, x in enumerate(des, start=1):
        for c, (_t, campo, _w, kind) in enumerate(cols):
            fmt = fmap[kind]
            if campo is None:
                h2.write(i, c, 'Si' if x['origen'] in MKT else 'No', fmt)
            elif kind in ('int', 'cop', 'copb'):
                h2.write_number(i, c, x[campo], fmt)
            else:
                v = x[campo]
                h2.write(i, c, v if v else '—', fmt)
    h2.autofilter(0, 0, len(des), len(cols) - 1)
    h2.freeze_panes(1, 2)

    # =============================================== 3 · notas
    h3 = wb.add_worksheet('Notas')
    h3.hide_gridlines(2)
    h3.set_column('A:A', 104)
    notas = [
        ('T', 'Como se define una sede deshabilitada'),
        ('P', 'La definicion es el PIPELINE, no una propiedad. Una sede dada '
              'de baja se mueve al pipeline "Aliados_deshabilitados" de '
              'HubSpot, y ese movimiento es el acto administrativo con el que '
              'el equipo la retira. La bandera fb_deshabilitado es un '
              'subconjunto estricto: cubre 339 de las 343, ninguna por fuera. '
              'Por eso el filtro usa el pipeline, que es la fuente completa y '
              'la que no se queda vieja.'),
        ('P', 'El match va sobre el pipeline y nunca sobre la etapa: existe '
              'una etapa llamada "A revisar / Deshabilitar" en el pipeline de '
              'Capacitacion muertos que es una lista de candidatas, no una '
              'baja. Si alguien la llena, esas sedes NO deben salir del '
              'tablero.'),
        ('T', 'Que se ve distinto en el tablero'),
        ('P', 'Salen 343 sedes: 9,5% de la base, 16,7% de las aplicaciones y '
              '6,9% de la plata historica. Aplica a adquisicion, a los seis '
              'mapas de cohortes, al frente de rescate y a Welli Points.'),
        ('P', 'Solo 57 son de cosecha 2026, las unicas que cambian un '
              'denominador de cohorte. Las otras 286 caen en 2025-10 o antes, '
              'que es la fecha de la migracion a HubSpot.'),
        ('T', 'Lo que este corte NO cubre'),
        ('P', 'El mapa de deals de adquisicion (hoja DEALS_ORIGEN) y la '
              'grafica de Long Tail (hoja LT_APPS_DIA) vienen pre-agregadas '
              'por cosecha x origen y por dia x audiencia, SIN llave de sede. '
              'Ahi las deshabilitadas siguen contando. Para filtrarlas hay '
              'que volver a jalar los deals con su asociacion a sede.'),
        ('T', 'Cuidado al leer cohortes de marketing'),
        ('P', 'El corte reescribe la historia hacia abajo. Innovadentix (373 '
              'apps, $253 M) y Dentalsys (330 apps, $234 M) eran de PAGINA '
              'WEB y de cosecha marzo 2026, asi que ese mes de marketing '
              'ahora se ve peor de lo que fue. El corte responde bien "con '
              'quien operamos hoy" y engana en "que tan bien capto marketing '
              'en su momento".'),
        ('P', 'Buena parte de las 343 son fichas duplicadas del mismo '
              'consultorio: los pares Dentix "tasa 0" / "subvencionada", '
              'DentiSalud Restrepo y Colombia Smile son el mismo sitio '
              'partido en dos registros. Darlos de baja es depuracion, no '
              'perdida de aliado.'),
        ('P', 'Abril 2026 son 14 sedes con 6 aplicaciones entre todas, y 12 '
              'de ellas son sedes "SO Servicios Medicos" cargadas una por una '
              'desde pagina web que nunca arrancaron.'),
        ('T', 'Fuente'),
        ('P', 'Hoja SEDES del Tablero 360, refresh del 2 de septiembre de '
              '2026. El archivo se genera de la misma hoja que lee el '
              'tablero, no de la API, para que los numeros cuadren con lo que '
              'muestra el tablero desplegado.'),
    ]
    r = 0
    for tipo, txt in notas:
        if tipo == 'T':
            r += 1 if r else 0
            h3.write(r, 0, txt, fNotaT)
            r += 1
        else:
            h3.set_row(r, 15 * (len(txt) // 95 + 1))
            h3.write(r, 0, txt, fNota)
            r += 1

    wb.close()
    print('escrito ' + SALIDA)
    print('  hoja 1: resumen de %d meses' % len(porMes))
    print('  hoja 2: %d sedes x %d columnas' % (len(des), len(cols)))
    print('  hoja 3: notas de definicion')


if __name__ == '__main__':
    main()
