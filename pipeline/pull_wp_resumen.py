# -*- coding: utf-8 -*-
"""WP_RESUMEN: saldo_canjeable/lifetime_pts/canjeado_total por sede, desde
welli-growth.wp_data.wp_resumen_semanal -- la query "oficial" que usa
Emmanuel para ver que WP tiene cada sede LISTOS PARA CANJEAR en la
plataforma real.

Por que esto reemplaza a wp_pendiente_actual (wp_incentivos_diario) para
el KPI "Puntos ganados sin reclamar": ese campo mide algo DISTINTO -- lo
prometido y NO GANADO todavia de una campana de incentivos especifica
(con_oferta/wp_ofrecido), no el saldo YA GANADO y sin canjear. Los dos
numeros dan una magnitud parecida hoy (54.645 vs 54.657) por coincidencia,
no porque sean la misma cosa -- exactamente el mismo tipo de error que ya
se documento en CLAUDE.md seccion 29 (WP_SEDE_MES vs WP_PTS_SEDE_MES).
Emmanuel encontro esto pidiendo comparar contra su propia query oficial.

saldo_canjeable = GREATEST(lifetime_pts - canjeado_total, 0), donde
lifetime_pts = wellipoints_historico + wp_ajustes_manuales +
wellipoints_snapshot(mes actual), y canjeado_total = SUM(pts_solicitados
de wp_canjeos_solicitados WHERE descontado_wp) -- todo esto ya viene
resuelto en wp_resumen_semanal, no hay que rearmarlo aca."""
import lib, json, io, sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

filas = lib.bq("""
SELECT id_sede, saldo_canjeable, lifetime_pts, canjeado_total, nivel
FROM `welli-growth.wp_data.wp_resumen_semanal`
""", project='welli-data')

T = {'WP_RESUMEN': [['id_sede', 'saldo_canjeable', 'lifetime_pts', 'canjeado_total', 'nivel']] +
     [[r['id_sede'], int(r['saldo_canjeable']), int(r['lifetime_pts']),
       int(r['canjeado_total']), r['nivel']] for r in filas]}

print('sedes:', len(filas))
print('suma saldo_canjeable:', sum(int(r['saldo_canjeable']) for r in filas))
print('suma lifetime_pts:', sum(int(r['lifetime_pts']) for r in filas))
print('suma canjeado_total:', sum(int(r['canjeado_total']) for r in filas))

json.dump(T, io.open('tables_wp_resumen.json', 'w', encoding='utf8'), ensure_ascii=False)
print('escrito tables_wp_resumen.json')
