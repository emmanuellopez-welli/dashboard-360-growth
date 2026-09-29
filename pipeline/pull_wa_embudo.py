# -*- coding: utf-8 -*-
"""
RESCATE_WA_EMBUDO_DIA: el embudo de WhatsApp (contactados -> entregados ->
leidos -> respondieron) por DIA, para que el tablero lo pueda filtrar con
el mismo selector de fecha global que el resto de rescate -- antes salia
una sola fila resumen y por eso cambiar de mes en el tablero no cambiaba
nada (correccion pedida el 8-sep-2026).

Sale de welli-growth.rescate.eventos_hilos, igual que RESCATE_APROB_MSJ.
LA MISMA TRAMPA que ya se documento ahi: eventos_hilos es el trafico de
WhatsApp de TODA la empresa (cobranza, bot, encuestas...), no solo rescate.
No hay campania/plantilla que identifique "el mensaje de aprobado" (se
reviso el catalogo completo el 8-sep-2026), asi que se acota por POBLACION:
solo telefonos de creditos que alguna vez llegaron a un estado aprobado
(estado IN approved/desembolsado/fulfilled/pendiente_desembolso/
firma_contrato en t_sol_v2 -- los mismos 5 estados que ya usa la logica de
desenlace 'firmo'/'vivo').

Granularidad DIARIA por el dia del EVENTO (ts_evento), no por cuando se
aprobo el credito -- asi el filtro de fecha del tablero corta por "que paso
esta semana/mes con los mensajes", que es la pregunta de la pantalla.
Cada celda cuenta PACIENTES unicos ese dia (no mensajes): un paciente
contactado dos veces el mismo dia cuenta una vez ese dia, pero si aparece
tambien manana cuenta otra vez manana -- mismo criterio que ya usa
RESCATE_GESTION con 'casos' por dia.
"""
import io
import json
import re
import collections

import lib

ESTADOS_APROBADO = ("'approved'", "'desembolsado'", "'fulfilled'",
                    "'pendiente_desembolso'", "'firma_contrato'")

# Mismo colchon que el calculo anterior: sin piso, el universo mete anos de
# creditos ya desembolsados que jamas pudieron recibir un mensaje por este
# canal (eventos_hilos arranca ~19-jul-2026).
PISO_APROBADO = '2026-06-01'


def norm(t):
    return re.sub(r'\D', '', str(t or ''))[-10:]


def main():
    ap = lib.bq("""
      SELECT documento, nro_celular_paciente
      FROM `welli-data.comercial_ops.t_sol_v2`
      WHERE estado IN (%s)
        AND nro_celular_paciente IS NOT NULL AND TRIM(nro_celular_paciente) != ''
        AND DATE(fecha_solicitud, "America/Bogota") >= '%s'
    """ % (','.join(ESTADOS_APROBADO), PISO_APROBADO), project='welli-data')

    universo = set()
    for r in ap:
        t = norm(r['nro_celular_paciente'])
        if t:
            universo.add(t)
    print('universo (alguna vez aprobado, con celular, >= %s):' % PISO_APROBADO, len(universo))

    eventos = lib.bq("""
      SELECT telefono, evento, direccion, DATE(ts_evento,"America/Bogota") AS dia
      FROM `welli-growth.rescate.eventos_hilos`
      WHERE direccion IN ('OUTBOUND', 'INBOUND')
    """, project='welli-data', location='US')
    print('eventos_hilos leidos:', len(eventos))

    # por dia -> sets de telefonos por etapa (para dedupe intra-dia antes de contar)
    porDia = collections.defaultdict(lambda: {
        'enviados': set(), 'entregados': set(), 'leidos': set(), 'respondieron': set(),
        'msj_enviados': 0, 'msj_entregados': 0, 'msj_leidos': 0, 'msj_fallidos': 0
    })
    for r in eventos:
        t = norm(r['telefono'])
        if t not in universo:
            continue
        dia = r['dia']
        if not dia:
            continue
        d = porDia[str(dia)]
        ev = r['evento']
        if r['direccion'] == 'OUTBOUND':
            if ev == 'message.sent':
                d['enviados'].add(t)
                d['msj_enviados'] += 1
            elif ev == 'message.delivered':
                d['entregados'].add(t)
                d['msj_entregados'] += 1
            elif ev == 'message.read':
                d['leidos'].add(t)
                d['msj_leidos'] += 1
            elif ev == 'message.failed':
                d['msj_fallidos'] += 1
        elif r['direccion'] == 'INBOUND' and ev == 'message.received':
            d['respondieron'].add(t)

    # universo nuevo por dia: cuantos creditos llegaron a aprobarse ESE dia,
    # para poder mostrar un denominador tambien filtrable por fecha. Se
    # trae aparte porque la query de arriba no pidio fecha_solicitud.
    porDiaAprob = collections.Counter()
    ap_fechas = lib.bq("""
      SELECT DATE(fecha_solicitud, "America/Bogota") AS dia,
             RIGHT(REGEXP_REPLACE(nro_celular_paciente, r'[^0-9]', ''), 10) AS tel
      FROM `welli-data.comercial_ops.t_sol_v2`
      WHERE estado IN (%s)
        AND nro_celular_paciente IS NOT NULL AND TRIM(nro_celular_paciente) != ''
        AND DATE(fecha_solicitud, "America/Bogota") >= '%s'
    """ % (','.join(ESTADOS_APROBADO), PISO_APROBADO), project='welli-data')
    for r in ap_fechas:
        if r['dia']:
            porDiaAprob[str(r['dia'])] += 1

    dias = sorted(set(porDia.keys()) | set(porDiaAprob.keys()))
    cab = ['fecha', 'universo_nuevo', 'pac_enviados', 'pac_entregados',
           'pac_leidos', 'pac_respondieron', 'msj_enviados', 'msj_entregados',
           'msj_leidos', 'msj_fallidos']
    filas = [cab]
    for f in dias:
        d = porDia.get(f)
        if d is None:
            filas.append([f, porDiaAprob.get(f, 0), 0, 0, 0, 0, 0, 0, 0, 0])
            continue
        filas.append([
            f, porDiaAprob.get(f, 0),
            len(d['enviados']), len(d['entregados']), len(d['leidos']), len(d['respondieron']),
            d['msj_enviados'], d['msj_entregados'], d['msj_leidos'], d['msj_fallidos']
        ])

    T = {'RESCATE_WA_EMBUDO_DIA': filas}
    json.dump(T, io.open('tables_wa_embudo.json', 'w', encoding='utf8'),
              ensure_ascii=False)
    print('dias con fila:', len(filas) - 1)
    print('tables_wa_embudo.json escrito (RESCATE_WA_EMBUDO_DIA)')

    # Cuadre rapido contra el calculo anterior (todo el periodo sumado)
    totE = sum(r[2] for r in filas[1:])
    print('suma pac_enviados todo el periodo (referencia, con recuento entre dias):', totE)


if __name__ == '__main__':
    main()
