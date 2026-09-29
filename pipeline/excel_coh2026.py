# -*- coding: utf-8 -*-
"""
Excel de las sedes de las cosechas de 2026 con toda su data.

El universo es EXACTAMENTE el de los seis mapas de cohortes del tablero
(validado cosecha por cosecha en coh2026_datos.py): existe en la plataforma
con pais COL, no esta deshabilitada, cosecha 2026-01 o posterior.

Cinco hojas:
  1. Resumen por cosecha   - los agregados que se ven en el tablero
  2. Sedes 2026            - una fila por sede, con todo
  3. Mes a mes por sede    - la grilla M0..M8 en tres medidas
  4. Mes a mes (largo)      - la misma cosa lista para tabla dinamica
  5. Notas                 - definiciones y las dos trampas del dato
"""
import io
import json
import collections

import xlsxwriter

SALIDA = (r'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/'
          r'Cosechas_2026_sedes_tablero360.xlsx')
HOY = '2026-09'
MAXM = 8

MKT = {'PAGINA WEB', 'SOCIAL MEDIA', 'EVENTO', 'FREELANCE', 'REFERIDO',
       'DENTALINK', 'OK VET', 'DT DENTAL', 'STARKEY', 'ESSILOR', 'ANDREC',
       'NOVO NORDISK'}


def offs(a, b):
    """Meses entre dos claves YYYY-MM."""
    return (int(b[:4]) * 12 + int(b[5:7])) - (int(a[:4]) * 12 + int(a[5:7]))


