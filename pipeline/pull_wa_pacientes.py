# -*- coding: utf-8 -*-
"""
RESCATE_WA_PACIENTES: una fila por PACIENTE APROBADO EN UN MES (documento +
mes de aprobacion), no por telefono de por vida. Historia completa de esta
hoja, para que quede el porque:

  telefono, fecha_aprobacion, enviado, entregado, leido, respondio

TERCERA VUELTA (27-sep-2026), la que corrige el bug mas grave de todos.
Emmanuel comparo la captura de agosto (3.497 aprobados) contra la de
septiembre (5.942 aprobados) y dijo: "si muestro eso no se ve casi
diferencia... esto no me sirve para el CEO". Tenia razon en desconfiar:
el universo de AGOSTO estaba mal, y por una razon distinta a las dos
vueltas anteriores.

La logica vieja deduplicaba por TELEFONO, de por vida, desde
PISO_APROBADO (jun-2026): un mismo telefono solo contaba UNA vez, en el
mes de su aprobacion MAS TEMPRANA. Eso se penso para que un paciente con
dos creditos aprobados en meses distintos no se contara dos veces -- pero
se verifico (27-sep-2026) que esa situacion es CASI INEXISTENTE: de
~15.000 aprobaciones desde junio, UN SOLO documento se repite en mas de un
mes. O sea, la deduplicacion de por vida no prevenia nada real, y en
cambio el conteo por TELEFONO (no por documento) daba un numero
DISTINTO del numero real de aprobados: agosto daba 3.497 por telefono
contra 3.254 aprobaciones reales (documento x mes), un 7,5% de mas --
casi seguro por telefonos compartidos entre documentos distintos
(dos pacientes de la misma familia/clinica con el mismo numero) que el
metodo por telefono mezclaba mal.

Verificado contra la fuente cruda (recalculo independiente, sin pasar por
ningun pull): para cada mes, `COUNT(DISTINCT documento)` con estado
aprobado-y-vivo da EXACTAMENTE el mismo numero que `COUNT(*)` de filas
-- o sea, dentro de un mismo mes, un documento aparece una sola vez en la
fuente. Eso hace trivial el conteo correcto: aprobados de un mes =
documentos distintos con una solicitud aprobada ESE mes, punto. Si el
mismo documento vuelve a aparecer aprobado en OTRO mes (el unico caso
real hoy), cuenta en los DOS meses -- es la definicion correcta de
negocio: cada aprobacion es un evento que necesita SU PROPIA confirmacion.

Arreglo: la llave ahora es (documento, mes de aprobacion), no telefono.
Para el cruce con eventos_hilos se sigue usando el telefono (es lo unico
que eventos_hilos tiene), pero el UNIVERSO (a quien se le exige la
confirmacion) sale de documento x mes, y el conteo de "recibio
confirmacion" exige que el evento sea POSTERIOR a la fecha de ESA
aprobacion puntual (no "en cualquier momento de la historia"), para no
prestarle por error una confirmacion vieja a una aprobacion nueva del
mismo telefono en el caso raro de repeticion.

--- Historia de las dos vueltas anteriores (ya resueltas, para contexto) ---

Version 1: RESCATE_WA_EMBUDO_DIA sumaba pacientes contactados POR DIA
dentro del rango elegido -- un mismo paciente escrito en varios dias
sumaba una vez POR CADA DIA, y el universo de telefonos no estaba acotado
al rango aunque el denominador en pantalla si. Filtrando agosto se veian
"18.254 contactados de 3.638 aprobados = 501,8%", imposible.

Version 2: se corrigio a una fila por paciente con flags 0/1, pero
"cualquier mensaje de whatsapp" diluia el problema real (agosto se veia
96-98% sano por mensajes de cobranza/bot). Se acoto a la FAMILIA de
plantillas de "credito aprobado/preaprobado" (encontradas por CONTENIDO
del mensaje, no por un solo template_id, porque cambia cada vez que el
equipo edita la pieza):

  068fb8c2-66c0-7c3b-8000-0fc063e081fe   31-jul al 4-ago-2026 (469 envios)
  [HUECO: 5-ago a 9-sep, CERO envios de esta familia a nadie]
  06a9f737-0df6-7f4a-8000-d950d030596a   10-11-sep-2026
  06aa4929-9dc5-7f0c-8000-41204b2fa804   11-sep en adelante (pieza actual)
  06a56d1e-7763-763c-8000-8d39dbdf92ff   variante Peru (soles), volumen minimo
  06ab4358-3e61-70ed-8000-7c1e8127d524   variante Peru (soles), volumen minimo

Si se agrega una plantilla nueva de esta misma confirmacion en el futuro,
hay que buscarla de nuevo por CONTENIDO ('hemos aprobado tu credito'/
'hemos preaprobado tu credito' en cuerpo) y agregar su id aqui.

'respondio' sigue sin poder acotarse por plantilla (un INBOUND no trae a
que plantilla responde) -- es "el paciente escribio algo, lo que sea"
despues de su fecha de aprobacion. Declarado en pantalla.
"""
import io
import json
import re
import collections

