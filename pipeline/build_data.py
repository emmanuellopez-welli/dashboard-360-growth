# -*- coding: utf-8 -*-
"""Convierte los pulls crudos en las tablas exactas que consume el dashboard."""
import json, io, collections, datetime as dt

SEDES = json.load(io.open('sedes_raw.json', encoding='utf8'))
PIPES = json.load(io.open('pipelines.json', encoding='utf8'))

PIPE_NAME = {p['id']: p['label'] for p in PIPES}
STAGE_NAME = {}
for p in PIPES:
    for s in (p.get('stages') or []):
        STAGE_NAME[s['id']] = s['label']


def num(v):
    if v in (None, '', []):
        return 0.0
    try:
        return float(v)
    except Exception:
        return 0.0


def d(v):
    """Normaliza cualquier fecha HubSpot a YYYY-MM-DD."""
    if not v:
        return ''
    s = str(v)
    if s.isdigit() and len(s) >= 12:
        return dt.datetime.utcfromtimestamp(int(s) / 1000).strftime('%Y-%m-%d')
    return s[:10]


ORIGEN_BUCKET = {
    'EVENTO': 'Eventos',
    'REFERIDO': 'Referidos',
    'PAGINA WEB': 'Pagina web',
    'SOCIAL MEDIA': 'Social media',
}


def origen_bucket(o):
    if not o:
        return 'Sin origen'
    return ORIGEN_BUCKET.get(o.strip().upper(), 'Otros origenes')


# ---------------------------------------------------------------- SEDES (ancha)
SEDES_COLS = ['id', 'id_internal', 'nombre_sede', 'pipeline', 'etapa', 'origen', 'origen_bucket',
              'clasificacion_aliado', 'ranking', 'grupo_long_tail', 'ciudad_municipio',
              'asesor_comercial', 'audiencia_long_tail', 'lt_ultima_pieza',
              'estado_comunicaciones', 'auto_bucket', 'alert_level',
              'fecha_entrada_pipeline_actual', 'fecha_ultima_app', 'fecha_ultimo_desembolso',
              'fecha_capacitado', 'cosecha', 'aplicaciones', 'total_aprobados', 'desembolsos',
              'apps_mes_actual', 'desembolsos_mes_actual', 'aprobados_no_firmados',
              'aprob_no_firmados_30d', 'aprob_no_firmados_60d', 'aprobados_30d',
              'aprobados_60d', 'desembolsos_30d', 'desembolsos_60d', 'dias_desde_ultima_app',
              'monto_total_desembolsado', 'monto_desembolsado_mes', 'ticket_promedio_4m',
              'puntos', 'wp_ganado_mes', 'wp_ofrecido_mes', 'wp_pendiente', 'valor_puntos',
              'aplica_wp_raw', 'resu_apps', 'resu_desembolsos', 'resu_aprobados',
              'monto_aprobado_post_resu', 'cs_apps_bq', 'cs_firmas_bq', 'cs_hizo_1app',
              'cs_exitosa', 'cs_dias_a_1app', 'visita_recibida']


