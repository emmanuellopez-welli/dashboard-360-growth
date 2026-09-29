# -*- coding: utf-8 -*-
"""
Arma el dataset de las sedes de las cosechas de 2026, reproduciendo el MISMO
universo que usan los seis mapas de cohortes del tablero (armarF2_ sobre
U.filas):

  1. la sede existe en PLATAFORMA_SEDES (institucion_medica) con pais COL
  2. NO esta en el pipeline Aliados_deshabilitados
  3. su cosecha es 2026-01 o posterior y no es la carga inicial (2025-10)

Escribe coh2026.json. Antes de nada valida los conteos por cosecha contra los
que el tablero muestra hoy: si no cuadran, el Excel mentiria.
"""
import io
import json
import collections

ESPERADO = {'2026-01': 173, '2026-02': 226, '2026-03': 191, '2026-04': 183,
            '2026-05': 173, '2026-06': 178, '2026-07': 159}


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def tabla(hojas, nombre):
    filas = hojas.get(nombre) or []
    if not filas:
        return [], {}
    ix = {h: i for i, h in enumerate(filas[0])}
    return filas[1:], ix


def main():
    hojas = json.load(io.open('sheet_data.json', encoding='utf8'))

    sedes, sx = tabla(hojas, 'SEDES')
    plat, px = tabla(hojas, 'PLATAFORMA_SEDES')
    roles, rx = tabla(hojas, 'SEDE_ROLES')
    owners, ox = tabla(hojas, 'OWNERS')
    act, ax = tabla(hojas, 'ACT_SEDE_MES')

    pais = {}
    esp = {}
    for r in plat:
        k = str(r[px['id_sede']] or '').strip()
        if not k:
            continue
        pais[k] = str(r[px['pais']] or 'COL')
        esp[k] = str(r[px['especialidad']] or '')

    nomOwner = {str(r[ox['owner_id']] or '').strip(): str(r[ox['nombre']] or '')
                for r in owners}
    rolDe = {}
    for r in roles:
        rolDe[str(r[rx['id']] or '').strip()] = {
            'hunter': str(r[rx['hunter']] or '').strip(),
            'farmer': str(r[rx['farmer']] or '').strip(),
            'cs': str(r[rx['cs']] or '').strip(),
        }

    # ACT_SEDE_MES: solicitudes / aprobados / desembolsos / monto por sede y mes
    porSedeMes = collections.defaultdict(dict)
    for r in act:
        k = str(r[ax['id_sede']] or '').strip()
        m = str(r[ax['mes']] or '')[:7]
        if not k or len(m) != 7:
            continue
        porSedeMes[k][m] = {
            'sol': int(num(r[ax['solicitudes']])),
            'apr': int(num(r[ax['aprobados']])),
            'des': int(num(r[ax['desembolsos']])),
            'monto': num(r[ax['monto']]),
        }

    fuera = collections.Counter()
    out = []
    for r in sedes:
        cos = str(r[sx['cosecha']] or '')[:7]
        if len(cos) != 7 or cos < '2026-01':
            fuera['cosecha fuera de 2026'] += 1
            continue
        if 'deshabilitad' in str(r[sx['pipeline']] or '').lower():
            fuera['deshabilitada'] += 1
            continue
        iid = str(r[sx['id_internal']] or '').strip()
        if not iid:
            fuera['sin id_internal'] += 1
            continue
        if iid not in pais:
            fuera['no existe en plataforma'] += 1
            continue
        if pais[iid] != 'COL':
            fuera['pais != COL'] += 1
            continue

        rl = rolDe.get(str(r[sx['id']] or '').strip(), {})
        out.append({
            'cosecha': cos,
            'nombre': str(r[sx['nombre_sede']] or '').strip(),
            'id_hs': str(r[sx['id']] or '').strip(),
            'id_interno': iid,
            'origen': str(r[sx['origen']] or '').strip().upper(),
            'pipeline': str(r[sx['pipeline']] or '').strip(),
            'etapa': str(r[sx['etapa']] or '').strip(),
            'ciudad': str(r[sx['ciudad_municipio']] or '').strip(),
            'especialidad': esp.get(iid, ''),
            'clasificacion': str(r[sx['clasificacion_aliado']] or '').strip(),
            'ranking': str(r[sx['ranking']] or '').strip(),
            'hunter': nomOwner.get(rl.get('hunter', ''), ''),
            'farmer': nomOwner.get(rl.get('farmer', ''), ''),
            'cs': nomOwner.get(rl.get('cs', ''), ''),
            'audiencia_lt': str(r[sx['audiencia_long_tail']] or '').strip(),
            'estado_com': str(r[sx['estado_comunicaciones']] or '').strip(),
            'alert': str(r[sx['alert_level']] or '').strip(),
            'apps': int(num(r[sx['aplicaciones']])),
            'aprobados': int(num(r[sx['total_aprobados']])),
            'desembolsos': int(num(r[sx['desembolsos']])),
            'monto': num(r[sx['monto_total_desembolsado']]),
            'ticket_4m': num(r[sx['ticket_promedio_4m']]),
            'aprob_no_firm': int(num(r[sx['aprobados_no_firmados']])),
            'dias_sin_app': int(num(r[sx['dias_desde_ultima_app']])),
            'ultima_app': str(r[sx['fecha_ultima_app']] or '')[:10],
            'ultimo_des': str(r[sx['fecha_ultimo_desembolso']] or '')[:10],
            'capacitado': str(r[sx['fecha_capacitado']] or '')[:10],
            'puntos': int(num(r[sx['puntos']])),
            'mes': porSedeMes.get(iid, {}),
        })

    porCos = collections.Counter(x['cosecha'] for x in out)
    print('CONTEO POR COSECHA  (esperado = lo que muestra el tablero hoy)')
    ok = True
    for c in sorted(porCos):
        e = ESPERADO.get(c)
        marca = ''
        if e is not None:
            marca = '  OK' if e == porCos[c] else '  <-- NO CUADRA (esperado %d)' % e
            if e != porCos[c]:
                ok = False
        print('  %s  %4d%s' % (c, porCos[c], marca))
    print('  total 2026: %d sedes' % len(out))
    print('\nDescartadas:')
    for k, v in fuera.most_common():
        print('  %6d  %s' % (v, k))
    print('\n%s' % ('CUADRA con el tablero' if ok
                    else 'REVISAR: hay cosechas que no cuadran'))

    json.dump(out, io.open('coh2026.json', 'w', encoding='utf8'),
              ensure_ascii=False)
    print('escrito coh2026.json')


if __name__ == '__main__':
    main()
