# -*- coding: utf-8 -*-
"""
Cierra F5: introspecciona welli-growth.wp_data y arma la hoja WP_BQ.

Los nombres de tabla estan confirmados por la consola de BigQuery; los de
COLUMNA no, asi que primero se lee INFORMATION_SCHEMA y se eligen las
columnas de fecha / sede / puntos por candidatos, igual que hace
refreshWelliPoints() en Fuentes_BigQuery.gs.
"""
import lib, json, io, collections

PROY = 'welli-growth'
DS = 'wp_data'


def esquema():
    r = lib.bq(
        'SELECT table_name, column_name, data_type '
        'FROM `%s.%s.INFORMATION_SCHEMA.COLUMNS` '
        'ORDER BY table_name, ordinal_position' % (PROY, DS), project=PROY)
    por = collections.OrderedDict()
    for f in r:
        por.setdefault(f['table_name'], []).append((f['column_name'], f['data_type']))
    return por


def elegir(cols, candidatos):
    nombres = [c[0] for c in cols]
    for cand in candidatos:                       # coincidencia exacta primero
        for nm in nombres:
            if nm.lower() == cand:
                return nm
    for cand in candidatos:                       # luego por contenido
        for nm in nombres:
            if cand in nm.lower():
                return nm
    return None


CAND_FECHA = ['fecha', 'created_at', 'created_on', 'fecha_evento', 'date', 'timestamp',
              'fecha_registro', 'fecha_ganado']
CAND_SEDE = ['sede_id', 'medico_id', 'id_sede', 'institucion_id', 'sede', 'medico',
             'aliado_id', 'hs_object_id']
CAND_PUNTOS = ['puntos', 'wp', 'cantidad', 'monto', 'valor', 'points', 'puntaje']

if __name__ == '__main__':
    try:
        esq = esquema()
    except Exception as e:
        print('NO HAY ACCESO A %s todavia:' % PROY)
        print('  ' + str(e)[:400])
        raise SystemExit(1)

    print('TABLAS EN %s.%s (%d)\n' % (PROY, DS, len(esq)))
    for t, cols in esq.items():
        print('== %s  (%d columnas)' % (t, len(cols)))
        print('   ' + ', '.join('%s:%s' % (c, d) for c, d in cols))
        print()

    json.dump({t: [list(c) for c in cols] for t, cols in esq.items()},
              io.open('wp_esquema.json', 'w', encoding='utf8'), ensure_ascii=False, indent=1)

    hist = esq.get('wellipoints_historico')
    if not hist:
        print('No se ve wellipoints_historico; revisa la lista de arriba.')
        raise SystemExit(1)

    cF = elegir(hist, CAND_FECHA)
    cS = elegir(hist, CAND_SEDE)
    cP = elegir(hist, CAND_PUNTOS)
    print('MAPEO wellipoints_historico -> fecha=%s | sede=%s | puntos=%s' % (cF, cS, cP))
    if not (cF and cS and cP):
        print('Falta mapear alguna columna. Ajusta los candidatos y vuelve a correr.')
        raise SystemExit(1)

    sql = (
        'SELECT FORMAT_DATE("%%Y-%%m", DATE(%(f)s)) AS mes,\n'
        '       COUNT(DISTINCT %(s)s) AS sedes_activas,\n'
        '       SUM(%(p)s) AS wp_entregados\n'
        'FROM `%(pr)s.%(ds)s.wellipoints_historico`\n'
        'WHERE %(f)s IS NOT NULL\n'
        'GROUP BY mes ORDER BY mes'
    ) % {'f': cF, 's': cS, 'p': cP, 'pr': PROY, 'ds': DS}
    entregados = lib.bq(sql, project=PROY)

    # redenciones
    redim = {}
    canj = esq.get('wp_canjeos_solicitados')
    if canj:
        kF = elegir(canj, CAND_FECHA)
        kP = elegir(canj, CAND_PUNTOS)
        print('MAPEO wp_canjeos_solicitados -> fecha=%s | puntos=%s' % (kF, kP))
        if kF and kP:
            rc = lib.bq(
                'SELECT FORMAT_DATE("%%Y-%%m", DATE(%s)) AS mes, SUM(%s) AS wp\n'
                'FROM `%s.%s.wp_canjeos_solicitados`\n'
                'WHERE %s IS NOT NULL GROUP BY mes' % (kF, kP, PROY, DS, kF),
                project=PROY)
            for f in rc:
                redim[f['mes']] = float(f['wp'] or 0)

    filas = [['mes', 'sedes_habilitadas', 'sedes_activas', 'wp_entregados', 'wp_redimidos']]
    for f in entregados:
        mes = f['mes']
        filas.append([mes, '', int(float(f['sedes_activas'] or 0)),
                      round(float(f['wp_entregados'] or 0)),
                      '' if mes not in redim else round(redim[mes])])

    json.dump({'WP_BQ': filas}, io.open('tables_wp.json', 'w', encoding='utf8'),
              ensure_ascii=False)
    print('\nWP_BQ: %d meses' % (len(filas) - 1))
    for r in filas:
        print('  ' + ' | '.join(str(x) for x in r))
