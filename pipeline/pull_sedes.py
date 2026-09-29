# -*- coding: utf-8 -*-
"""
Re-jala SEDES en vivo de HubSpot. Equivale a refreshHubSpotSedes() de Apps
Script y reproduce EXACTAMENTE el contrato de columnas de tablaSedes_ para
que Code.gs no se entere del cambio.

Por que hace falta: el refresh de HubSpot Sedes corrio por ultima vez el
31-ago-2026 y la hoja quedo 3 dias atras. Eso dejo 140 sedes fuera del Excel
de cosechas: 133 que no existian en la hoja y 7 cuyo id_internal se lleno
despues (entre ellas Dra Martha Cardona, cuyo UUID entro el 1-sep 13:52).

Agrega DOS columnas nuevas al final, sin mover ninguna existente:
  fecha_entrada_farmer   el traspaso a Farmer, segun HubSpot
  cs_fecha_entrada       la entrada a Customer Success
Son las que necesita la conciliacion con BI: la atribucion se corta en el
traspaso real de cada sede, no en el M2 de un reloj compartido.
"""
import io
import json

import lib

HS = 'ca_13P0RgH6oZrv'
OBJ = '2-50958246'

HS_PROPS = [
    'nombre_sede', 'id_internal', 'origen', 'clasificacion_aliado', 'ranking',
    'grupo_long_tail', 'ciudad_municipio', 'hs_pipeline', 'hs_pipeline_stage',
    'asesor_comercial', 'hs_createdate', 'fecha_entrada_pipeline_actual',
    'fecha_entrada_auto', 'fecha_entrada_farmer', 'cs_fecha_entrada',
    # La salida de CS acordada con BI. Es la unica limpia de las tres
    # candidatas: solo 0,9% de las sedes que NUNCA entraron a CS la traen
    # llena, contra 81,3% de fecha_salida_cs y 92,9% de
    # fecha_entrada_farmer, que por eso miden otra cosa.
    'fecha_salida_pipeline_cs',
    'fecha_entrada_capm', 'fecha_reactivacion_muertos',
    'fecha_de_reactivacion', 'fecha_primer_contacto',
    'fecha_primera_capacitacion', 'fecha_segunda_capacitacion',
    'fecha_capacitado', 'cs_fecha_exitosa_real', 'fecha_primera_firma_auto',
    'fecha_ultimaapp', 'fecha_ultima_aplicacion', 'fecha_ultimo_desembolso',
    'ultimo_wp_ganado_fecha', 'fecha_de_visita', 'aplicaciones',
    'total_aprobados', 'desembolsos', 'apps_sede_actual',
    'desembolsos_mes_actual', 'total_aprobados_ultimos_30_dias',
    'total_aprobados_ultimos_60_dias', 'total_de_desembolsos_ultimos_30_dias',
    'total_de_desembolsos_ultimos_60_dias', 'aprobados_no_firmados',
    'total_aprobados_no_firmados_ultimos_30_dias',
    'total_aprobados_no_firmados_ultimos_60_dias', 'dias_desde_ultima_app',
    'monto_total_desembolsado', 'monto_desembolsado_mes',
    'promedio_montos_desembolsados_4m', 'puntos', 'wp_ganado_acumulado_mes',
    'wp_ofrecido_acumulado_mes', 'wp_pendiente_actual', 'valor_puntos',
    'no_aplica_wp', 'ultimo_wp_ganado_monto', 'audiencia_long_tail',
    'lt_ultima_pieza', 'estado_comunicaciones', 'auto_bucket', 'alert_level',
    'resucitado___de_apps', 'resucitado___de_desembolsos',
    'resucitado_solicitudes_aprobadas', 'monto_aprobado_after_resucitado',
    'cs_apps_total_bq', 'cs_firmas_total_bq', 'cs_hizo_1app',
    'cs_exitosa_real', 'cs_dias_a_1app', 'visita_recibida',
]

ORIGEN_BUCKET = {'EVENTO': 'Eventos', 'REFERIDO': 'Referidos',
                 'PAGINA WEB': 'Pagina web', 'SOCIAL MEDIA': 'Social media'}

