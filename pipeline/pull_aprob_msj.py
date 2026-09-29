# -*- coding: utf-8 -*-
"""
RESCATE_APROB_MSJ_DIA: por DIA, cuantos creditos aprobados-y-vivos hay y a
cuantos de esos nunca les llego un mensaje de WhatsApp.

Antes esto salia como UNA fila resumen ("foto de hoy") y por eso la tarjeta
no se movia con el filtro de fecha del tablero — corregido el 9-sep-2026 a
pedido del negocio, igual que ya se hizo con el embudo de WhatsApp.

El dia es el de la SOLICITUD del credito (fecha_solicitud en hora Bogota):
t_sol_v2 no guarda la fecha en que el credito paso a aprobado, asi que es
el reloj mas cercano que existe. Por eso la tarjeta dice "aprobados que
entraron en el periodo", no "aprobados al cierre del periodo".

Cruce: telefono normalizado a los ultimos 10 digitos contra
welli-growth.rescate.eventos_hilos (direccion OUTBOUND = lo que WELLI le
mando al paciente). Mismo criterio que RESCATE_WA_EMBUDO_DIA.
"""
import io
import json
import re
import collections

import lib


def norm(t):
    return re.sub(r'\D', '', str(t or ''))[-10:]


def main():
    ap = lib.bq("""
      SELECT documento, nro_celular_paciente,
             DATE(fecha_solicitud, "America/Bogota") AS dia
      FROM `welli-data.comercial_ops.t_sol_v2`
      WHERE estado = 'approved'
        AND nro_celular_paciente IS NOT NULL AND TRIM(nro_celular_paciente) != ''
    """, project='welli-data')
    print('aprobados vivos con celular:', len(ap))

    msg = lib.bq("""
      SELECT DISTINCT RIGHT(REGEXP_REPLACE(telefono, r'[^0-9]', ''), 10) AS tel
      FROM `welli-growth.rescate.eventos_hilos`
      WHERE direccion = 'OUTBOUND'
    """, project='welli-data', location='US')
    conMsj = set(r['tel'] for r in msg if r['tel'])
    print('telefonos con al menos un mensaje enviado:', len(conMsj))

    # Dedupe por documento (el mas reciente), igual que la verificacion que
    # se hizo para el CEO: un paciente con dos solicitudes aprobadas no
    # cuenta dos veces.
    porDoc = {}
    for r in ap:
        d = r['documento']
        dia = str(r['dia'] or '')
        if not dia:
            continue
        if d not in porDoc or dia > porDoc[d]['dia']:
            porDoc[d] = {'dia': dia, 'tel': norm(r['nro_celular_paciente'])}

    agg = collections.defaultdict(lambda: {'aprobados': 0, 'sin': 0, 'con': 0})
    for r in porDoc.values():
        b = agg[r['dia']]
        b['aprobados'] += 1
        if r['tel'] in conMsj:
            b['con'] += 1
        else:
            b['sin'] += 1

    cab = ['fecha', 'aprobados_con_telefono', 'sin_mensaje', 'con_mensaje']
    filas = [cab]
    for f in sorted(agg):
        b = agg[f]
        filas.append([f, b['aprobados'], b['sin'], b['con']])

    T = {'RESCATE_APROB_MSJ_DIA': filas}
    json.dump(T, io.open('tables_aprob_msj.json', 'w', encoding='utf8'),
              ensure_ascii=False)
    tot = sum(r[1] for r in filas[1:])
    sin = sum(r[2] for r in filas[1:])
    print('dias con fila:', len(filas) - 1)
    print('total aprobados unicos:', tot, '| sin mensaje:', sin,
          '(%.1f%%)' % (100.0 * sin / tot if tot else 0))
    print('rango:', filas[1][0], '->', filas[-1][0])


if __name__ == '__main__':
    main()