import lib

ESTADOS_APROBADO = ("'approved'", "'desembolsado'", "'fulfilled'",
                    "'pendiente_desembolso'", "'firma_contrato'")
PISO_APROBADO = '2026-06-01'

PLANTILLAS_CONFIRMACION = {
    '068fb8c2-66c0-7c3b-8000-0fc063e081fe',
    '06a9f737-0df6-7f4a-8000-d950d030596a',
    '06aa4929-9dc5-7f0c-8000-41204b2fa804',
    '06a56d1e-7763-763c-8000-8d39dbdf92ff',
    '06ab4358-3e61-70ed-8000-7c1e8127d524',
}


def norm(t):
    return re.sub(r'\D', '', str(t or ''))[-10:]


def main():
    # `estado` es el estado ACTUAL de la solicitud (foto de hoy), y se trae
    # para que Code.gs pueda dejar fuera del embudo a quien ya avanzo — ver
    # ESTADOS_YA_AVANZO en armarF4_. Se filtra ALLA y no aca a proposito: la
    # hoja se queda con la poblacion completa, asi el recorte es una regla de
    # negocio visible en el motor (y auditable por qa_tablero.js) en vez de
    # un recorte silencioso del pull.
    ap = lib.bq("""
      SELECT documento, nro_celular_paciente, estado,
             DATE(fecha_solicitud, "America/Bogota") AS fecha
      FROM `welli-data.comercial_ops.t_sol_v2`
      WHERE estado IN (%s)
        AND nro_celular_paciente IS NOT NULL AND TRIM(nro_celular_paciente) != ''
        AND DATE(fecha_solicitud, "America/Bogota") >= '%s'
    """ % (','.join(ESTADOS_APROBADO), PISO_APROBADO), project='welli-data')

    # Llave = (documento, mes) -- si un documento aparece mas de una vez en
    # el MISMO mes (no debería, pero por si acaso) se queda con la mas
    # temprana de ese mes. Si aparece en meses DISTINTOS, cuenta en cada uno
    # (es la definicion correcta: cada aprobacion es un evento aparte).
    porDocMes = {}   # (documento, mes) -> {fecha, tel, estado}
    for r in ap:
        doc = r['documento']
        tel = norm(r['nro_celular_paciente'])
        f = str(r['fecha'] or '')
        if not doc or not tel or not f:
            continue
        mes = f[:7]
        k = (doc, mes)
        if k not in porDocMes or f < porDocMes[k]['fecha']:
            porDocMes[k] = {'fecha': f, 'tel': tel,
                            'estado': str(r['estado'] or '').strip()}

    from collections import Counter
    porMes = Counter(k[1] for k in porDocMes)
    print('aprobaciones unicas por documento x mes (>= %s):' % PISO_APROBADO, len(porDocMes))
    for mes in sorted(porMes):
        print('  ', mes, porMes[mes])

    eventos = lib.bq("""
      SELECT telefono, evento, direccion, plantilla, DATE(ts_evento,"America/Bogota") AS dia
      FROM `welli-growth.rescate.eventos_hilos`
      WHERE direccion IN ('OUTBOUND', 'INBOUND')
    """, project='welli-data', location='US')
    print('eventos_hilos leidos:', len(eventos))

    # eventosPorTel: telefono -> lista de (dia, tipo) para poder exigir que
    # el evento sea POSTERIOR a la fecha de ESA aprobacion puntual (importa
    # solo para el unico documento que se repite en dos meses).
    eventosPorTel = collections.defaultdict(list)
    for r in eventos:
        t = norm(r['telefono'])
        dia = str(r['dia'] or '')
        if not dia:
            continue
        if r['direccion'] == 'OUTBOUND' and r['plantilla'] in PLANTILLAS_CONFIRMACION:
            if r['evento'] == 'message.sent':
                eventosPorTel[t].append((dia, 'enviado'))
            elif r['evento'] == 'message.delivered':
                eventosPorTel[t].append((dia, 'entregado'))
            elif r['evento'] == 'message.read':
                eventosPorTel[t].append((dia, 'leido'))
        elif r['direccion'] == 'INBOUND' and r['evento'] == 'message.received':
            eventosPorTel[t].append((dia, 'respondio'))

    cab = ['telefono', 'fecha_aprobacion', 'estado', 'enviado', 'entregado',
           'leido', 'respondio']
    filas = [cab]
    for (doc, mes), info in porDocMes.items():
        fap = info['fecha']
        tel = info['tel']
        flags = {'enviado': 0, 'entregado': 0, 'leido': 0, 'respondio': 0}
        for dia, tipo in eventosPorTel.get(tel, ()):
            if dia >= fap:
                flags[tipo] = 1
        filas.append([tel, fap, info['estado'], flags['enviado'],
                      flags['entregado'], flags['leido'], flags['respondio']])

    T = {'RESCATE_WA_PACIENTES': filas}
    json.dump(T, io.open('tables_wa_pacientes.json', 'w', encoding='utf8'),
              ensure_ascii=False)
    print('escrito tables_wa_pacientes.json,', len(filas) - 1, 'filas (documento x mes)')

    # Cuadre por mes: total y con confirmacion, para verificar a ojo antes
    # de subir que el arreglo de verdad cambio el panorama agosto->septiembre.
    YA_AVANZO = {'desembolsado', 'fulfilled', 'pendiente_desembolso',
                 'pendiente_aprobacion_medico', 'pendiente_validacion_cliente'}
    porMesCuadre = collections.defaultdict(
        lambda: {'tot': 0, 'con': 0, 'resc': 0, 'rescCon': 0})
    for f in filas[1:]:
        mes = f[1][:7]
        b = porMesCuadre[mes]
        b['tot'] += 1
        if f[3]:
            b['con'] += 1
        if f[2] not in YA_AVANZO:
            b['resc'] += 1
            if f[3]:
                b['rescCon'] += 1
    print('CUADRE por mes — TODOS contra SOLO RESCATABLES (sin los 5 estados):')
    print('  %-9s %8s %8s %7s   %8s %8s %7s' %
          ('mes', 'aprob', 'con_msj', '%', 'rescat', 'con_msj', '%'))
    for mes in sorted(porMesCuadre):
        b = porMesCuadre[mes]
        print('  %-9s %8d %8d %6.1f%%   %8d %8d %6.1f%%' % (
            mes, b['tot'], b['con'], 100.0 * b['con'] / b['tot'] if b['tot'] else 0,
            b['resc'], b['rescCon'],
            100.0 * b['rescCon'] / b['resc'] if b['resc'] else 0))

    est = collections.Counter(f[2] for f in filas[1:])
    print('estados presentes:', dict(est))


if __name__ == '__main__':
    main()