def sede_row(r):
    origen = (r.get('origen') or '').strip()
    # OJO: la propiedad se llama no_aplica_wp pero su LABEL en HubSpot es "Aplica WP".
    # Se guarda el valor crudo; la polaridad se resuelve contra los datos.
    return [
        r.get('id', ''), r.get('id_internal', ''), r.get('nombre_sede', ''),
        PIPE_NAME.get(r.get('hs_pipeline'), r.get('hs_pipeline') or ''),
        STAGE_NAME.get(r.get('hs_pipeline_stage'), r.get('hs_pipeline_stage') or ''),
        origen, origen_bucket(origen),
        r.get('clasificacion_aliado', ''), r.get('ranking', ''), r.get('grupo_long_tail', ''),
        r.get('ciudad_municipio', ''), r.get('asesor_comercial', ''),
        r.get('audiencia_long_tail', ''), r.get('lt_ultima_pieza', ''),
        r.get('estado_comunicaciones', ''), r.get('auto_bucket', ''), r.get('alert_level', ''),
        d(r.get('fecha_entrada_pipeline_actual')),
        d(r.get('fecha_ultimaapp') or r.get('fecha_ultima_aplicacion')),
        d(r.get('fecha_ultimo_desembolso')), d(r.get('fecha_capacitado')),
        d(r.get('hs_createdate'))[:7],
        num(r.get('aplicaciones')), num(r.get('total_aprobados')), num(r.get('desembolsos')),
        num(r.get('apps_sede_actual')), num(r.get('desembolsos_mes_actual')),
        num(r.get('aprobados_no_firmados')),
        num(r.get('total_aprobados_no_firmados_ultimos_30_dias')),
        num(r.get('total_aprobados_no_firmados_ultimos_60_dias')),
        num(r.get('total_aprobados_ultimos_30_dias')),
        num(r.get('total_aprobados_ultimos_60_dias')),
        num(r.get('total_de_desembolsos_ultimos_30_dias')),
        num(r.get('total_de_desembolsos_ultimos_60_dias')),
        num(r.get('dias_desde_ultima_app')),
        num(r.get('monto_total_desembolsado')), num(r.get('monto_desembolsado_mes')),
        num(r.get('promedio_montos_desembolsados_4m')),
        num(r.get('puntos')), num(r.get('wp_ganado_acumulado_mes')),
        num(r.get('wp_ofrecido_acumulado_mes')), num(r.get('wp_pendiente_actual')),
        num(r.get('valor_puntos')), r.get('no_aplica_wp', ''),
        num(r.get('resucitado___de_apps')), num(r.get('resucitado___de_desembolsos')),
        num(r.get('resucitado_solicitudes_aprobadas')),
        num(r.get('monto_aprobado_after_resucitado')),
        num(r.get('cs_apps_total_bq')), num(r.get('cs_firmas_total_bq')),
        r.get('cs_hizo_1app', ''), r.get('cs_exitosa_real', ''), num(r.get('cs_dias_a_1app')),
        r.get('visita_recibida', ''),
    ]


SEDES_TABLE = [SEDES_COLS] + [sede_row(r) for r in SEDES]

# ------------------------------------------------- SEDES_EVENTOS (larga, fechada)
# Cada fila = un evento del ciclo de vida CON FECHA. Es lo que el filtro global corta.
EVENTOS = [
    ('fecha_entrada_pipeline_actual', 'Entrada a pipeline actual', 'ciclo'),
    ('fecha_entrada_auto', 'Entrada a Autogestionados', 'ciclo'),
    ('fecha_entrada_farmer', 'Entrada a Farmer', 'ciclo'),
    ('cs_fecha_entrada', 'Entrada a Customer Success', 'ciclo'),
    ('fecha_entrada_capm', 'Entrada a Capacitacion muertos', 'ciclo'),
    ('fecha_reactivacion_muertos', 'Reactivación de muerta', 'reactivacion'),
    ('fecha_de_reactivacion', 'Reactivación', 'reactivacion'),
    ('fecha_primer_contacto', 'Primer contacto', 'gestion'),
    ('fecha_primera_capacitacion', 'Primera capacitación', 'gestion'),
    ('fecha_segunda_capacitacion', 'Segunda capacitación', 'gestion'),
    ('fecha_capacitado', 'Capacitada', 'gestion'),
    ('cs_fecha_exitosa_real', 'CS exitosa (3 apps o 1 firma)', 'resultado'),
    ('fecha_primera_firma_auto', 'Estrena primer paciente', 'resultado'),
    ('fecha_ultimo_desembolso', 'Último desembolso', 'resultado'),
    ('fecha_ultima_aplicacion', 'Última aplicación', 'resultado'),
    ('ultimo_wp_ganado_fecha', 'Welli Point ganado', 'welli_points'),
    ('fecha_de_visita', 'Visita comercial', 'gestion'),
    ('hs_createdate', 'Sede creada', 'ciclo'),
]
EV_COLS = ['fecha', 'evento', 'categoria', 'sede_id', 'sede', 'pipeline', 'origen',
           'origen_bucket', 'clasificacion_aliado', 'audiencia_long_tail', 'asesor_comercial',
           'monto']
