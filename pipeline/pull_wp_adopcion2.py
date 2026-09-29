# -*- coding: utf-8 -*-
"""Segunda pasada de adopcion de WelliPoints (18-sep-2026), pedida por
Emmanuel despues de rechazar el enfoque causal (canje) del primer rediseno.
Lo que pide ahora es mas directo: sedes habilitadas, cuantas inician
sesion, y CRUZAR eso contra el comportamiento de desembolso -- sin el
aparato de control/placebo/intervalo de confianza de la version anterior.

Lo unico que faltaba para eso es el listado COMPLETO de sedes con su
primer login (wp_dashboard_visitas ya se pulleaba, pero solo agregado por
mundo/tendencia/top-20 -- nunca la lista entera por sede, que es la que
hace falta para saber, sede por sede, quien esta en el grupo "con login"
al cruzar contra CREDITO_DIA)."""
import lib, json, io, sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
T = {}

# timestamp llega de BigQuery como epoch-seconds via la API REST (columna
# TIMESTAMP), no como texto -- CAST a DATE en la query, no en Python, para
# no andar adivinando el formato del float.
sedes = lib.bq("""
SELECT sede_id AS id_sede,
       CAST(MIN(DATE(timestamp)) AS STRING) AS primer_login,
       COUNT(*) AS visitas
FROM `welli-growth.wp_data.wp_dashboard_visitas`
GROUP BY sede_id
""", project='welli-data')
T['WP_LOGIN_SEDES'] = [['id_sede', 'primer_login', 'visitas']] + [
    [r['id_sede'], r['primer_login'], int(r['visitas'])] for r in sedes
]
print('sedes con login:', len(sedes))
print('muestra:', T['WP_LOGIN_SEDES'][:3])

json.dump(T, io.open('tables_wp_login_sedes.json', 'w', encoding='utf8'), ensure_ascii=False)
print('escrito tables_wp_login_sedes.json')
