# -*- coding: utf-8 -*-
"""
DEALS_ORIGEN con la dimension EQUIPO: cosecha x origen x equipo -> deals + m0..m7.

Por que a nivel de registro y no agregado: la tabla necesita cuatro
dimensiones (cosecha, origen, equipo, mes de cierre) y el conector MCP de
HubSpot solo admite dos GROUP BY. Bajando los deals uno por uno con el proxy
de Composio el cubo se arma local, con fidelidad completa y en una sola
pasada.

El OWNER que manda aca es el del DEAL (hubspot_owner_id), no el de la sede:
el deal existe antes que la sede y lo trabaja un hunter. Preguntar "que deals
trajo Farmer" con el owner de la sede daria la respuesta de otra pregunta.

Exclusiones (las mismas que pidio el negocio): se sacan los cerrados perdidos
cuya causal es Duplicado/Existente, No paso SARLAFT o Medicina Alternativa.
"""
import lib, json, io, unicodedata, collections, datetime

HS = 'ca_13P0RgH6oZrv'
# Las causales que NO son oportunidad perdida sino registro que no debio
# existir. Dejarlas en el denominador hunde la tasa de cierre sin que
# signifique nada. Los nombres van EXACTOS como los escribe HubSpot.
#
# Alineado 2026-09-08 con el filtro real del reporte de HubSpot que usa el
# negocio (screenshot de Emmanuel): reemplaza la lista anterior. "Le faltan
# Documentos" salio de la lista (ya no se excluye); se agregaron 4 causales
# nuevas. Los deals sin causal (abiertos o ganados) NO se excluyen — el
# "o esta vacio" del filtro de HubSpot solo afecta closed-lost con causal,
# confirmado con el negocio.
FUERA = {'Duplicado/Existente', 'No paso SARLAFT', 'Medicina Alternativa',
         'Pruebas', 'No es del sector salud', 'Sin tarjeta profesional',
         '>1 año constitución', 'Equipos Medicos'}
# La exclusion PERMANENTE de origen PROSPECCION/HUNTER (acordada 2026-09-08)
# se aplica en Code.gs, no aca: asi queda declarada en pantalla igual que
# las demas exclusiones del tablero, en vez de desaparecer en silencio del
# pull.

EQUIPOS = {
    'Hunter': [83917986, 83703393, 83703394, 89418948],
    'Farmer': [84380856, 83703389, 84418150, 84380858, 84380859, 83748986,
               83748988, 83748989, 83703392, 83703390],
    'Customer Success': [84380860, 88454157],
}
EQUIPO_DE = {}
for eq, ids in EQUIPOS.items():
    for i in ids:
        EQUIPO_DE[str(i)] = eq

# Pipeline del deal. Hay 9 en HubSpot y la cosecha los mezclaba todos sin
# distinguir — Farmer, B2B Distribuidores, Alianzas, etc. son procesos de
# negocio DISTINTOS a la adquisicion. Agregado 2026-09-08 para que el
# tablero pueda filtrar por pipeline (localmente, en la pestana), igual que
# el reporte de HubSpot que el negocio usa como referencia.
# IDs via GET /crm/v3/pipelines/deals, verificado 2026-09-08.
PIPELINE_LABEL = {
    'default': 'Pipeline de Hunter',
    '816865709': 'Farmer',
    '823061024': 'Alianzas',
    '875088911': 'Pipeline Hunters Perú',
    '875403338': 'Pipeline Farmer Perú',
    '898243975': 'Pipeline prospecting automatizado',
    '856395303': 'Pipeline Dentalink',
    '869264194': 'B2B Distribuidores',
    '869190928': 'B2B Créditos a médicos',
    '898930833': 'Pipeline Bot',
}

PROPS = ['createdate', 'closedate', 'origen', 'hubspot_owner_id', 'pipeline',
         'hs_is_closed_won', 'causal_principal_de_cerrado_perdido']


def N(o):
    s = (o or '').strip().upper()
    if not s or s == 'UNASSIGNED':
        return '(SIN ORIGEN)'
    s = ''.join(c for c in unicodedata.normalize('NFD', s)
                if unicodedata.category(c) != 'Mn')
    s = ' '.join(s.split())
    return {'NOVONORDISK': 'NOVO NORDISK'}.get(s, s)


def mesN(c):
    return int(c[:4]) * 12 + int(c[5:7]) - 1


# HALLAZGO 2026-09-08: HubSpot devuelve createdate/closedate en UTC, pero el
# portal (y su reporte de referencia) los agrupa por mes en hora de Bogota
# (UTC-5, sin horario de verano). Cortar el string UTC tal cual corria un
# deal creado el 31 a las 7pm Bogota (medianoche UTC del dia 1) al mes
# SIGUIENTE — verificado: sin este ajuste, junio daba 207 deals de Hunter
# contra los 197 del reporte real; con el ajuste, da 197 exacto.
def fechaBogota(iso):
    if not iso or len(iso) < 19:
        return str(iso or '')[:10]
    dt = datetime.datetime.strptime(iso[:19], '%Y-%m-%dT%H:%M:%S')
    return (dt - datetime.timedelta(hours=5)).strftime('%Y-%m-%d')