def main():
    des = json.load(io.open('coh2026.json', encoding='utf8'))
    des.sort(key=lambda x: (x['cosecha'], -x['monto'], -x['apps'],
                            x['nombre'].lower()))

    # --- Derivados por sede. Se calculan aca y no en la hoja para que las
    # tres vistas cuenten lo mismo.
    for x in des:
        conSol = {m: v for m, v in x['mes'].items() if v['sol'] > 0}
        x['ult_mes_sol'] = max(conSol) if conSol else ''
        x['meses_sin_sol'] = (offs(x['ult_mes_sol'], HOY)
                              if x['ult_mes_sol'] else '')
        # Serie por offset de la cosecha. Los meses ANTERIORES a la cosecha
        # existen (sedes que ya operaban antes de entrar a HubSpot) y se
        # suman aparte para no inflar M0.
        x['serie'] = {}
        x['previo'] = {'sol': 0, 'apr': 0, 'des': 0, 'monto': 0.0}
        for m, v in x['mes'].items():
            k = offs(x['cosecha'], m)
            if k < 0:
                for c in ('sol', 'apr', 'des'):
                    x['previo'][c] += v[c]
                x['previo']['monto'] += v['monto']
                continue
            if k > MAXM:
                continue
            b = x['serie'].setdefault(k, {'sol': 0, 'apr': 0, 'des': 0,
                                          'monto': 0.0})
            for c in ('sol', 'apr', 'des'):
                b[c] += v[c]
            b['monto'] += v['monto']
        x['sol_total'] = sum(v['sol'] for v in x['mes'].values())
        x['apr_total'] = sum(v['apr'] for v in x['mes'].values())
        x['des_total'] = sum(v['des'] for v in x['mes'].values())
        x['monto_total'] = sum(v['monto'] for v in x['mes'].values())
        x['activa'] = x['sol_total'] > 0
        x['exitosa'] = x['sol_total'] >= 3 or x['des_total'] >= 1
        d = x['dias_sin_app']
        if not x['activa']:
            x['estado'] = 'Nunca aplico'
        elif d > 90:
            x['estado'] = 'Muerta (+90d)'
        elif d >= 30:
            x['estado'] = 'Inactiva (30-90d)'
        else:
            x['estado'] = 'Activa (-30d)'
        x['es_mkt'] = x['origen'] in MKT

    wb = xlsxwriter.Workbook(SALIDA)
    AMA, AZUL, INK2 = '#FFCE00', '#4C7DFF', '#5C574C'
    BORDE = '#E7E3D8'
    fTit = wb.add_format({'bold': True, 'font_size': 16})
    fSub = wb.add_format({'font_size': 10, 'font_color': INK2,
                          'text_wrap': True, 'valign': 'top'})
    fCab = wb.add_format({'bold': True, 'font_size': 9, 'font_color': 'white',
                          'bg_color': '#3A3833', 'valign': 'vcenter',
                          'text_wrap': True, 'border': 1,
                          'border_color': '#3A3833'})
    fCabN = wb.add_format({'bold': True, 'font_size': 9, 'font_color': 'white',
                           'bg_color': '#3A3833', 'align': 'right',
                           'valign': 'vcenter', 'text_wrap': True, 'border': 1,
                           'border_color': '#3A3833'})
    fGrupo = wb.add_format({'bold': True, 'font_size': 10, 'align': 'center',
                            'valign': 'vcenter', 'bg_color': '#FFF9E0',
                            'border': 1, 'border_color': BORDE})
    fT = wb.add_format({'font_size': 10, 'border': 1, 'border_color': BORDE})
    fTB = wb.add_format({'font_size': 10, 'bold': True, 'border': 1,
                         'border_color': BORDE})
    fN = wb.add_format({'font_size': 10, 'num_format': '#,##0', 'border': 1,
                        'border_color': BORDE})
    fC = wb.add_format({'font_size': 10, 'num_format': '$#,##0', 'border': 1,
                        'border_color': BORDE})
    fCB = wb.add_format({'font_size': 10, 'bold': True,
                         'num_format': '$#,##0', 'border': 1,
                         'border_color': BORDE})
    fP = wb.add_format({'font_size': 10, 'num_format': '0,0%', 'border': 1,
                        'border_color': BORDE})
    fCos = wb.add_format({'font_size': 10, 'bold': True, 'border': 1,
                          'border_color': BORDE, 'left': 5, 'left_color': AMA})
    fTotT = wb.add_format({'font_size': 10, 'bold': True, 'top': 2})
    fTotN = wb.add_format({'font_size': 10, 'bold': True,
                           'num_format': '#,##0', 'top': 2})
    fTotC = wb.add_format({'font_size': 10, 'bold': True,
                           'num_format': '$#,##0', 'top': 2})
    fTotP = wb.add_format({'font_size': 10, 'bold': True,
                           'num_format': '0,0%', 'top': 2})
    fNota = wb.add_format({'font_size': 10, 'text_wrap': True,
                           'valign': 'top', 'font_color': INK2})
    fNotaT = wb.add_format({'bold': True, 'font_size': 11})
    fCero = wb.add_format({'font_size': 10, 'num_format': '#,##0',
                           'border': 1, 'border_color': BORDE,
                           'font_color': '#B9B3A4'})
    # La columna "Antes" va en morado tenue: es informacion de contexto, no
    # parte de la serie de la cosecha, y no debe leerse como un mes mas.
    fCabAntes = wb.add_format({'bold': True, 'font_size': 9,
                               'font_color': 'white', 'bg_color': '#8C65C9',
                               'align': 'right', 'valign': 'vcenter',
                               'border': 1, 'border_color': '#8C65C9'})
    fNAntes = wb.add_format({'font_size': 10, 'num_format': '#,##0',
                             'border': 1, 'border_color': BORDE,
                             'bg_color': '#F4EEFB', 'font_color': '#5B3C86'})
    fCAntes = wb.add_format({'font_size': 10, 'num_format': '$#,##0',
                             'border': 1, 'border_color': BORDE,
                             'bg_color': '#F4EEFB', 'font_color': '#5B3C86'})

    # ============================================ 1 · resumen por cosecha
    cos = collections.OrderedDict()
    for x in des:
        b = cos.setdefault(x['cosecha'], {
            'n': 0, 'act': 0, 'exi': 0, 'nunca': 0, 'inac': 0, 'muer': 0,
            'mkt': 0, 'sol': 0, 'apr': 0, 'dsb': 0, 'monto': 0.0,
            'conPlata': 0})
        b['n'] += 1
        b['sol'] += x['sol_total']
        b['apr'] += x['apr_total']
        b['dsb'] += x['des_total']
        b['monto'] += x['monto_total']
        if x['activa']:
            b['act'] += 1
        else:
            b['nunca'] += 1
        if x['exitosa']:
            b['exi'] += 1
        if x['estado'].startswith('Inactiva'):
            b['inac'] += 1
        if x['estado'].startswith('Muerta'):
            b['muer'] += 1
        if x['es_mkt']:
            b['mkt'] += 1
        if x['monto_total'] > 0:
            b['conPlata'] += 1

    h1 = wb.add_worksheet('Resumen por cosecha')
    h1.hide_gridlines(2)
    h1.write('A1', 'Cosechas de 2026 · sedes y su desempeño', fTit)
    h1.merge_range(
        'A2:M3',
        'Mismo universo que los seis mapas de cohortes del tablero: la sede '
        'existe en la plataforma con pais COL, no esta deshabilitada y su '
        'cosecha es 2026-01 o posterior. Validado cosecha por cosecha contra '
        'el tablero. "Activa" = hizo al menos una solicitud. "Exitosa" = 3 o '
        'mas solicitudes, o al menos un desembolso. El estado (activa / '
        'inactiva / muerta) sale de los dias sin aplicar que reporta HubSpot.',
        fSub)
    h1.set_row(1, 24)
    h1.set_row(2, 24)
    anchos = [12, 8, 9, 9, 9, 11, 11, 11, 12, 12, 13, 18, 15]
    for i, w in enumerate(anchos):
        h1.set_column(i, i, w)
    cabs = ['Cosecha', 'Sedes', 'De mkt', 'Activas', '% activas', 'Exitosas',
            '% exitosas', 'Nunca aplicó', 'Inactivas', 'Muertas',
            'Solicitudes', 'Plata desembolsada', 'Plata por sede']
    fila = 4
    for c, t in enumerate(cabs):
        h1.write(fila, c, t, fCab if c == 0 else fCabN)
    h1.set_row(fila, 32)
    fila += 1
    ini = fila
    for k, b in cos.items():
        h1.write(fila, 0, k, fCos)
        h1.write_number(fila, 1, b['n'], fN)
        h1.write_number(fila, 2, b['mkt'], fN)
        h1.write_number(fila, 3, b['act'], fN)
        h1.write_number(fila, 4, b['act'] / b['n'], fP)
        h1.write_number(fila, 5, b['exi'], fN)
        h1.write_number(fila, 6, b['exi'] / b['n'], fP)
        h1.write_number(fila, 7, b['nunca'], fN)
        h1.write_number(fila, 8, b['inac'], fN)
        h1.write_number(fila, 9, b['muer'], fN)
        h1.write_number(fila, 10, b['sol'], fN)
        h1.write_number(fila, 11, b['monto'], fC)
        h1.write_number(fila, 12, b['monto'] / b['n'], fC)
        fila += 1
    h1.write(fila, 0, 'Total', fTotT)
    for c in (1, 2, 3, 5, 7, 8, 9, 10):
        L = chr(ord('A') + c)
        h1.write_formula(fila, c, '=SUM(%s%d:%s%d)' % (L, ini + 1, L, fila),
                         fTotN)
    h1.write_formula(fila, 11, '=SUM(L%d:L%d)' % (ini + 1, fila), fTotC)
    R = fila + 1
    h1.write_formula(fila, 4, '=D%d/B%d' % (R, R), fTotP)
    h1.write_formula(fila, 6, '=F%d/B%d' % (R, R), fTotP)
    h1.write_formula(fila, 12, '=L%d/B%d' % (R, R), fTotC)

    # ============================================ 2 · una fila por sede
    h2 = wb.add_worksheet('Sedes 2026')
    h2.hide_gridlines(2)
    cols = [
        ('Cosecha', 'cosecha', 10, 't'),
        ('Sede', 'nombre', 42, 'b'),
        ('Origen', 'origen', 15, 't'),
        ('Es marketing', 'es_mkt', 12, 'si'),
        ('Estado', 'estado', 17, 't'),
        ('Activa', 'activa', 8, 'si'),
        ('Exitosa', 'exitosa', 9, 'si'),
        ('Solicitudes', 'sol_total', 11, 'n'),
        ('Aprobados', 'apr_total', 10, 'n'),
        ('Desembolsos', 'des_total', 12, 'n'),
        ('Plata desembolsada', 'monto_total', 18, 'cb'),
        ('Ticket promedio 4m', 'ticket_4m', 17, 'c'),
        ('Aprobados sin firmar', 'aprob_no_firm', 17, 'n'),
        ('Días sin aplicar', 'dias_sin_app', 14, 'n'),
        ('Último mes con solicitud', 'ult_mes_sol', 19, 't'),
        ('Meses sin solicitar', 'meses_sin_sol', 16, 'n'),
        ('Solicitudes antes de la cosecha', 'previo_sol', 24, 'n'),
        ('Ciudad', 'ciudad', 18, 't'),
        ('Especialidad', 'especialidad', 20, 't'),
        ('Clasificación', 'clasificacion', 13, 't'),
        ('Ranking', 'ranking', 10, 't'),
        ('Hunter', 'hunter', 19, 't'),
        ('Farmer', 'farmer', 19, 't'),
        ('Customer Success', 'cs', 17, 't'),
        ('Pipeline', 'pipeline', 22, 't'),
        ('Etapa', 'etapa', 22, 't'),
        ('Estado comunicaciones', 'estado_com', 18, 't'),
        ('Audiencia Long Tail', 'audiencia_lt', 17, 't'),
        ('Alerta', 'alert', 9, 't'),
        ('Fecha capacitado', 'capacitado', 14, 't'),
        ('Último desembolso', 'ultimo_des', 15, 't'),
        ('Puntos WP', 'puntos', 10, 'n'),
        ('ID HubSpot', 'id_hs', 14, 't'),
        ('ID interno', 'id_interno', 11, 't'),
    ]
    fmap = {'t': fT, 'b': fTB, 'n': fN, 'c': fC, 'cb': fCB, 'si': fT}
    for c, (t, _k, w, kind) in enumerate(cols):
        h2.set_column(c, c, w)
        h2.write(0, c, t, fCabN if kind in ('n', 'c', 'cb') else fCab)
    h2.set_row(0, 32)
    for i, x in enumerate(des, start=1):
        x['previo_sol'] = x['previo']['sol']
        for c, (_t, campo, _w, kind) in enumerate(cols):
            v = x.get(campo, '')
            if kind == 'si':
                h2.write(i, c, 'Sí' if v else 'No', fT)
            elif kind in ('n', 'c', 'cb'):
                if v == '' or v is None:
                    h2.write(i, c, '—', fT)
                elif v == 0 and kind == 'n':
                    h2.write_number(i, c, 0, fCero)
                else:
                    h2.write_number(i, c, v, fmap[kind])
            else:
                h2.write(i, c, v if v else '—', fmap[kind])
    h2.autofilter(0, 0, len(des), len(cols) - 1)
    h2.freeze_panes(1, 2)

    # ============================================ 3 · grilla mes a mes
    h3 = wb.add_worksheet('Mes a mes por sede')
    h3.hide_gridlines(2)
    h3.merge_range(0, 0, 1, 0, 'Cosecha', fCab)
    h3.merge_range(0, 1, 1, 1, 'Sede', fCab)
    h3.merge_range(0, 2, 1, 2, 'Origen', fCab)
    h3.set_column(0, 0, 10)
    h3.set_column(1, 1, 42)
    h3.set_column(2, 2, 15)
    bloques = [('Solicitudes', 'sol', 'n'), ('Desembolsos', 'des', 'n'),
               ('Plata desembolsada', 'monto', 'c')]
    c0 = 3
    pos = []
    for nom, campo, kind in bloques:
        h3.merge_range(0, c0, 0, c0 + MAXM + 1,
                       nom + '  ·  M0 = mes de la cosecha', fGrupo)
        h3.set_column(c0, c0, 15 if kind == 'c' else 9)
        h3.write(1, c0, 'Antes', fCabAntes)
        for k in range(MAXM + 1):
            h3.set_column(c0 + 1 + k, c0 + 1 + k, 13 if kind == 'c' else 7)
            h3.write(1, c0 + 1 + k, 'M' + str(k), fCabN)
        pos.append((c0, campo, kind))
        c0 += MAXM + 2
    h3.set_row(1, 18)
    for i, x in enumerate(des, start=2):
        h3.write(i, 0, x['cosecha'], fT)
        h3.write(i, 1, x['nombre'] or '—', fTB)
        h3.write(i, 2, x['origen'] or '—', fT)
        maxk = offs(x['cosecha'], HOY)
        for base, campo, kind in pos:
            va = x['previo'][campo]
            h3.write_number(i, base, va,
                            (fCAntes if kind == 'c' else fNAntes)
                            if va else fCero)
            for k in range(MAXM + 1):
                cel = base + 1 + k
                if k > maxk:
                    h3.write(i, cel, '', fT)      # mes que aun no existe
                    continue
                v = x['serie'].get(k, {}).get(campo, 0)
                if kind == 'c':
                    h3.write_number(i, cel, v, fC if v else fCero)
                else:
                    h3.write_number(i, cel, v, fN if v else fCero)
    h3.autofilter(1, 0, len(des) + 1, c0 - 1)
    h3.freeze_panes(2, 3)

    # ============================================ 4 · largo para dinamicas
    h4 = wb.add_worksheet('Mes a mes (largo)')
    h4.hide_gridlines(2)
    cab4 = [('Cosecha', 10), ('Sede', 42), ('Origen', 15), ('Es marketing', 12),
            ('Mes', 10), ('Offset', 8), ('Solicitudes', 11),
            ('Aprobados', 10), ('Desembolsos', 12), ('Plata', 16)]
    for c, (t, w) in enumerate(cab4):
        h4.set_column(c, c, w)
        h4.write(0, c, t, fCabN if c >= 5 else fCab)
    h4.set_row(0, 26)
    r = 1
    for x in des:
        for m in sorted(x['mes']):
            v = x['mes'][m]
            h4.write(r, 0, x['cosecha'], fT)
            h4.write(r, 1, x['nombre'] or '—', fT)
            h4.write(r, 2, x['origen'] or '—', fT)
            h4.write(r, 3, 'Sí' if x['es_mkt'] else 'No', fT)
            h4.write(r, 4, m, fT)
            h4.write_number(r, 5, offs(x['cosecha'], m), fN)
            h4.write_number(r, 6, v['sol'], fN)
            h4.write_number(r, 7, v['apr'], fN)
            h4.write_number(r, 8, v['des'], fN)
            h4.write_number(r, 9, v['monto'], fC)
            r += 1
    h4.autofilter(0, 0, r - 1, len(cab4) - 1)
    h4.freeze_panes(1, 2)

    # ============================================ 5 · notas
    h5 = wb.add_worksheet('Notas')
    h5.hide_gridlines(2)
    h5.set_column('A:A', 104)
    prev = sum(1 for x in des if x['previo']['sol'] > 0)
    notas = [
        ('T', 'Que sedes entran'),
        ('P', 'El universo es el mismo de los seis mapas de cohortes del '
              'tablero, y se valido cosecha por cosecha contra lo que el '
              'tablero muestra hoy (173 / 226 / 191 / 183 / 173 / 178 / 159). '
              'Tres reglas: la sede existe en la plataforma '
              '(institucion_medica) con pais COL, NO esta en el pipeline '
              'Aliados_deshabilitados, y su cosecha es 2026-01 o posterior.'),
        ('P', 'Total: %d sedes en 8 cosechas. Se descartaron 57 '
              'deshabilitadas, 31 sin id_internal y 10 que no existen en la '
              'plataforma. Por eso agosto sale con 173 aca y con 183 en la '
              'tarjeta de adquisicion del tablero: esa tarjeta cuenta la '
              'existencia cruda en HubSpot a proposito, sin exigir cruce con '
              'la plataforma.' % len(des)),
        ('T', 'Definiciones'),
        ('P', 'Activa = hizo al menos una solicitud. Exitosa = 3 o mas '
              'solicitudes, o al menos un desembolso. Inactiva = entre 30 y '
              '90 dias sin aplicar. Muerta = mas de 90 dias sin aplicar. '
              '"Nunca aplico" se separa de "muerta" a proposito: una sede que '
              'nunca arranco es un problema de activacion, no de retencion.'),
        ('P', 'M0 es el mes de la cosecha, M1 el siguiente, y asi. Las celdas '
              'en blanco de la grilla son meses que todavia no existen (una '
              'cosecha de julio no tiene M3). Un cero gris es un mes real sin '
              'actividad.'),
        ('T', 'Dos trampas del dato'),
        ('P', 'La propiedad fecha_ultima_app de HubSpot esta VACIA en las '
              '%d sedes: dejo de sincronizarse. La columna "Dias sin aplicar" '
              'usa dias_desde_ultima_app, que si esta viva (se contrasto '
              'contra el ultimo mes con solicitud real y coincide en 1.126 de '
              '1.126 sedes con actividad). Pero para las sedes que nunca '
              'aplicaron reporta 0, que se leeria como "aplico hoy" — por eso '
              'se agrego la columna "Ultimo mes con solicitud", que sale de '
              'ACT_SEDE_MES y es la fuente viva.' % len(des)),
        ('P', '%d sedes tienen solicitudes ANTERIORES a su cosecha: ya '
              'operaban con WELLI antes de que se creara su ficha en HubSpot. '
              'Esas solicitudes van en la columna "Solicitudes antes de la '
              'cosecha" y NO se suman a M0, porque inflarian el arranque de '
              'la cosecha con actividad que no le pertenece.' % prev),
        ('T', 'OJO: el M0 del tablero no es el mes de la cosecha'),
        ('P', 'En el mapa "Desembolsos por sede - sin acumular" del tablero, '
              'la columna M0 no muestra el mes de la cosecha: muestra TODO lo '
              'acumulado hasta ese mes, incluida la actividad anterior a la '
              'cosecha. De M1 en adelante si son deltas mensuales reales '
              '(verificado celda por celda: M1 a M3 coinciden exactamente con '
              'este archivo).'),
        ('P', 'El caso mas grave es febrero 2026: el tablero muestra 127 '
              'desembolsos y $634 M en M0, pero 88 desembolsos y $439 M de '
              'eso -el 69% de la plata- ocurrieron ANTES de febrero, en 26 '
              'sedes que ya operaban con WELLI antes de tener ficha en '
              'HubSpot. Enero infla 24 desembolsos y $69 M; abril 16 y $87 M; '
              'agosto 1 y $22 M. Marzo, mayo, junio y julio no tienen sesgo.'),
        ('P', 'Por eso la grilla de este archivo trae una columna "Antes" '
              'delante de cada M0. Para reconciliar con el tablero: M0 del '
              'tablero = Antes + M0 de aqui. Para leer la cosecha limpia, use '
              'el M0 de aqui. El mismo sesgo afecta las tasas de activacion, '
              'pero mucho menos: 1,5 puntos en el total (41,3% del tablero '
              'contra 39,8% real), con enero como el peor caso a 5,8 puntos.'),
        ('T', 'Fuente'),
        ('P', 'Hojas SEDES, ACT_SEDE_MES, PLATAFORMA_SEDES, SEDE_ROLES y '
              'OWNERS del Tablero 360, refresh del 2 de septiembre de 2026. '
              'Los contadores mes a mes salen de ACT_SEDE_MES (BigQuery), no '
              'de los contadores de por vida de HubSpot, que son acumulados y '
              'no se pueden repartir por mes.'),
    ]
    r = 0
    for tipo, txt in notas:
        if tipo == 'T':
            r += 1 if r else 0
            h5.write(r, 0, txt, fNotaT)
        else:
            h5.set_row(r, 14 * (len(txt) // 95 + 1))
            h5.write(r, 0, txt, fNota)
        r += 1

    wb.close()
    print('escrito ' + SALIDA)
    print('  Resumen por cosecha : %d cosechas' % len(cos))
    print('  Sedes 2026          : %d filas x %d columnas'
          % (len(des), len(cols)))
    print('  Mes a mes por sede  : %d filas x %d columnas'
          % (len(des), c0))
    print('  Mes a mes (largo)   : %d filas' % (r if False else 0 or (
        sum(len(x['mes']) for x in des))))


if __name__ == '__main__':
    main()
