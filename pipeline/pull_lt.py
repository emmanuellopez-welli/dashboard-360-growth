# -*- coding: utf-8 -*-
"""
Las tres tablas del frente Long Tail.

  LT_CADENCIA   la cadencia declarada de cada workflow: a que dia relativo cae
                cada impacto, por que canal y con que pieza. Se lee de
                /automation/v4/flows/{id} y es la ficha tecnica del frente.
  LT_TOUCHES    el log REAL de impactos con fecha, del historial de la
                propiedad lt_ultima_pieza. Es lo que se marca en la grafica.
  LT_APPS_DIA   solicitudes por dia de la poblacion de los workflows, con
                desglose por audiencia. Es la linea de la grafica.

Por que el proxy de Composio y no el conector MCP de HubSpot: el conector no
tiene herramienta de workflows ni lee historial de propiedades. El proxy si
llega a los dos. Ninguna de las dos cosas esta en BigQuery.
"""
import lib, json, io, collections, datetime

HS = 'ca_13P0RgH6oZrv'

# Mismo hallazgo que en pull_deals.py (2026-09-08): el historial de
# propiedades de HubSpot devuelve el timestamp en UTC, y el negocio opera
# en hora de Bogota (UTC-5). Cortar el string crudo corria un impacto de la
# noche al dia siguiente.
def fechaBogota(iso):
    iso = str(iso or '')
    if len(iso) < 19:
        return iso[:10]
    dt = datetime.datetime.strptime(iso[:19], '%Y-%m-%dT%H:%M:%S')
    return (dt - datetime.timedelta(hours=5)).strftime('%Y-%m-%d')
IDS = ['1872026920', '1872023650', '1872023651', '1872026919', '1872023463',
       '1872026911']
ACC = {'PERFILAMIENTO', 'REACTIVAR', 'DESEMBOLSO', 'RECONOCIMIENTO', 'ESTRENA'}

# El nombre del workflow trae el numero de la cadencia; la audiencia sale de
# ahi. Se mapea explicito para no depender de parsear el emoji del nombre.
#
# '1872026911' (ESTRENA) faltaba: la tabla de metas por cluster que arma
# armarF7_ le contaba 66 sedes, 36 solicitudes y 132 impactos reales
# (LT_TOUCHES, piezas 01_wa_p2/01_wa_p3) pero la mostraba en "audiencias que
# nadie toca" porque su workflow nunca se bajo. Descubierto 9-sep-2026 al
# filtrar F7 por ese cluster y ver una cadencia vacia con impactos de
# sobra — se busco el flow por nombre ("[Growth] 01 Estrena tu primer
# paciente", activo, 14 acciones) y se agrego aca.
WF_AUD = {
    '1872023650': 'PERFILAMIENTO',      # 02 Que paciente si pasa
    '1872026919': 'DESEMBOLSO',         # 03 Tu trabajo si sirve
    '1872026920': 'REACTIVAR',          # 04 Vuelve a aplicar
    '1872023651': 'RECONOCIMIENTO',     # 05 Reconocimiento
    '1872023463': '(ENRUTADOR)',        # LT Autogestionados por audiencia
    '1872026911': 'ESTRENA',            # 01 Estrena tu primer paciente
}
TIPO = {'0-1': 'DELAY', '0-4': 'Email', '0-230189361': 'WhatsApp', '0-5': 'SET_PROP'}


def canal_de(p):
    p = str(p or '').lower()
    return 'WhatsApp' if '_wa' in p else ('Email' if '_mail' in p else 'Otro')


def dias(a):
    f = a.get('fields') or {}
    n = float(f.get('delta') or 0)
    u = str(f.get('time_unit') or 'DAYS').upper()
    return n / 1440.0 if u.startswith('MINUTE') else \
        n / 24.0 if u.startswith('HOUR') else \
        n * 7 if u.startswith('WEEK') else n


def proxy(ep, method='GET', body=None):
    r = lib.C.tools.proxy(endpoint=ep, method=method,
                          connected_account_id=HS, body=body)
    d = getattr(r, 'data', r)
    if isinstance(d, str):
        d = json.loads(d)
    if isinstance(d, dict) and d.get('status') == 'error':
        raise RuntimeError('HubSpot: ' + str(d.get('message'))[:200])
    return d


def cadencia():
    filas = [['workflow_id', 'workflow', 'audiencia', 'activo', 'impacto',
              'dia', 'canal', 'pieza']]
    for wid in IDS:
        d = proxy('/automation/v4/flows/' + wid)
        nombre = str(d.get('name') or '').replace('️', '').strip()
        activo = 'si' if d.get('isEnabled') else 'no'
        aud = WF_AUD.get(wid, '')
        acc = {a['actionId']: a for a in (d.get('actions') or []) if a.get('actionId')}
        cur, t, paso, visto = d.get('startActionId'), 0.0, 0, set()
        # La pieza la declara la accion SET_PROP que viene DESPUES del envio,
        # asi que se recorre en orden y se le pega al ultimo impacto abierto.
        pend = []
        while cur and cur in acc and cur not in visto:
            visto.add(cur)
            a = acc[cur]
            tp = TIPO.get(str(a.get('actionTypeId')))
            f = a.get('fields') or {}
            if tp == 'DELAY':
                t += dias(a)
            elif tp in ('Email', 'WhatsApp'):
                paso += 1
                pend.append([wid, nombre, aud, activo, paso, round(t, 2), tp, ''])
            elif tp == 'SET_PROP' and pend:
                v = f.get('value')
                pieza = v.get('staticValue') if isinstance(v, dict) else v
                for p in pend:
                    if not p[7]:
                        p[7] = str(pieza or '')
                filas.extend(pend)
                pend = []
            cur = (a.get('connection') or {}).get('nextActionId')
        filas.extend(pend)
        if not acc:
            filas.append([wid, nombre, aud, activo, 0, 0, '', '(VACIO)'])
    return filas


