# -*- coding: utf-8 -*-
"""
Lee los 5 workflows Long Tail por la API de automatizacion v4 (via el proxy de
Composio, que es lo unico que llega ahi: el conector MCP de HubSpot no tiene
herramienta de workflows) y desarma la CADENCIA de cada uno.

Un workflow LT es una cadena: impacta con una pieza, espera N dias, impacta con
otra. Recorriendo las acciones desde startActionId por nextActionId se
reconstruye el calendario relativo al dia de entrada de la sede:

    dia 0  -> pieza A
    dia 4  -> pieza B     (delay de 4 dias)
    dia 11 -> pieza C     (delay de 7 dias)

Eso es lo que hay que marcar en la grafica, y es relativo a la entrada de cada
sede, no una fecha del calendario.
"""
import lib, json, io, os

HS = 'ca_13P0RgH6oZrv'
IDS = ['1872026920', '1872023650', '1872023651', '1872026919', '1872023463']


def get(ep):
    r = lib.C.tools.proxy(endpoint=ep, method='GET', connected_account_id=HS)
    d = getattr(r, 'data', r)
    if isinstance(d, str):
        d = json.loads(d)
    return d


if __name__ == '__main__':
    todo = {}
    for wid in IDS:
        try:
            d = get('/automation/v4/flows/' + wid)
            todo[wid] = d
            print('%s  %-42s activo=%s  acciones=%d'
                  % (wid, str(d.get('name'))[:42], d.get('isEnabled'),
                     len(d.get('actions') or [])))
        except Exception as e:
            print('%s  FALLO: %s' % (wid, str(e)[:200]))
    json.dump(todo, io.open('wf_raw.json', 'w', encoding='utf8'), ensure_ascii=False)
    print()
    print('escrito wf_raw.json')

    # Inventario de tipos de accion, para saber que significa cada actionTypeId
    tipos = {}
    for wid, d in todo.items():
        for a in (d.get('actions') or []):
            t = a.get('actionTypeId')
            tipos.setdefault(t, {'n': 0, 'campos': set()})
            tipos[t]['n'] += 1
            for k in (a.get('fields') or {}):
                tipos[t]['campos'].add(k)
    print()
    print('TIPOS DE ACCION ENCONTRADOS:')
    for t, v in sorted(tipos.items(), key=lambda x: -x[1]['n']):
        print('  %-16s %3d veces   campos: %s'
              % (t, v['n'], ', '.join(sorted(v['campos']))[:110]))