ev_rows = []
for r in SEDES:
    origen = (r.get('origen') or '').strip()
    base = [r.get('id', ''), r.get('nombre_sede', ''),
            PIPE_NAME.get(r.get('hs_pipeline'), ''), origen, origen_bucket(origen),
            r.get('clasificacion_aliado', ''), r.get('audiencia_long_tail', ''),
            r.get('asesor_comercial', '')]
    for prop, label, cat in EVENTOS:
        f = d(r.get(prop))
        if not f:
            continue
        monto = 0.0
        if prop == 'fecha_ultimo_desembolso':
            monto = num(r.get('monto_desembolsado_mes'))
        if prop == 'ultimo_wp_ganado_fecha':
            monto = num(r.get('ultimo_wp_ganado_monto'))
        ev_rows.append([f, label, cat] + base + [monto])
ev_rows.sort(key=lambda x: x[0])
EVENTOS_TABLE = [EV_COLS] + ev_rows

# ------------------------------------------------------------------- COSECHAS (F1)
# ANCLA DE LA COSECHA: hs_createdate, el mes en que la sede se creo en
# HubSpot. Es fijo para siempre; no cambia si la sede se mueve de pipeline.
#
# Y el tablero es de MARKETING: la cosecha cuenta SOLO las sedes de los
# cuatro origenes que marketing genera. El total de todas las sedes queda
# en la ultima columna como contexto, no como el numero principal.
MKT_BUCKETS = ['Eventos', 'Referidos', 'Pagina web', 'Social media']

coh = collections.defaultdict(collections.Counter)
for r in SEDES:
    f = d(r.get('hs_createdate'))
    if not f:
        continue
    b = coh[f[:7]]
    b['todas'] += 1
    bucket = origen_bucket((r.get('origen') or '').strip())
    if bucket not in MKT_BUCKETS:
        continue
    b['mkt'] += 1
    b[bucket] += 1
    cl = (r.get('clasificacion_aliado') or '').strip().upper()
    if cl:
        b['cal_' + cl] += 1

COS_COLS = ['cosecha', 'sedes_mkt', 'Eventos', 'Referidos', 'Pagina web', 'Social media',
            'mkt_A', 'mkt_AA', 'mkt_AAA', 'sedes_todas']
cos_rows = []
for mes in sorted(coh):
    b = coh[mes]
    cos_rows.append([mes, b['mkt'], b['Eventos'], b['Referidos'], b['Pagina web'],
                     b['Social media'], b['cal_A'], b['cal_AA'], b['cal_AAA'],
                     b['todas']])
COSECHAS_TABLE = [COS_COLS] + cos_rows

# ------------------------------------------------- CONV_ORIGEN (F1, grafica 3)
by_o = collections.defaultdict(collections.Counter)
for r in SEDES:
    b = by_o[origen_bucket((r.get('origen') or '').strip())]
    b['sedes'] += 1
    b['apps'] += num(r.get('aplicaciones'))
    b['aprobados'] += num(r.get('total_aprobados'))
    b['desembolsos'] += num(r.get('desembolsos'))
    b['monto'] += num(r.get('monto_total_desembolsado'))
CO_COLS = ['origen', 'sedes', 'apps', 'aprobados', 'desembolsos', 'monto_desembolsado',
           'tasa_aprobacion_pct', 'tasa_conversion_pct', 'apps_por_sede']
co_rows = []
for o, b in sorted(by_o.items(), key=lambda x: -x[1]['apps']):
    apps = b['apps']
    co_rows.append([o, b['sedes'], round(apps), round(b['aprobados']), round(b['desembolsos']),
                    round(b['monto']),
                    round(100.0 * b['aprobados'] / apps, 1) if apps else 0,
                    round(100.0 * b['desembolsos'] / apps, 1) if apps else 0,
                    round(apps / b['sedes'], 1) if b['sedes'] else 0])
