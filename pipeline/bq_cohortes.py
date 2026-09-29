# -*- coding: utf-8 -*-
"""
Plata firmada por sede y por mes, para las tablas de cosecha.

Fuente: welli-data.data_ops.t_solicitudes  (TERCER proyecto, distinto de
welli-tecnologia y welli-growth).
 - el mes es la FECHA DE FIRMA (fecha_firma_contrato), no la de radicacion
 - el monto es monto_aprobado
 - la llave de sede es id_sede, que en HubSpot es la propiedad id_internal
   (un UUID)

La query que paso el usuario tenia el filtro de estado con puntos
suspensivos, asi que primero se listan los valores reales de estado_final
y de ahi se decide. No se asume.
"""
import lib, json, io, collections

PROY = 'welli-data'
TABLA = 'welli-data.data_ops.t_solicitudes'


def inspeccionar():
    print('--- columnas de t_solicitudes ---')
    cols = lib.bq(
        "SELECT column_name, data_type FROM "
        "`welli-data.data_ops.INFORMATION_SCHEMA.COLUMNS` "
        "WHERE table_name = 't_solicitudes' ORDER BY ordinal_position",
        project=PROY)
    for c in cols:
        print('   %-34s %s' % (c['column_name'], c['data_type']))

    print()
    print('--- valores de estado_final (solo firmados) ---')
    est = lib.bq(
        'SELECT estado_final, COUNT(*) AS n, SUM(monto_aprobado) AS monto '
        'FROM `%s` WHERE fecha_firma_contrato IS NOT NULL '
        'GROUP BY estado_final ORDER BY n DESC' % TABLA, project=PROY)
    for e in est:
        print('   %-34s %8s  $%s' % (e['estado_final'], e['n'],
              format(int(float(e['monto'] or 0)), ',').replace(',', '.')))
    return [e['estado_final'] for e in est]


def plata(estados):
    lista = ', '.join("'" + e.replace("'", "") + "'" for e in estados)
    sql = (
        "SELECT id_sede,\n"
        "       FORMAT_DATE('%%Y-%%m', DATE_TRUNC(fecha_firma_contrato, MONTH)) AS mes,\n"
        "       COUNT(*) AS desembolsos,\n"
        "       SUM(monto_aprobado) AS monto\n"
        "FROM `%s`\n"
        "WHERE fecha_firma_contrato IS NOT NULL\n"
        "  AND id_sede IS NOT NULL\n"
        "  AND estado_final IN (%s)\n"
        "GROUP BY 1, 2" % (TABLA, lista)
    )
    print()
    print('--- corriendo la agregacion por sede x mes ---')
    filas = lib.bq(sql, project=PROY)
    print('   %d filas (sede x mes)' % len(filas))
    return filas


if __name__ == '__main__':
    try:
        estados = inspeccionar()
    except Exception as e:
        print('NO HAY ACCESO A %s todavia:' % PROY)
        print('   ' + str(e)[:400])
        raise SystemExit(1)

    # estado_final mezcla varios vocabularios. Los tres que representan un
    # desembolso efectivo, confirmados contra los valores reales:
    #   desembolsado / Convertido Total / credito en firme
    # Alternativa mas amplia: desembolso = 'Desembolsado' (48.212 creditos,
    # $202.993.070.243) que suma 2.051 creditos y $10.276.093.263 mas, pero
    # incluye filas cuyo estado_final dice rechazado, fraud o No Convertido.
    # Se usa la lectura literal de la query del usuario, que es la conservadora.
    candidatos = ['desembolsado', 'Convertido Total', 'credito en firme']
    print()
    print('estados usados como desembolso: %s' % candidatos)

    filas = plata(candidatos)
    salida = [['id_sede', 'mes', 'desembolsos', 'monto']]
    for f in filas:
        salida.append([f['id_sede'], f['mes'],
                       int(float(f['desembolsos'] or 0)),
                       round(float(f['monto'] or 0))])
    json.dump({'PLATA_SEDE_MES': salida, 'estados': candidatos},
              io.open('tables_plata_mes.json', 'w', encoding='utf8'), ensure_ascii=False)

    por_mes = collections.Counter()
    for x in salida[1:]:
        por_mes[x[1]] += x[3]
    print()
    print('monto firmado por mes:')
    for m in sorted(por_mes):
        print('   %s  $%s' % (m, format(int(por_mes[m]), ',').replace(',', '.')))