HEAD = ['id', 'id_internal', 'nombre_sede', 'pipeline', 'etapa', 'origen',
        'origen_bucket', 'clasificacion_aliado', 'ranking', 'grupo_long_tail',
        'ciudad_municipio', 'asesor_comercial', 'audiencia_long_tail',
        'lt_ultima_pieza', 'estado_comunicaciones', 'auto_bucket',
        'alert_level', 'fecha_entrada_pipeline_actual', 'fecha_ultima_app',
        'fecha_ultimo_desembolso', 'fecha_capacitado', 'cosecha',
        'aplicaciones', 'total_aprobados', 'desembolsos', 'apps_mes_actual',
        'desembolsos_mes_actual', 'aprobados_no_firmados',
        'aprob_no_firmados_30d', 'aprob_no_firmados_60d', 'aprobados_30d',
        'aprobados_60d', 'desembolsos_30d', 'desembolsos_60d',
        'dias_desde_ultima_app', 'monto_total_desembolsado',
        'monto_desembolsado_mes', 'ticket_promedio_4m', 'puntos',
        'wp_ganado_mes', 'wp_ofrecido_mes', 'wp_pendiente', 'valor_puntos',
        'aplica_wp_raw', 'resu_apps', 'resu_desembolsos', 'resu_aprobados',
        'monto_aprobado_post_resu', 'cs_apps_bq', 'cs_firmas_bq',
        'cs_hizo_1app', 'cs_exitosa', 'cs_dias_a_1app', 'visita_recibida',
        # nuevas, al final para no mover nada
        'fecha_entrada_farmer', 'cs_fecha_entrada', 'fecha_creacion',
        'salida_cs']


def proxy(ep, method='GET', body=None):
    kw = dict(endpoint=ep, method=method, connected_account_id=HS)
    if body is not None:
        kw['body'] = body
    r = lib.C.tools.proxy(**kw)
    d = getattr(r, 'data', r)
    if isinstance(d, str):
        d = json.loads(d)
    if isinstance(d, dict) and d.get('status') == 'error':
        raise RuntimeError('HubSpot: ' + str(d.get('message'))[:200])
    return d


def n_(v):
    try:
        return float(v) if v not in ('', None) else 0
    except (TypeError, ValueError):
        return 0


def fecha(v):
    return str(v or '')[:10]


def bucket(o):
    if not o:
        return 'Sin origen'
    return ORIGEN_BUCKET.get(str(o).strip().upper(), 'Otros origenes')


# Eventos fechados del ciclo de vida, igual que HS_EVENTOS en
# Fuentes_HubSpot.gs -- se reconstruye aca (10-sep-2026) porque
# SEDES_EVENTOS es la otra fuente que solo se refrescaba con el trigger de
# Apps Script y llevaba 10 dias de atraso. Se arma sobre los MISMOS `sedes`
# que ya bajo pull_sedes.py, sin un segundo viaje a HubSpot.
HS_EVENTOS = [
    ('fecha_entrada_pipeline_actual', 'Entrada a pipeline actual', 'ciclo'),
    ('fecha_entrada_auto', 'Entrada a Autogestionados', 'ciclo'),
    ('fecha_entrada_farmer', 'Entrada a Farmer', 'ciclo'),
    ('cs_fecha_entrada', 'Entrada a Customer Success', 'ciclo'),
    ('fecha_entrada_capm', 'Entrada a Capacitacion muertos', 'ciclo'),
    ('fecha_reactivacion_muertos', 'Reactivacion de muerta', 'reactivacion'),
    ('fecha_de_reactivacion', 'Reactivacion', 'reactivacion'),
    ('fecha_primer_contacto', 'Primer contacto', 'gestion'),
    ('fecha_primera_capacitacion', 'Primera capacitacion', 'gestion'),
    ('fecha_segunda_capacitacion', 'Segunda capacitacion', 'gestion'),
    ('fecha_capacitado', 'Capacitada', 'gestion'),
    ('cs_fecha_exitosa_real', 'CS exitosa (3 apps o 1 firma)', 'resultado'),
    ('fecha_primera_firma_auto', 'Estrena primer paciente', 'resultado'),
    ('fecha_ultimo_desembolso', 'Ultimo desembolso', 'resultado'),
    ('fecha_ultima_aplicacion|fecha_ultimaapp', 'Ultima aplicacion', 'resultado'),
    ('ultimo_wp_ganado_fecha', 'Welli Point ganado', 'welli_points'),
    ('fecha_de_visita', 'Visita comercial', 'gestion'),
    ('hs_createdate', 'Sede creada', 'ciclo'),
]