CONV_ORIGEN_TABLE = [CO_COLS] + co_rows

# --------------------------------------------------------- PIPELINE_SNAPSHOT
snap = collections.Counter()
stage_snap = collections.defaultdict(collections.Counter)
for r in SEDES:
    p = PIPE_NAME.get(r.get('hs_pipeline'), 'Sin pipeline')
    snap[p] += 1
    stage_snap[p][STAGE_NAME.get(r.get('hs_pipeline_stage'), '-')] += 1
PIPE_TABLE = [['pipeline', 'etapa', 'sedes']]
for p in sorted(snap, key=lambda x: -snap[x]):
    PIPE_TABLE.append([p, '(TOTAL)', snap[p]])
    for st, n in sorted(stage_snap[p].items(), key=lambda x: -x[1]):
        PIPE_TABLE.append([p, st, n])

# ------------------------------------------------------------ WELLI_POINTS (F5)
wp = collections.Counter()
wp_mes = collections.defaultdict(collections.Counter)
apps_con = apps_sin = des_con = des_sin = 0.0
n_con = n_sin = 0
for r in SEDES:
    habilitada = (str(r.get('no_aplica_wp')).lower() == 'true')
    activa = num(r.get('puntos')) > 0 or num(r.get('wp_ganado_acumulado_mes')) > 0
    if habilitada:
        wp['habilitadas'] += 1
        wp['activas'] += 1 if activa else 0
    wp['wp_ganado_mes'] += num(r.get('wp_ganado_acumulado_mes'))
    wp['wp_ofrecido_mes'] += num(r.get('wp_ofrecido_acumulado_mes'))
    wp['wp_pendiente'] += num(r.get('wp_pendiente_actual'))
    wp['puntos_saldo'] += num(r.get('puntos'))
    wp['valor_puntos'] += num(r.get('valor_puntos'))
    if activa:
        n_con += 1
        apps_con += num(r.get('aplicaciones'))
        des_con += num(r.get('desembolsos'))
    else:
        n_sin += 1
        apps_sin += num(r.get('aplicaciones'))
        des_sin += num(r.get('desembolsos'))
    f = d(r.get('ultimo_wp_ganado_fecha'))
    if f:
        wp_mes[f[:7]]['sedes'] += 1
        wp_mes[f[:7]]['monto'] += num(r.get('ultimo_wp_ganado_monto'))

hab, act = wp['habilitadas'], wp['activas']
WP_KPI = [['metrica', 'valor', 'fuente', 'nota'],
          ['Sedes habilitadas WP', hab, 'HubSpot no_aplica_wp', 'polaridad del campo por validar'],
          ['Sedes que han entrado (activas)', act, 'HubSpot puntos>0 o wp_ganado>0', ''],
          ['Adopcion %', round(100.0 * act / hab, 1) if hab else 0, 'calculado', 'activas / habilitadas'],
          ['Sedes sin entrar', hab - act, 'calculado', 'target de outreach'],
          ['WP ganados (mes en curso)', round(wp['wp_ganado_mes']), 'HubSpot wp_ganado_acumulado_mes', 'solo 40 sedes con valor'],
          ['WP ofrecidos (mes en curso)', round(wp['wp_ofrecido_mes']), 'HubSpot wp_ofrecido_acumulado_mes', ''],
          ['WP pendientes', round(wp['wp_pendiente']), 'HubSpot wp_pendiente_actual', ''],
          ['Saldo total de puntos', round(wp['puntos_saldo']), 'HubSpot puntos', ''],
          ['Valor de puntos (COP)', round(wp['valor_puntos']), 'HubSpot valor_puntos', ''],
          ['WP redimidos', '', 'PENDIENTE', 'welli-growth.wp_data.wp_canjeos_solicitados'],
          ['Apps promedio - sedes activas con WP', round(apps_con / n_con, 1) if n_con else 0, 'calculado', 'n=%d' % n_con],
          ['Apps promedio - sedes sin entrar', round(apps_sin / n_sin, 1) if n_sin else 0, 'calculado', 'n=%d' % n_sin],
          ['Desemb. promedio - activas con WP', round(des_con / n_con, 1) if n_con else 0, 'calculado', 'n=%d' % n_con],
          ['Desemb. promedio - sin entrar', round(des_sin / n_sin, 1) if n_sin else 0, 'calculado', 'n=%d' % n_sin]]
