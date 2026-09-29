# -*- coding: utf-8 -*-
"""
Embudo de credito SOLO de las sedes que trajo marketing.

El tablero es de MARKETING, no del negocio. El embudo global (59.099
solicitudes, $38,3 mil M) es de todas las sedes; marketing no trajo el
96,5% de eso. Aca se filtra a las sedes cuyo origen es uno de los cuatro
canales que marketing genera, pasandole la lista de UUID a la query.

Mapeo de estado_final (los valores reales, que mezclan vocabularios):
  Rechazado   rechazado / Rechazado / fraud
  Aprobado    not_taken / Aprobado Motor / aprobado no firmado / No Convertido
  Convertido  desembolsado / Convertido Total / credito en firme / firmado por validar
  (fuera)     No solicitado — nunca llego a ser solicitud
"""
import lib, json, io, collections

RECHAZADO = ['rechazado', 'Rechazado', 'fraud']
APROBADO = ['not_taken', 'Aprobado Motor', 'aprobado no firmado', 'No Convertido']
CONVERTIDO = ['desembolsado', 'Convertido Total', 'credito en firme', 'firmado por validar']
FUERA = ['No solicitado']

MKT = {'Eventos', 'Referidos', 'Pagina web', 'Social media'}


def lista_sql(vals):
    return ', '.join("'" + str(v).replace("'", "") + "'" for v in vals)


def ids_marketing():
    T = json.load(io.open('tables.json', encoding='utf8'))
    h = T['SEDES'][0]
    iId, iOB = h.index('id_internal'), h.index('origen_bucket')
    ids = [str(r[iId]) for r in T['SEDES'][1:]
           if r[iOB] in MKT and str(r[iId] or '').strip()]
    return sorted(set(ids))


def pull(ids):
    sql = (
        "SELECT corte_dia_solicitud AS fecha,\n"
        "       COUNT(*) AS solicitudes,\n"
        "       COUNTIF(estado_final IN (" + lista_sql(APROBADO + CONVERTIDO) + ")) AS aprobados,\n"
        "       COUNTIF(estado_final IN (" + lista_sql(CONVERTIDO) + ")) AS desembolsados,\n"
        "       SUM(IF(estado_final IN (" + lista_sql(CONVERTIDO) + "), monto_aprobado, 0)) AS monto\n"
        "FROM `welli-data.data_ops.t_solicitudes`\n"
        "WHERE corte_dia_solicitud IS NOT NULL\n"
        "  AND estado_final NOT IN (" + lista_sql(FUERA) + ")\n"
        "  AND id_sede IN (" + lista_sql(ids) + ")\n"
        "GROUP BY fecha ORDER BY fecha"
    )
    return lib.bq(sql, project='welli-data')


def pull_global():
    """El mismo embudo sin filtro de sede, solo para poder decir que
    fraccion del negocio representa marketing."""
    sql = (
        "SELECT COUNT(*) AS solicitudes,\n"
        "       COUNTIF(estado_final IN (" + lista_sql(APROBADO + CONVERTIDO) + ")) AS aprobados,\n"
        "       COUNTIF(estado_final IN (" + lista_sql(CONVERTIDO) + ")) AS desembolsados,\n"
        "       SUM(IF(estado_final IN (" + lista_sql(CONVERTIDO) + "), monto_aprobado, 0)) AS monto\n"
        "FROM `welli-data.data_ops.t_solicitudes`\n"
        "WHERE corte_dia_solicitud IS NOT NULL\n"
        "  AND estado_final NOT IN (" + lista_sql(FUERA) + ")"
    )
    return lib.bq(sql, project='welli-data')[0]


def n(v):
    try:
        return float(v)
    except Exception:
        return 0.0


def cop(x):
    return '$' + format(int(x), ',').replace(',', '.')


if __name__ == '__main__':
    ids = ids_marketing()
    print('sedes de origen marketing con id_internal: %d' % len(ids))

    filas = pull(ids)
    tabla = [['fecha', 'solicitudes', 'aprobados', 'desembolsados', 'monto']]
    for f in filas:
        tabla.append([str(f['fecha'])[:10], int(n(f['solicitudes'])), int(n(f['aprobados'])),
                      int(n(f['desembolsados'])), round(n(f['monto']))])
    json.dump({'EMBUDO_MKT': tabla},
              io.open('tables_embudo_mkt.json', 'w', encoding='utf8'), ensure_ascii=False)

    print()
    print('EMBUDO DE MARKETING por mes (agregado desde el diario):')
    print('  mes       solicit  aprob  desemb            monto')
    porMes = collections.defaultdict(lambda: [0, 0, 0, 0.0])
    ts = ta = td = 0
    tm = 0.0
    for r in tabla[1:]:
        b = porMes[r[0][:7]]
        b[0] += r[1]; b[1] += r[2]; b[2] += r[3]; b[3] += r[4]
        ts += r[1]; ta += r[2]; td += r[3]; tm += r[4]
    for m in sorted(porMes):
        b = porMes[m]
        print('  %-9s %7d %6d %7d %16s' % (m, b[0], b[1], b[2], cop(b[3])))
    print('  %-9s %7d %6d %7d %16s' % ('TOTAL', ts, ta, td, cop(tm)))
    if ts:
        print('  tasa aprobacion %.1f%%  |  tasa conversion %.1f%%'
              % (100.0 * ta / ts, 100.0 * td / ts))

    g = pull_global()
    gs, gm = int(n(g['solicitudes'])), n(g['monto'])
    print()
    print('CONTRA EL NEGOCIO COMPLETO:')
    print('  solicitudes: %d de %d  (%.1f%%)' % (ts, gs, 100.0 * ts / gs if gs else 0))
    print('  monto      : %s de %s  (%.1f%%)' % (cop(tm), cop(gm),
          100.0 * tm / gm if gm else 0))
