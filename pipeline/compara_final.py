# -*- coding: utf-8 -*-
import io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

jefa = {
'2026-09': {'Activo':1260,'Inactivo':819,'Muerto':1218,'Nuevo con apps':41,'Nuevo sin apps':99},
'2026-08': {'Activo':1325,'Inactivo':685,'Muerto':1104,'Nuevo con apps':72,'Nuevo sin apps':115},
'2026-07': {'Activo':1331,'Inactivo':602,'Muerto':1019,'Nuevo con apps':66,'Nuevo sin apps':96},
'2026-06': {'Activo':1215,'Inactivo':589,'Muerto':971,'Nuevo con apps':69,'Nuevo sin apps':108},
'2026-05': {'Activo':1142,'Inactivo':572,'Muerto':888,'Nuevo con apps':68,'Nuevo sin apps':105},
'2026-04': {'Activo':1034,'Inactivo':601,'Muerto':774,'Nuevo con apps':87,'Nuevo sin apps':106},
}
nuestro = {
'2026-09': {'activas':3222,'recientes':1582,'inactivas':619,'muertas':1021},
'2026-08': {'activas':3096,'recientes':1415,'inactivas':678,'muertas':1003},
'2026-07': {'activas':2933,'recientes':1442,'inactivas':565,'muertas':926},
'2026-06': {'activas':2765,'recientes':1354,'inactivas':533,'muertas':878},
'2026-05': {'activas':2611,'recientes':1282,'inactivas':529,'muertas':800},
'2026-04': {'activas':2442,'recientes':1187,'inactivas':554,'muertas':701},
}

print('%-8s %14s %14s %10s   %12s %12s %10s' % (
  'mes','activo+nuevo_c/a (=recientes+nuevos)','vs nuestras recientes','dif','ella Inactivo','nuestras inactivas','dif'))
for m in sorted(jefa, reverse=True):
    j = jefa[m]; n = nuestro[m]
    activasJefa = j['Activo'] + j['Inactivo'] + j['Muerto'] + j['Nuevo con apps']
    print('\n=== %s ===' % m)
    print('  "alguna vez aplico"   ella=%d (Activo+Inactivo+Muerto+NuevoConApps)  nuestra=%d (activas acum)  dif=%d (%.1f%%)' % (
        activasJefa, n['activas'], activasJefa - n['activas'], 100.0*(activasJefa-n['activas'])/n['activas']))
    print('  "reciente <30d"       ella=%d (Activo+NuevoConApps)  nuestra=%d (recientes)  dif=%d' % (
        j['Activo']+j['Nuevo con apps'], n['recientes'], j['Activo']+j['Nuevo con apps']-n['recientes']))
    print('  "inactivo 30-90d"     ella=%d  nuestra=%d  dif=%d' % (j['Inactivo'], n['inactivas'], j['Inactivo']-n['inactivas']))
    print('  "muerto >90d"         ella=%d  nuestra=%d  dif=%d' % (j['Muerto'], n['muertas'], j['Muerto']-n['muertas']))