WP_MES = [['mes', 'sedes_con_wp_ganado', 'monto_wp']] + \
         [[m, wp_mes[m]['sedes'], round(wp_mes[m]['monto'])] for m in sorted(wp_mes)]

# ---------------------------------------------------------------- RESCATE (F4)
resc = collections.Counter()
resc_sede = []
for r in SEDES:
    a30 = num(r.get('total_aprobados_no_firmados_ultimos_30_dias'))
    a60 = num(r.get('total_aprobados_no_firmados_ultimos_60_dias'))
    tot = num(r.get('aprobados_no_firmados'))
    resc['inv_30d'] += a30
    resc['inv_60d'] += a60
    resc['inv_total'] += tot
    if tot > 0:
        resc_sede.append([r.get('nombre_sede', ''),
                          PIPE_NAME.get(r.get('hs_pipeline'), ''),
                          r.get('clasificacion_aliado', ''),
                          round(tot), round(a30), round(a60), r.get('grupo_long_tail', ''),
                          r.get('lt_ultima_pieza', ''), r.get('asesor_comercial', '')])
resc_sede.sort(key=lambda x: -x[3])
RESCATE_INV = [['metrica', 'valor', 'fuente'],
               ['Aprobados sin firmar - total', round(resc['inv_total']), 'HubSpot aprobados_no_firmados'],
               ['Aprobados sin firmar - ultimos 30 dias', round(resc['inv_30d']), 'HubSpot 30d'],
               ['Aprobados sin firmar - ultimos 60 dias', round(resc['inv_60d']), 'HubSpot 60d'],
               ['Sedes con inventario de rescate', len(resc_sede), 'calculado'],
               ['Pacientes rescatados (desembolso tras contacto)', '', 'PENDIENTE BigQuery profile_institucion + otp_log'],
               ['Rescatados ventana corta (<15 dias)', '', 'PENDIENTE BigQuery'],
               ['Rescatados ventana media (15-30 dias)', '', 'PENDIENTE BigQuery']]
RESCATE_SEDES = [['sede', 'pipeline', 'clasificacion', 'aprob_no_firmados', 'ultimos_30d',
                  'ultimos_60d', 'grupo_long_tail', 'ultima_pieza', 'farmer']] + resc_sede[:400]

piezas = collections.defaultdict(collections.Counter)
for r in SEDES:
    pz = r.get('lt_ultima_pieza')
    if not pz:
        continue
    b = piezas[pz]
    b['sedes'] += 1
    b['apps'] += num(r.get('aplicaciones'))
    b['desembolsos'] += num(r.get('desembolsos'))
    b['aprob_sin_firmar'] += num(r.get('aprobados_no_firmados'))
RESCATE_PIEZAS = [['pieza', 'canal', 'sedes', 'apps', 'desembolsos', 'aprob_sin_firmar',
                   'desemb_por_sede']]
for pz, b in sorted(piezas.items(), key=lambda x: -x[1]['sedes']):
    canal = 'WhatsApp' if '_wa_' in pz else ('Email' if '_mail_' in pz else '-')
    RESCATE_PIEZAS.append([pz, canal, b['sedes'], round(b['apps']), round(b['desembolsos']),
                           round(b['aprob_sin_firmar']),
                           round(b['desembolsos'] / b['sedes'], 2) if b['sedes'] else 0])