def touches(pob):
    # id_internal por sede (HubSpot id -> uuid de plataforma), para poder
    # filtrar LT_TOUCHES por origen/rol igual que el resto del tablero.
    intDe = {x[0]: x[1] for x in pob}
    audDe, hist = {}, {}
    # Tope de 50 por lote: el batch de historial de propiedades es mas estricto
    # que el de propiedades normales, que si acepta 100.
    for i in range(0, len(pob), 50):
        lote = pob[i:i + 50]
        d = proxy('/crm/v3/objects/2-50958246/batch/read', 'POST',
                  {'propertiesWithHistory': ['lt_ultima_pieza'],
                   'properties': ['audiencia_long_tail'],
                   'inputs': [{'id': x[0]} for x in lote]})
        for res in (d.get('results') or []):
            sid = str(res.get('id'))
            audDe[sid] = (res.get('properties') or {}).get('audiencia_long_tail') or ''
            hist[sid] = (res.get('propertiesWithHistory') or {}).get('lt_ultima_pieza') or []
    # Se agrega TAMBIEN por sede (id_internal), no solo por dia x audiencia
    # x pieza: sin la llave de sede el filtro global de origen/rol no puede
    # cortar esta tabla. Antes esto solo se veia en 9 filas totales
    # (agregado), asi que la sede se pierde ahi; se recupera desde el batch
    # read de HubSpot, que ya trae el id por fila.
    ag = collections.Counter()
    for sid, hs in hist.items():
        iid = intDe.get(sid, '')
        for e in hs:
            pieza = str(e.get('value') or '')
            ag[(fechaBogota(e.get('timestamp')), audDe.get(sid, ''), pieza,
                canal_de(pieza), iid)] += 1
    filas = [['fecha', 'audiencia', 'pieza', 'canal', 'id_sede', 'sedes']]
    for k in sorted(ag):
        filas.append([k[0], k[1], k[2], k[3], k[4], ag[k]])
    tocadas = sum(1 for h in hist.values() if h)
    return filas, tocadas, len(hist)


def apps(pob):
    audDe = {x[1]: x[2] for x in pob if x[1]}
    r = lib.bq("""
    SELECT medico_id, CAST(DATE(created_on, "America/Bogota") AS STRING) AS fecha,
           COUNT(*) AS apps,
           -- 'dismissed' SACADO (9-sep-2026): es un rechazo, no un desembolso.
           SUM(CASE WHEN estado IN ('pendiente_aprobacion_medico','desembolsado',
             'pendiente_validacion_cliente','fulfilled','pendiente_desembolso'
             ) THEN 1 ELSE 0 END) AS des
    FROM `welli-tecnologia.public.profile_institucion`
    WHERE medico_id IS NOT NULL
      AND DATE(created_on, "America/Bogota") >= DATE_SUB(CURRENT_DATE(), INTERVAL 120 DAY)
    GROUP BY 1, 2""", project='welli-tecnologia')
    # Se agrega por (fecha, audiencia, sede): antes se perdia la sede al
    # agregar solo por (fecha, audiencia), y sin esa llave el filtro global
    # de origen/rol no tiene por donde cortar la serie — la poblacion de
    # arriba SI se filtraba y la grafica de abajo no, que es exactamente la
    # inconsistencia que hay que cerrar.
    ag = collections.defaultdict(lambda: [0, 0])
    for x in r:
        a = audDe.get(str(x['medico_id']))
        if not a:
            continue
        b = ag[(x['fecha'], a, str(x['medico_id']))]
        b[0] += int(float(x['apps']))
        b[1] += int(float(x['des'] or 0))
    filas = [['fecha', 'audiencia', 'id_sede', 'solicitudes', 'desembolsos']]
    for k in sorted(ag):
        b = ag[k]
        filas.append([k[0], k[1], k[2], b[0], b[1]])
    return filas


if __name__ == '__main__':
    d = json.load(io.open('sheet_data.json', encoding='utf8'))
    S = d['SEDES']
    h = S[0]
    iId, iInt, iA = h.index('id'), h.index('id_internal'), h.index('audiencia_long_tail')
    pob = [(str(r[iId]), str(r[iInt] or '').strip(), str(r[iA]).strip())
           for r in S[1:] if str(r[iA] or '').strip() in ACC]
    print('poblacion LT: %d sedes  (%d cruzables por id_internal)'
          % (len(pob), sum(1 for x in pob if x[1])))
    print('  por audiencia:', dict(collections.Counter(x[2] for x in pob)))

    T = {}
    print()
    print('--- LT_CADENCIA ---')
    T['LT_CADENCIA'] = cadencia()
    for f in T['LT_CADENCIA'][1:]:
        print('  %-14s %-11s %s dia %-5s %-9s %s'
              % (str(f[1])[:14], f[2], 'ON ' if f[3] == 'si' else 'OFF', f[5], f[6], f[7]))

    print()
    print('--- LT_TOUCHES ---')
    T['LT_TOUCHES'], toc, tot = touches(pob)
    print('  %d de %d sedes con impacto registrado · %d filas'
          % (toc, tot, len(T['LT_TOUCHES']) - 1))

    print()
    print('--- LT_APPS_DIA ---')
    T['LT_APPS_DIA'] = apps(pob)
    print('  %d filas dia x audiencia' % (len(T['LT_APPS_DIA']) - 1))

    json.dump(T, io.open('tables_lt.json', 'w', encoding='utf8'), ensure_ascii=False)
    print()
    print('escrito tables_lt.json')