def tabla_eventos(sedes, pipes):
    filas = [['fecha', 'evento', 'categoria', 'sede_id', 'sede', 'pipeline', 'origen',
              'origen_bucket', 'clasificacion_aliado', 'audiencia_long_tail', 'asesor_comercial',
              'monto']]
    for x in sedes:
        r = x.get('properties') or {}
        origen = str(r.get('origen') or '').strip()
        base = [x.get('id') or '', r.get('nombre_sede') or '',
                pipes.get(r.get('hs_pipeline'), ''), origen, bucket(origen),
                r.get('clasificacion_aliado') or '', r.get('audiencia_long_tail') or '',
                r.get('asesor_comercial') or '']
        for prop, etiqueta, categoria in HS_EVENTOS:
            f = ''
            for nombre in prop.split('|'):
                f = fecha(r.get(nombre))
                if f:
                    break
            if not f:
                continue
            monto = 0
            if prop == 'fecha_ultimo_desembolso':
                monto = n_(r.get('monto_desembolsado_mes'))
            if prop == 'ultimo_wp_ganado_fecha':
                monto = n_(r.get('ultimo_wp_ganado_monto'))
            filas.append([f, etiqueta, categoria] + base + [monto])
    head = filas.pop(0)
    filas.sort(key=lambda x: x[0])
    return [head] + filas