# ----------------------------------------------------------- F2 ATRIBUCION
aud = collections.defaultdict(collections.Counter)
for r in SEDES:
    b = aud[r.get('audiencia_long_tail') or 'Sin audiencia']
    b['sedes'] += 1
    b['con_pieza'] += 1 if r.get('lt_ultima_pieza') else 0
    b['apps'] += num(r.get('aplicaciones'))
    b['apps_mes'] += num(r.get('apps_sede_actual'))
    b['desembolsos'] += num(r.get('desembolsos'))
    b['desemb_mes'] += num(r.get('desembolsos_mes_actual'))
    b['monto'] += num(r.get('monto_total_desembolsado'))
    b['activas_mes'] += 1 if num(r.get('apps_sede_actual')) > 0 else 0
F2_AUD = [['audiencia', 'sedes', 'con_pieza_enviada', 'sedes_activas_mes', 'apps_hist',
           'apps_mes', 'desembolsos_hist', 'desembolsos_mes', 'monto_desembolsado',
           'pct_activas_mes']]
for a, b in sorted(aud.items(), key=lambda x: -x[1]['sedes']):
    F2_AUD.append([a, b['sedes'], b['con_pieza'], b['activas_mes'], round(b['apps']),
                   round(b['apps_mes']), round(b['desembolsos']), round(b['desemb_mes']),
                   round(b['monto']),
                   round(100.0 * b['activas_mes'] / b['sedes'], 1) if b['sedes'] else 0])

com = collections.defaultdict(collections.Counter)
for r in SEDES:
    b = com[r.get('estado_comunicaciones') or 'Sin dato']
    b['sedes'] += 1
    b['apps'] += num(r.get('aplicaciones'))
    b['desembolsos'] += num(r.get('desembolsos'))
    b['activas_mes'] += 1 if num(r.get('apps_sede_actual')) > 0 else 0
F2_COM = [['estado_comunicaciones', 'sedes', 'sedes_activas_mes', 'apps_hist',
           'desembolsos_hist']]
for c, b in sorted(com.items(), key=lambda x: -x[1]['sedes']):
    F2_COM.append([c, b['sedes'], b['activas_mes'], round(b['apps']), round(b['desembolsos'])])

aaa = [r for r in SEDES if (r.get('clasificacion_aliado') or '').upper() == 'AAA']
F2_AAA = [['sede', 'pipeline', 'ranking', 'ciudad', 'apps_hist', 'apps_mes',
           'desembolsos_hist', 'desembolsos_mes', 'monto_total', 'aprob_sin_firmar',
           'visita_recibida', 'farmer', 'alerta']]
for r in sorted(aaa, key=lambda x: -num(x.get('monto_total_desembolsado'))):
    F2_AAA.append([r.get('nombre_sede', ''), PIPE_NAME.get(r.get('hs_pipeline'), ''),
                   r.get('ranking', ''), r.get('ciudad_municipio', ''),
                   round(num(r.get('aplicaciones'))), round(num(r.get('apps_sede_actual'))),
                   round(num(r.get('desembolsos'))), round(num(r.get('desembolsos_mes_actual'))),
                   round(num(r.get('monto_total_desembolsado'))),
                   round(num(r.get('aprobados_no_firmados'))),
                   r.get('visita_recibida', ''), r.get('asesor_comercial', ''),
                   r.get('alert_level', '')])

TABLES = {
    'SEDES': SEDES_TABLE, 'SEDES_EVENTOS': EVENTOS_TABLE, 'COSECHAS': COSECHAS_TABLE,
    'CONV_ORIGEN': CONV_ORIGEN_TABLE, 'PIPELINE_SNAPSHOT': PIPE_TABLE,
    'WP_KPI': WP_KPI, 'WP_MES': WP_MES,
    'RESCATE_INV': RESCATE_INV, 'RESCATE_SEDES': RESCATE_SEDES,
    'RESCATE_PIEZAS': RESCATE_PIEZAS,
    'F2_AUDIENCIA': F2_AUD, 'F2_COMUNICACIONES': F2_COM, 'F2_AAA': F2_AAA,
}

if __name__ == '__main__':
    json.dump(TABLES, io.open('tables.json', 'w', encoding='utf8'), ensure_ascii=False)
    for k, v in TABLES.items():
        print('%-22s %6d filas x %d cols' % (k, len(v) - 1, len(v[0])))
