# -*- coding: utf-8 -*-
"""
Arma la hoja COHORTES: una fila por cosecha x offset de mes.

De ahi el tablero saca las TRES tablas que pidio el usuario:
  Acumulada     -> sedes_acum   (desembolso alguna vez; solo sube)
  Viva          -> sedes_vivas  (desembolso ESE mes; sube y baja)
  Plata firmada -> monto        (la misma tabla viva, en pesos)

Cosecha = mes de hs_createdate de la sede. Es fija para siempre.
M0 = mes de creacion, M1 el siguiente, hasta M7.
Cada celda mide lo de ESE mes, no acumulado (salvo sedes_acum).

Solo se emiten offsets cuyo mes real ya paso: un mes futuro se deja sin
fila para que el tablero muestre celda vacia, no un cero que parezca
resultado.
"""
import json, io, collections, datetime as dt

MAX_OFFSET = 7


def mes_mas(mes, k):
    """'2026-02' + 3 -> '2026-05'"""
    a, m = int(mes[:4]), int(mes[5:7])
    t = (a * 12 + (m - 1)) + k
    return '%04d-%02d' % (t // 12, t % 12 + 1)


def construir(sedes_tabla, plata_filas, mes_corte=None):
    """sedes_tabla: tabla SEDES con encabezado. plata_filas: PLATA_SEDE_MES."""
    hs = sedes_tabla[0]
    iId = hs.index('id_internal')
    iCos = hs.index('cosecha')

    # cosecha de cada sede + tamano de cada cosecha
    cosecha_de = {}
    tam = collections.Counter()
    for r in sedes_tabla[1:]:
        cos = str(r[iCos] or '')[:7]
        sid = str(r[iId] or '')
        if not cos:
            continue
        tam[cos] += 1
        if sid:
            cosecha_de[sid] = cos

    # plata por sede y mes
    ph = plata_filas[0]
    jId, jMes = ph.index('id_sede'), ph.index('mes')
    jDes, jMonto = ph.index('desembolsos'), ph.index('monto')
    dinero = collections.defaultdict(lambda: collections.defaultdict(
        lambda: {'des': 0, 'monto': 0.0}))
    for r in plata_filas[1:]:
        sid = str(r[jId] or '')
        cos = cosecha_de.get(sid)
        if not cos:
            continue                      # sede que no esta en HubSpot
        celda = dinero[cos][str(r[jMes] or '')[:7]]
        celda['des'] += int(r[jDes] or 0)
        celda['monto'] += float(r[jMonto] or 0)

    # sedes que desembolsaron, por cosecha y mes (para vivas y acumulada)
    vivas = collections.defaultdict(lambda: collections.defaultdict(set))
    for r in plata_filas[1:]:
        sid = str(r[jId] or '')
        cos = cosecha_de.get(sid)
        if not cos:
            continue
        vivas[cos][str(r[jMes] or '')[:7]].add(sid)

    corte = mes_corte or dt.date.today().strftime('%Y-%m')
    filas = [['cosecha', 'sedes_cohorte', 'm_offset', 'mes_real',
              'sedes_vivas', 'sedes_acum', 'desembolsos', 'monto']]
    for cos in sorted(tam):
        acum = set()
        for m in range(MAX_OFFSET + 1):
            mes = mes_mas(cos, m)
            if mes > corte:
                break                     # mes futuro: sin fila
            v = vivas[cos].get(mes, set())
            acum |= v
            c = dinero[cos].get(mes, {'des': 0, 'monto': 0.0})
            filas.append([cos, tam[cos], m, mes, len(v), len(acum),
                          c['des'], round(c['monto'])])
    return filas


if __name__ == '__main__':
    T = json.load(io.open('tables.json', encoding='utf8'))
    try:
        P = json.load(io.open('tables_plata_mes.json', encoding='utf8'))['PLATA_SEDE_MES']
    except Exception:
        print('Falta tables_plata_mes.json: corre bq_cohortes.py primero.')
        print('Se genera COHORTES con solo el encabezado para que el tablero')
        print('muestre el badge de falta de conexion en vez de ceros.')
        P = [['id_sede', 'mes', 'desembolsos', 'monto']]

    if len(P) <= 1:
        # Sin plata no se emiten filas: una matriz de ceros se lee como
        # "ninguna sede desembolso", que es una afirmacion falsa.
        filas = [['cosecha', 'sedes_cohorte', 'm_offset', 'mes_real',
                  'sedes_vivas', 'sedes_acum', 'desembolsos', 'monto']]
    else:
        filas = construir(T['SEDES'], P)
    json.dump({'COHORTES': filas}, io.open('tables_cohortes.json', 'w', encoding='utf8'),
              ensure_ascii=False)
    print('COHORTES: %d filas' % (len(filas) - 1))

    if len(P) > 1:
        # vista rapida de la matriz viva, para validar de un ojo
        por = {}
        for r in filas[1:]:
            por.setdefault(r[0], {})[r[2]] = r
        print()
        print('MATRIZ VIVA (sedes que desembolsaron ese mes)')
        print('cosecha    n    ' + '  '.join('M%d' % m for m in range(8)))
        for cos in sorted(por):
            fila = por[cos]
            celdas = []
            for m in range(8):
                celdas.append('%4d' % fila[m][4] if m in fila else '   .')
            print('%-9s %4d  %s' % (cos, fila[0][1], ' '.join(celdas)))
        print()
        print('MATRIZ ACUMULADA (desembolso alguna vez)')
        print('cosecha    n    ' + '  '.join('M%d' % m for m in range(8)))
        for cos in sorted(por):
            fila = por[cos]
            celdas = []
            for m in range(8):
                celdas.append('%4d' % fila[m][5] if m in fila else '   .')
            print('%-9s %4d  %s' % (cos, fila[0][1], ' '.join(celdas)))
