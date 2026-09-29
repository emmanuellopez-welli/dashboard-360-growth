# -*- coding: utf-8 -*-
"""Correccion 18-sep-2026: el grafico "WP ganados vs plata desembolsada"
usaba WP_SEDE_MES (de wp_incentivos_diario.wp_ganado_mes), que es una
CAMPANA DE INCENTIVOS especifica (con oferta/vencimiento), no los puntos
que gana TODA la base por desembolsar -- por eso el numero salia
ridiculamente chico (250-435 pts/mes) contra $8-14 mil M desembolsados.
Emmanuel lo noto a ojo: "son muy pocos wellipoints ganados".

La fuente correcta es wp_desembolsos_snapshot.pts_ganados: un punto por
desembolso, ya calculado con la tabla de tramos B1 sobre monto_aprobado
(la misma que describe el contexto original de Welli Points). Se agrega
por mes de fecha_firma_contrato (la fecha real del desembolso) Y por
id_sede, en vez de un solo total mensual -- sin el desglose de sede el
filtro global de origen/rol no podria morder esta serie igual que muerde
la de plata desembolsada, y las dos terminarian midiendo universos
distintos en el mismo grafico (mismo error que ya se corrigio una vez en
wpCruceLogin_, ver CLAUDE.md seccion 25)."""
import lib, json, io, sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
T = {}

filas = lib.bq("""
SELECT FORMAT_DATE('%Y-%m', fecha_firma_contrato) AS mes,
       IFNULL(id_sede, '') AS id_sede,
       SUM(pts_ganados) AS pts
FROM `welli-growth.wp_data.wp_desembolsos_snapshot`
WHERE fecha_firma_contrato IS NOT NULL
GROUP BY mes, id_sede
""", project='welli-data')
T['WP_PTS_SEDE_MES'] = [['mes', 'id_sede', 'pts']] + [
    [r['mes'], r['id_sede'], int(r['pts'])] for r in filas
]
print('filas mes x sede:', len(filas))
tot = {}
for r in filas:
    tot[r['mes']] = tot.get(r['mes'], 0) + int(r['pts'])
print('total por mes:', tot)

json.dump(T, io.open('tables_wp_pts_mes.json', 'w', encoding='utf8'), ensure_ascii=False)
print('escrito tables_wp_pts_mes.json')