def main():
    # Pipelines, para traducir los ids de pipeline y etapa a etiquetas.
    pl = proxy('/crm/v3/pipelines/' + OBJ)
    pipes, stages = {}, {}
    for p in pl.get('results') or []:
        pipes[p['id']] = p.get('label', '')
        for s in p.get('stages') or []:
            stages[s['id']] = s.get('label', '')

    # El filtro es hs_object_id GTE 0: si se filtra POR una propiedad,
    # HubSpot la excluye de la respuesta.
    body = {'filterGroups': [{'filters': [
                {'propertyName': 'hs_object_id', 'operator': 'GTE',
                 'value': '0'}]}],
            'properties': HS_PROPS, 'limit': 100}
    after, sedes = None, []
    while True:
        b = dict(body)
        if after:
            b['after'] = after
        d = proxy('/crm/v3/objects/%s/search' % OBJ, 'POST', b)
        sedes.extend(d.get('results') or [])
        after = (((d.get('paging') or {}).get('next') or {}).get('after'))
        if not after:
            break
    print('%d sedes leidas de HubSpot' % len(sedes))

    filas = [HEAD]
    for x in sedes:
        r = x.get('properties') or {}
        origen = str(r.get('origen') or '').strip()
        filas.append([
            x.get('id') or '', r.get('id_internal') or '',
            r.get('nombre_sede') or '',
            pipes.get(r.get('hs_pipeline'), r.get('hs_pipeline') or ''),
            stages.get(r.get('hs_pipeline_stage'),
                       r.get('hs_pipeline_stage') or ''),
            origen, bucket(origen),
            r.get('clasificacion_aliado') or '', r.get('ranking') or '',
            r.get('grupo_long_tail') or '', r.get('ciudad_municipio') or '',
            r.get('asesor_comercial') or '', r.get('audiencia_long_tail') or '',
            r.get('lt_ultima_pieza') or '',
            r.get('estado_comunicaciones') or '', r.get('auto_bucket') or '',
            r.get('alert_level') or '',
            fecha(r.get('fecha_entrada_pipeline_actual')),
            fecha(r.get('fecha_ultimaapp') or r.get('fecha_ultima_aplicacion')),
            fecha(r.get('fecha_ultimo_desembolso')),
            fecha(r.get('fecha_capacitado')),
            fecha(r.get('hs_createdate'))[:7],
            n_(r.get('aplicaciones')), n_(r.get('total_aprobados')),
            n_(r.get('desembolsos')), n_(r.get('apps_sede_actual')),
            n_(r.get('desembolsos_mes_actual')),
            n_(r.get('aprobados_no_firmados')),
            n_(r.get('total_aprobados_no_firmados_ultimos_30_dias')),
            n_(r.get('total_aprobados_no_firmados_ultimos_60_dias')),
            n_(r.get('total_aprobados_ultimos_30_dias')),
            n_(r.get('total_aprobados_ultimos_60_dias')),
            n_(r.get('total_de_desembolsos_ultimos_30_dias')),
            n_(r.get('total_de_desembolsos_ultimos_60_dias')),
            n_(r.get('dias_desde_ultima_app')),
            n_(r.get('monto_total_desembolsado')),
            n_(r.get('monto_desembolsado_mes')),
            n_(r.get('promedio_montos_desembolsados_4m')),
            n_(r.get('puntos')), n_(r.get('wp_ganado_acumulado_mes')),
            n_(r.get('wp_ofrecido_acumulado_mes')),
            n_(r.get('wp_pendiente_actual')), n_(r.get('valor_puntos')),
            r.get('no_aplica_wp') or '',
            n_(r.get('resucitado___de_apps')),
            n_(r.get('resucitado___de_desembolsos')),
            n_(r.get('resucitado_solicitudes_aprobadas')),
            n_(r.get('monto_aprobado_after_resucitado')),
            n_(r.get('cs_apps_total_bq')), n_(r.get('cs_firmas_total_bq')),
            r.get('cs_hizo_1app') or '', r.get('cs_exitosa_real') or '',
            n_(r.get('cs_dias_a_1app')), r.get('visita_recibida') or '',
            fecha(r.get('fecha_entrada_farmer')),
            fecha(r.get('cs_fecha_entrada')),
            fecha(r.get('hs_createdate')),   # dia completo
            fecha(r.get('fecha_salida_pipeline_cs')),
        ])

    eventos = tabla_eventos(sedes, pipes)
    print('SEDES_EVENTOS: %d filas' % (len(eventos) - 1))

    json.dump({'SEDES': filas, 'SEDES_EVENTOS': eventos},
              io.open('tables_sedes.json', 'w', encoding='utf8'),
              ensure_ascii=False)
    print('tables_sedes.json escrito: %d filas x %d columnas'
          % (len(filas) - 1, len(HEAD)))

    # Cuadre contra la hoja vieja, para ver exactamente que se gano.
    ix = {c: i for i, c in enumerate(HEAD)}
    vieja = json.load(io.open('sheet_data.json', encoding='utf8'))['SEDES']
    vi = {c: i for i, c in enumerate(vieja[0])}
    ids_v = {str(r[vi['id']]).strip() for r in vieja[1:]}
    conid_v = sum(1 for r in vieja[1:]
                  if str(r[vi['id_internal']] or '').strip())
    conid_n = sum(1 for r in filas[1:]
                  if str(r[ix['id_internal']] or '').strip())
    nuevas = [r for r in filas[1:] if str(r[ix['id']]).strip() not in ids_v]
    print('\nCUADRE contra la hoja del 31-ago')
    print('   sedes           %4d -> %4d  (%+d)'
          % (len(vieja) - 1, len(filas) - 1, len(filas) - len(vieja)))
    print('   con id_internal %4d -> %4d  (%+d)'
          % (conid_v, conid_n, conid_n - conid_v))
    print('   sedes nuevas que no estaban: %d' % len(nuevas))
    for r in nuevas[:8]:
        print('      %-40s cosecha %s' % (str(r[ix['nombre_sede']])[:40],
                                          r[ix['cosecha']]))
    print('   con fecha_entrada_farmer: %d'
          % sum(1 for r in filas[1:] if r[ix['fecha_entrada_farmer']]))
    print('   con salida_cs:            %d'
          % sum(1 for r in filas[1:] if r[ix['salida_cs']]))
    print('   con cs_fecha_entrada:     %d'
          % sum(1 for r in filas[1:] if r[ix['cs_fecha_entrada']]))


if __name__ == '__main__':
    main()
