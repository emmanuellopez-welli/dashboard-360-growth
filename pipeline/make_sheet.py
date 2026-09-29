# -*- coding: utf-8 -*-
"""Crea el Google Sheet 'Tablero 360 Growth WELLI - DATA' y escribe todas las hojas."""
import lib, json, io, os, time, datetime as dt

TITLE = 'Tablero 360 Growth WELLI - DATA'
STATE = 'sheet_id.txt'

T = json.load(io.open('tables.json', encoding='utf8'))
T.update(json.load(io.open('tables_hilos.json', encoding='utf8')))

HOY = dt.date.today().isoformat()

# ---- hojas que aun no tienen fuente conectada: solo encabezados + estado
PENDIENTES = {
    'META_ADS': ['fecha', 'campana', 'adset', 'anuncio', 'leads', 'gasto', 'impresiones',
                 'clics', 'ctr_pct', 'cpl'],
    'CONVERSION': ['fecha_solicitud', 'solicitudes', 'aprobados', 'convertidos'],
    'REVENUE': ['validated_on', 'creditos', 'monto_credito'],
    'RESCATE_BQ': ['fecha_desembolso', 'sede', 'monto', 'dias_aprobado_a_desembolso', 'ventana'],
    'WP_BQ': ['mes', 'sedes_habilitadas', 'sedes_activas', 'wp_entregados', 'wp_redimidos'],
}

CONFIG = [
    ['clave', 'valor', 'descripcion'],
    ['ultima_actualizacion', '', 'lo escribe Apps Script en cada refresh'],
    ['zona_horaria', 'America/Bogota', 'UTC-5'],
    ['moneda', 'COP', 'moneda de la cuenta Meta y de BigQuery'],
    ['ad_account_meta', 'act_1373974740859060', 'cuenta de anuncios WELLI'],
    ['hubspot_portal', '50421361', 'portal de HubSpot'],
    ['hubspot_objeto_sedes', '2-50958246', 'objeto personalizado Sedes'],
    ['bq_proyecto_credito', 'welli-tecnologia', 'dataset public: profile_institucion, otp_log'],
    ['bq_proyecto_wp', 'welli-growth', 'dataset wp_data: wellipoints_snapshot, historico, canjeos'],
    ['hilos_base_url', 'https://api.hilos.io/api/', 'rutas SIN slash final'],
    ['', '', ''],
    ['--- TEXTOS EDITABLES (los lee el dashboard) ---', '', 'edita la columna valor'],
    ['f1_funcionando', 'Agosto trajo 52 sedes nuevas por eventos, el mejor mes del ano en ese canal, y 746 sedes entraron al pipeline en total.', 'F1 - Lo que esta funcionando'],
    ['f1_cuello', '1.694 de 3.601 sedes no tienen origen registrado y concentran el 88% de las aplicaciones: sin eso no hay ROI por canal.', 'F1 - Cuello de botella'],
    ['f1_atencion', 'Meta Ads responde API access blocked: F1 esta sin datos de pauta hasta generar un System User Token nuevo en Business Manager.', 'F1 - Atencion esta semana'],
    ['f2_funcionando', 'RECONOCIMIENTO es la audiencia con mas traccion: 66,9% de sus sedes hicieron al menos una app este mes, contra 43,6% de las sedes sin audiencia asignada.', 'F2 - Lo que esta funcionando'],
    ['f2_cuello', 'De las piezas long tail solo se guarda cual fue la ultima enviada, no el canal ni la fecha: no se puede medir efecto en el tiempo ni hacer A/B.', 'F2 - Cuello de botella'],
    ['f2_atencion', '407 sedes en estado died y 317 en Muerto Con Apps: 724 clinicas con historial de aplicaciones que nadie esta reactivando.', 'F2 - Atencion esta semana'],
    ['f4_funcionando', 'Los recordatorios de ventana son las piezas con mejor respuesta de toda la operacion de WhatsApp: 15 dias 17,7% y 3 dias 12,5%, contra 6,7% de cobranza.', 'F4 - Lo que esta funcionando'],
    ['f4_cuello', 'El canal de rescate esta apagado desde el 14 de noviembre de 2025 (220 campanas en total) mientras hay 15.845 creditos aprobados sin firmar acumulados.', 'F4 - Cuello de botella'],
    ['f4_atencion', 'Volver a prender las piezas de 15 y 3 dias sobre las 940 sedes con inventario, y reconectar BigQuery para medir cuantos desembolsan despues del contacto.', 'F4 - Atencion esta semana'],
]

