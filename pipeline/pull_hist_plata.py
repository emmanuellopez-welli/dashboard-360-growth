# -*- coding: utf-8 -*-
"""
RESCATE_HIST_PLATA: la plata de la operacion VIEJA de rescate (oct-2024 a
jul-2026), reconstruida.

gestion_historica (la fuente de RESCATE_HIST) no trae monto -- pero SI trae
'documento' y 'marcado_firma_credito'. Cruzando esos documentos contra
t_sol_v2 (que si tiene monto_aprobado y fecha_firma_contrato), se
reconstruye cuanto se desemboLso realmente por esos casos, mes a mes.

Verificado el 8-sep-2026: 887 documentos marcados como firmados en
gestion_historica, 882 existen en t_sol_v2, 878 con fecha_firma_contrato y
monto_aprobado reales. $5.045 M reconstruidos entre oct-2024 y jul-2026.

OJO: el mes aca es el de fecha_firma_contrato (cuando el credito realmente
se firmo), NO el de fecha_seguimiento de gestion_historica (que ademas
viene NULL en la mayoria de estas filas). Es un mes ligeramente distinto al
que usa RESCATE_HIST para 'casos'/'firmas' (ese es el mes de LA GESTION, no
de la firma) -- son las dos fechas mas cercanas a la realidad que hay en
cada fuente, declarado por si algun mes no cuadra exacto entre las dos
tablas.
"""
import io
import json
import collections

import lib


def main():
    firmados = lib.bq("""
      SELECT DISTINCT documento
      FROM `welli-growth.rescate.gestion_historica`
      WHERE tiene_gestion = 'True' AND marcado_firma_credito = TRUE
    """, project='welli-data', location='US')
    docs = [r['documento'] for r in firmados if r['documento']]
    print('documentos marcados como firmados en gestion_historica:', len(docs))

    sol = {}
    LOTE = 500
    for i in range(0, len(docs), LOTE):
        lote = docs[i:i + LOTE]
        lista = ','.join("'%s'" % d.replace("'", "") for d in lote)
        rows = lib.bq("""
          SELECT documento, monto_aprobado, fecha_firma_contrato
          FROM `welli-data.comercial_ops.t_sol_v2`
          WHERE documento IN (%s)
        """ % lista, project='welli-data')
        for r in rows:
            d = r['documento']
            if d not in sol or (r['fecha_firma_contrato'] and not sol[d].get('fecha_firma_contrato')):
                sol[d] = r

    print('encontrados en t_sol_v2:', len(sol))
    sin_cruce = len(docs) - len(sol)

    por_mes_monto = collections.Counter()
    por_mes_casos = collections.Counter()
    sin_fecha_o_monto = 0
    for r in sol.values():
        f = r.get('fecha_firma_contrato')
        m = r.get('monto_aprobado')
        if not f or not m:
            sin_fecha_o_monto += 1
            continue
        mes = str(f)[:7]
        por_mes_monto[mes] += float(m)
        por_mes_casos[mes] += 1

    print('sin cruce en t_sol_v2:', sin_cruce)
    print('cruzados pero sin fecha_firma_contrato o monto:', sin_fecha_o_monto)

    cab = ['mes', 'casos_firmados', 'monto_reconstruido']
    filas = [cab]
    for mes in sorted(por_mes_monto):
        filas.append([mes, por_mes_casos[mes], round(por_mes_monto[mes])])

    T = {'RESCATE_HIST_PLATA': filas}
    json.dump(T, io.open('tables_hist_plata.json', 'w', encoding='utf8'),
              ensure_ascii=False)
    print('\nmeses con plata reconstruida:', len(filas) - 1)
    print('total reconstruido:', round(sum(por_mes_monto.values())))
    for f in filas[1:]:
        print(' ', f)


if __name__ == '__main__':
    main()
