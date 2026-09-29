import lib, json, io, time

PROPS = [
 # identidad
 'nombre_sede','id_internal','origen','clasificacion_aliado','ranking','grupo_long_tail','ciudad_municipio',
 'hs_pipeline','hs_pipeline_stage','asesor_comercial','hs_createdate','fecha_de_creacion',
 # fechas de ciclo de vida (eventos fechados -> filtrables)
 'fecha_entrada_pipeline_actual','fecha_entrada_auto','fecha_entrada_farmer','cs_fecha_entrada',
 'fecha_entrada_capm','fecha_reactivacion_muertos','fecha_de_reactivacion','cambio_pipeline',
 'fecha_primer_contacto','fecha_primera_capacitacion','fecha_segunda_capacitacion','fecha_capacitado',
 'fecha_graduacion_farmer','fecha_a_exitoso_cs','cs_fecha_exitosa_real','fecha_inicio_farming',
 'fecha_primera_firma_auto','fecha_bienvenida_auto','fecha_ultimaapp','fecha_ultima_aplicacion',
 'fecha_ultimo_desembolso','fecha_salida_auto','fecha_salida_cs','ultimo_wp_ganado_fecha','fecha_de_visita',
 # volumen
 'aplicaciones','total_aprobados','desembolsos','apps_sede_actual','apps_semana_actual',
 'desembolsos_mes_actual','desembolsos_semana_actual',
 'total_aprobados_ultimos_30_dias','total_aprobados_ultimos_60_dias',
 'total_de_desembolsos_ultimos_30_dias','total_de_desembolsos_ultimos_60_dias',
 'aprobados_no_firmados','total_aprobados_no_firmados_ultimos_30_dias',
 'total_aprobados_no_firmados_ultimos_60_dias','dias_desde_ultima_app',
 # montos
 'monto_desembolsado_mes','monto_total_desembolsado','valor_desembolsos','promedio_montos_desembolsados_4m',
 # welli points
 'puntos','wp_ganado_acumulado_mes','wp_ofrecido_acumulado_mes','wp_pendiente_actual','valor_puntos',
 'no_aplica_wp','ultimo_wp_ganado_monto',
 # marketing / long tail (atribucion)
 'audiencia_long_tail','lt_ultima_pieza','lt_ultimo_canal','lt_ultimo_cluster_envio','lt_ultimo_envio_fecha',
 'estado_comunicaciones','auto_bucket','alert_level','alerta','desea_seguir_recibiendo_comunicaciones',
 'correo_bienvenida','correo_1app','correo_2app','correo_3app','bienvenida_auto','video_desembolso',
 # reactivacion / resucitado
 'resucitado___de_apps','resucitado___de_desembolsos','resucitado_solicitudes_aprobadas',
 'monto_aprobado_after_resucitado',
 # customer success
 'cs_apps_total_bq','cs_firmas_total_bq','cs_hizo_1app','cs_exitosa_real','cs_dias_a_1app',
 # visitas
 'visita_recibida','primera_visita']

def pull_all():
    rows, after, page = [], None, 0
    while True:
        args = {'objectType':'2-50958246','limit':100,'properties':PROPS,
                'filterGroups':[{'filters':[{'propertyName':'hs_object_id','operator':'GTE','value':'0'}]}]}
        if after: args['after'] = after
        for attempt in range(4):
            try:
                r = lib.ex('HUBSPOT_SEARCH_CRM_OBJECTS_BY_CRITERIA', args)
                if r.get('successful', r.get('successfull')): break
                print('  retry', str(r.get('error'))[:120]); time.sleep(3)
            except Exception as e:
                print('  exc', str(e)[:120]); time.sleep(3)
        else:
            raise RuntimeError('failed page')
        d = r['data']
        res = d.get('results') or []
        for o in res:
            p = dict(o.get('properties') or {})
            p['id'] = o.get('id')
            rows.append(p)
        page += 1
        pg = d.get('paging') or {}
        after = (pg.get('next') or {}).get('after')
        print(f'  page {page}: +{len(res)} total {len(rows)} after={after}')
        if not after or not res: break
    return rows

if __name__ == '__main__':
    rows = pull_all()
    json.dump(rows, io.open('sedes_raw.json','w',encoding='utf8'), ensure_ascii=False)
    print('SAVED', len(rows))