NOVEDADES = [
    ['producto', 'descripcion', 'estado', 'fecha_inicio', 'fecha_fin', 'inversion_cop',
     'acciones', 'piezas',
     'metrica_1_nombre', 'metrica_1_valor', 'metrica_2_nombre', 'metrica_2_valor',
     'metrica_3_nombre', 'metrica_3_valor', 'metrica_4_nombre', 'metrica_4_valor'],
    ['Cupones', 'Cupones de descuento para pacientes en sedes aliadas', 'En curso', '', '', '',
     'Campana WhatsApp + email a sedes', '',
     'Cupones creados', '', 'Cupones en curso', '',
     'Total redenciones', '', 'Proximos a vencer', ''],
]
NOVEDADES_NOTA = 'F6 se llena a mano en esta hoja. La plataforma de cupones no tiene API conectada.'

DICCIONARIO = [
    ['hoja', 'que contiene', 'fuente', 'granularidad', 'caveat'],
    ['SEDES', 'una fila por sede con todos sus contadores actuales', 'HubSpot objeto Sedes', 'foto de hoy', 'los contadores son acumulados de por vida, no del periodo'],
    ['SEDES_EVENTOS', 'un evento fechado del ciclo de vida por fila', 'HubSpot fechas', 'diaria', 'esta es la unica tabla de sedes que el filtro de fechas puede cortar'],
    ['COSECHAS', 'cohortes de sedes por mes de entrada al pipeline', 'HubSpot', 'mensual', 'apps y monto son acumulados historicos de esas sedes, NO generados en el mes'],
    ['CONV_ORIGEN', 'conversion por origen de la sede', 'HubSpot', 'foto de hoy', 'origen solo cubre 1907 sedes = 11.8% de las apps'],
    ['PIPELINE_SNAPSHOT', 'sedes por pipeline y etapa', 'HubSpot', 'foto de hoy', ''],
    ['F2_AUDIENCIA', 'audiencia de marketing long tail vs resultado', 'HubSpot', 'foto de hoy', 'audiencia solo poblada en 1427 sedes'],
    ['F2_COMUNICACIONES', 'estado de comunicaciones vs resultado', 'HubSpot', 'foto de hoy', ''],
    ['F2_AAA', 'cartera de cuentas AAA', 'HubSpot', 'foto de hoy', ''],
    ['RESCATE_INV', 'inventario de aprobados sin firmar', 'HubSpot', 'foto de hoy', 'el resultado del rescate (quien desembolso) requiere BigQuery'],
    ['RESCATE_SEDES', 'sedes con inventario de rescate', 'HubSpot', 'foto de hoy', 'top 400'],
    ['RESCATE_PIEZAS', 'piezas long tail enviadas y su resultado', 'HubSpot', 'foto de hoy', 'no hay fecha de envio por pieza'],
    ['WP_KPI', 'KPIs de Welli Points', 'HubSpot', 'foto de hoy', 'reemplazar por welli-growth.wp_data cuando haya acceso'],
    ['WP_MES', 'sedes que ganaron WP por mes', 'HubSpot', 'mensual', 'solo 83 sedes tienen fecha de ultimo WP'],
    ['HILOS_BROADCAST', 'cada campana de WhatsApp con sus metricas', 'Hilos API', 'por campana', ''],
    ['HILOS_MES', 'WhatsApp agregado por mes', 'Hilos API', 'mensual', 'historia completa desde 2023-06'],
    ['HILOS_TEMA', 'WhatsApp agregado por tema', 'Hilos API', 'foto', 'el tema se deduce del nombre de la campana'],
    ['HILOS_FLOWS', 'flows de Hilos', 'Hilos API', 'acumulado', 'los totales son acumulados, no mensuales'],
    ['META_ADS', 'pauta diaria', 'Meta Ads API', 'diaria', 'PENDIENTE: token de Meta bloqueado'],
    ['CONVERSION', 'embudo de solicitudes de credito', 'BigQuery', 'diaria', 'PENDIENTE: reconectar BigQuery'],
    ['REVENUE', 'desembolsos por fecha de OTP validado', 'BigQuery', 'diaria', 'PENDIENTE: reconectar BigQuery'],
    ['RESCATE_BQ', 'rescatados con ventana de firma', 'BigQuery', 'diaria', 'PENDIENTE: reconectar BigQuery'],
    ['WP_BQ', 'Welli Points real', 'BigQuery welli-growth', 'mensual', 'PENDIENTE: acceso al proyecto welli-growth'],
    ['CONFIG', 'parametros y textos editables del dashboard', 'manual', '-', 'edita aqui los textos cualitativos'],
    ['NOVEDADES', 'F6 novedades de producto', 'manual', '-', 'sin fuente automatica'],
    ['_LOG', 'bitacora de cada refresh', 'Apps Script', '-', ''],
]