# REATRIBUCIONES DE ORIGEN — el espejo de REATRIBUCION_ORIGEN en
# Filtro_Origen.gs. Las sedes se reatribuyen en el motor (ahi cada fila
# tiene su fecha), pero DEALS_ORIGEN viaja PRE-AGREGADA por mes: si la
# ventana empieza el 28 de julio, desde la tabla agregada ya no hay forma
# de saber que deals de la cosecha 2026-07 se crearon despues del 28. Por
# eso la regla se aplica ACA, sobre el createdate exacto de cada deal.
# Si se cambia una regla, hay que cambiarla en los DOS lados.
REATRIBUCION = [
    {'de': 'DENTALINK', 'a': 'EVENTO',
     'desde': '2026-07-28', 'hasta': '2026-08-31'},
]


def reatribuir(origen, fecha_iso):
    f = str(fecha_iso or '')[:10]
    if not f:
        return origen
    for R in REATRIBUCION:
        if origen == R['de'] and R['desde'] <= f <= R['hasta']:
            return R['a']
    return origen


def proxy(ep):
    r = lib.C.tools.proxy(endpoint=ep, method='GET', connected_account_id=HS)
    d = getattr(r, 'data', r)
    if isinstance(d, str):
        d = json.loads(d)
    if isinstance(d, dict) and d.get('status') == 'error':
        raise RuntimeError('HubSpot: ' + str(d.get('message'))[:200])
    return d


if __name__ == '__main__':
    base = '/crm/v3/objects/deals?limit=100&properties=' + ','.join(PROPS)
    despues, deals, paginas = None, [], 0
    while True:
        d = proxy(base + ('&after=' + despues if despues else ''))
        deals.extend(d.get('results') or [])
        paginas += 1
        despues = (((d.get('paging') or {}).get('next') or {}).get('after'))
        if not despues:
            break
        if paginas % 10 == 0:
            print('   %d paginas, %d deals' % (paginas, len(deals)))
    print('%d deals en %d paginas' % (len(deals), paginas))

    # deals_totales: mismo corte de cosecha/origen/owner/pipeline pero SIN la
    # exclusion de causal (SARLAFT/duplicado/pruebas/etc) -- pedido de la
    # jefa de Emmanuel el 14-sep-2026: Growth muestra el total de leads que
    # entraron, no solo los que ya pasaron el filtro de calidad de Hunter.
    # "deals" (limpio) sigue siendo el que alimenta el mapa de cohortes.
    den = collections.Counter()
    denTotal = collections.Counter()
    won = collections.defaultdict(lambda: [0] * 8)
    fuera, sinFecha, raros = 0, 0, 0
    for x in deals:
        pr = x.get('properties') or {}
        cd = fechaBogota(pr.get('createdate'))
        if len(cd) != 10:
            sinFecha += 1
            continue
        cos = cd[:7]
        if cos < '2025-11':
            continue
        o = reatribuir(N(pr.get('origen')), cd)
        eq = str(pr.get('hubspot_owner_id') or '') or '0'
        pipe = PIPELINE_LABEL.get(str(pr.get('pipeline') or ''), '(otro pipeline)')
        denTotal[(cos, o, eq, pipe)] += 1
        if str(pr.get('causal_principal_de_cerrado_perdido') or '') in FUERA:
            fuera += 1
            continue
        den[(cos, o, eq, pipe)] += 1
        if str(pr.get('hs_is_closed_won')).lower() == 'true':
            cl = fechaBogota(pr.get('closedate'))
            if len(cl) != 10:
                continue
            off = mesN(cl[:7]) - mesN(cos)
            if off < 0 or off > 7:
                raros += 1
                continue
            won[(cos, o, eq, pipe)][off] += 1

    filas = [['cosecha', 'origen', 'owner', 'pipeline', 'deals', 'deals_totales',
              'm0', 'm1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7']]
    for k in sorted(set(list(den) + list(won) + list(denTotal))):
        filas.append([k[0], k[1], k[2], k[3], den.get(k, 0), denTotal.get(k, 0)]
                      + won.get(k, [0] * 8))
    print('%d filas cosecha x origen x equipo x pipeline'
          % (len(filas) - 1))
    print('   excluidos por causal: %d · sin createdate: %d · closedate raro: %d'
          % (fuera, sinFecha, raros))

    ce = collections.defaultdict(lambda: [0, 0])
    for f in filas[1:]:
        b = ce[f[2]]
        b[0] += f[4]
        b[1] += sum(f[6:])
    print()
    print('  DEALS POR OWNER (todas las cosechas)')
    print('  owner_id           deals  ganados  cierre')
    for k in sorted(ce, key=lambda x: -ce[x][0]):
        b = ce[k]
        print('   %-18s %6d %8d  %5.1f%%'
              % (k, b[0], b[1], 100.0 * b[1] / b[0] if b[0] else 0))
    tt = [sum(ce[k][i] for k in ce) for i in range(2)]
    print('   %-18s %6d %8d  %5.1f%%'
          % ('TOTAL', tt[0], tt[1], 100.0 * tt[1] / tt[0] if tt[0] else 0))
    print('   control: 4.838 deals / 1.636 ganados con la version sin equipo')

    json.dump({'DEALS_ORIGEN': filas},
              io.open('tables_dl.json', 'w', encoding='utf8'), ensure_ascii=False)
    print('escrito tables_dl.json')
