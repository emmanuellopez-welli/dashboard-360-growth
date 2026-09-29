# -*- coding: utf-8 -*-
"""Universo completo de sedes habilitadas en WelliPoints (18-sep-2026),
por sede -- hasta ahora solo se tenia el KPI agregado (WP_ADOPCION_KPI).
Hace falta la lista completa para poder separar, sede por sede, quien esta
en el grupo "con login" y quien en "sin login" y cruzar cada grupo contra
CREDITO_DIA. wellipoints_snapshot es un snapshot del mes en curso (se
reconstruye a diario), asi que esta es la foto de HOY del universo."""
import lib, json, io, sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
T = {}

hab = lib.bq("""
SELECT DISTINCT id_sede
FROM `welli-growth.wp_data.wellipoints_snapshot`
WHERE id_sede IS NOT NULL AND id_sede != ''
""", project='welli-data')
T['WP_HABILITADAS'] = [['id_sede']] + [[r['id_sede']] for r in hab]
print('sedes habilitadas:', len(hab))

json.dump(T, io.open('tables_wp_habilitadas.json', 'w', encoding='utf8'), ensure_ascii=False)
print('escrito tables_wp_habilitadas.json')