LOG = [['timestamp', 'fuente', 'estado', 'filas', 'detalle'],
       [dt.datetime.now().strftime('%Y-%m-%d %H:%M'), 'HubSpot Sedes', 'OK', 3601, 'carga inicial'],
       [dt.datetime.now().strftime('%Y-%m-%d %H:%M'), 'Hilos', 'OK', 850, 'carga inicial'],
       [dt.datetime.now().strftime('%Y-%m-%d %H:%M'), 'Meta Ads', 'ERROR', 0, 'API access blocked - token por renovar'],
       [dt.datetime.now().strftime('%Y-%m-%d %H:%M'), 'BigQuery', 'ERROR', 0, '401 invalid credentials - reconectar'],
       ]

ORDER = ['DICCIONARIO', 'CONFIG', 'COSECHAS', 'CONV_ORIGEN', 'META_ADS', 'CONVERSION',
         'REVENUE', 'PIPELINE_SNAPSHOT', 'F2_AUDIENCIA', 'F2_COMUNICACIONES', 'F2_AAA',
         'RESCATE_INV', 'RESCATE_PIEZAS', 'RESCATE_SEDES', 'RESCATE_BQ',
         'WP_KPI', 'WP_MES', 'WP_BQ', 'HILOS_MES', 'HILOS_TEMA', 'HILOS_FLOWS',
         'HILOS_BROADCAST', 'NOVEDADES', 'SEDES', 'SEDES_EVENTOS', '_LOG']


def build_all():
    out = dict(T)
    out['DICCIONARIO'] = DICCIONARIO
    out['CONFIG'] = CONFIG
    out['NOVEDADES'] = NOVEDADES
    out['_LOG'] = LOG
    for name, hdr in PENDIENTES.items():
        out[name] = [hdr]
    return out


def get_or_create():
    if os.path.exists(STATE):
        sid = open(STATE).read().strip()
        if sid:
            print('reutilizando sheet', sid)
            return sid
    r = lib.ex('GOOGLESHEETS_CREATE_GOOGLE_SHEET1', {'title': TITLE})
    if not r.get('successful', r.get('successfull')):
        raise RuntimeError(json.dumps(r)[:500])
    sid = r['data']['spreadsheetId']
    open(STATE, 'w').write(sid)
    print('creado sheet', sid)
    return sid


def write_table(sid, name, rows, chunk=1200):
    for i in range(0, len(rows), chunk):
        part = rows[i:i + chunk]
        cell = 'A%d' % (i + 1)
        for attempt in range(4):
            try:
                r = lib.ex('GOOGLESHEETS_BATCH_UPDATE', {
                    'spreadsheet_id': sid, 'sheet_name': name, 'values': part,
                    'first_cell_location': cell, 'valueInputOption': 'RAW'})
                if r.get('successful', r.get('successfull')):
                    break
                print('   retry', name, cell, str(r.get('error'))[:120])
            except Exception as e:
                print('   exc', name, cell, str(e)[:120])
            time.sleep(3)
        else:
            print('   FALLO', name, cell)
            return False
    return True


def main():
    sid = get_or_create()
    data = build_all()
    existing = lib.ex('GOOGLESHEETS_GET_SPREADSHEET_INFO', {'spreadsheet_id': sid})
    have = set()
    try:
        for s in existing['data'].get('sheets', []):
            have.add(s['properties']['title'])
    except Exception:
        pass
    print('hojas existentes:', have)

    for name in ORDER:
        rows = data.get(name)
        if not rows:
            print('  (sin datos)', name)
            continue
        if name not in have:
            r = lib.ex('GOOGLESHEETS_ADD_SHEET',
                       {'spreadsheetId': sid, 'properties': {'title': name}})
            ok = r.get('successful', r.get('successfull'))
            if not ok:
                print('  addSheet fallo', name, str(r.get('error'))[:120])
        ok = write_table(sid, name, rows)
        print('  %-20s %6d filas %s' % (name, len(rows) - 1, 'OK' if ok else 'FALLO'))

    # borra la hoja default 'Sheet1' si sigue vacia
    if 'Sheet1' in have:
        lib.ex('GOOGLESHEETS_DELETE_SHEET', {'spreadsheetId': sid, 'sheetId': 0})
    print()
    print('URL: https://docs.google.com/spreadsheets/d/%s/edit' % sid)


if __name__ == '__main__':
    main()
