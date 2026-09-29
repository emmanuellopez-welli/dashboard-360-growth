# -*- coding: utf-8 -*-
"""Login diario por sede (18-sep-2026, pedido: agregar barras de plata
desembolsada al grafico "Sedes que entran, por dia"). WP_LOGIN_SEDES ya
tenia el PRIMER login por sede, pero no todos los dias que cada una entro
-- eso es lo que hace falta para saber, dia por dia, cuales sedes entraron
y cruzarlas contra su desembolso de ESE dia."""
import lib, json, io, sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
T = {}

filas = lib.bq("""
SELECT CAST(DATE(timestamp) AS STRING) AS fecha, sede_id AS id_sede
FROM `welli-growth.wp_data.wp_dashboard_visitas`
GROUP BY fecha, id_sede
""", project='welli-data')
T['WP_LOGIN_DIA'] = [['fecha', 'id_sede']] + [[r['fecha'], r['id_sede']] for r in filas]
print('filas dia x sede:', len(filas))
print('dias distintos:', len(set(r['fecha'] for r in filas)))

json.dump(T, io.open('tables_wp_login_dia.json', 'w', encoding='utf8'), ensure_ascii=False)
print('escrito tables_wp_login_dia.json')
