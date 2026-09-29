# -*- coding: utf-8 -*-
"""
SEDE_OWNER: el dueno de cada sede y su equipo.

El filtro global de owner agrupa por EQUIPO, no por persona: son 21 dueños y
la pregunta del negocio es "que hace Hunter contra Farmer contra CS", no que
hace cada asesor.

Los equipos NO se infieren del pipeline. El pipeline no los separa (casi todos
los dueños tienen sedes en Farmer-Nuevos y no existe pipeline de Hunter en el
objeto Sedes, porque los hunters trabajan deals). Salen de los equipos reales
de HubSpot, leidos con get_organization_details y fijados aca:

  Hunter           70180411
  Farmer           70180672
  Customer Success 76531012

Si alguien entra o sale de un equipo en HubSpot hay que actualizar este mapa.
Se deja explicito a proposito: un mapa fijo que se puede revisar es mejor que
una inferencia que se rompe en silencio.
"""
import lib, json, io, collections

HS = 'ca_13P0RgH6oZrv'

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

NOMBRES = {
    '83703389': 'Edilberto Espitia', '83703390': 'Johana Quiroz',
    '83703392': 'Guillermo Lenis', '83703393': 'Johanna Vásquez Melo',
    '83703394': 'Hanheyr Alonso Pérez Rojas', '83703419': 'Elkin Suarez',
    '83748986': 'John Jairo Hinestroza Sanmiguel', '83748987': 'Maria Fernanda Caro',
    '83748988': 'Maryori Palacio Paez', '83748989': 'Margarita Rosa Jaramillo',
    '83917910': 'Daniela Gutiérrez Baquero', '83917986': 'Paola Carranza',
    '84380856': 'LADY DIANA MORENO DURAN', '84380858': 'Giohanna Sanchez Palacios',
    '84380859': 'Viviana Zuluaga', '84380860': 'Mariana Botero',
    '84418150': 'Caterine Rios', '85650316': 'Catalina Gallego',
    '85893685': 'service welli', '88454157': 'Lina Camacho Romero',
    '89418948': 'Gabriela Quitian Rodríguez', '77634531': 'Jose Espinosa',
}


def proxy(ep, method='GET', body=None):
    r = lib.C.tools.proxy(endpoint=ep, method=method,
                          connected_account_id=HS, body=body)
    d = getattr(r, 'data', r)
    if isinstance(d, str):
        d = json.loads(d)
    if isinstance(d, dict) and d.get('status') == 'error':
        raise RuntimeError('HubSpot: ' + str(d.get('message'))[:200])
    return d


if __name__ == '__main__':
    H = json.load(io.open('sheet_data.json', encoding='utf8'))
    S = H['SEDES']
    h = S[0]
    iId, iInt = h.index('id'), h.index('id_internal')
    ids = [(str(r[iId]), str(r[iInt] or '').strip()) for r in S[1:] if str(r[iId] or '').strip()]
    print('sedes en la hoja: %d' % len(ids))

    owner = {}
    for i in range(0, len(ids), 100):
        lote = ids[i:i + 100]
        d = proxy('/crm/v3/objects/2-50958246/batch/read', 'POST',
                  {'properties': ['sede_owner'],
                   'inputs': [{'id': x[0]} for x in lote]})
        for res in (d.get('results') or []):
            owner[str(res.get('id'))] = str(
                (res.get('properties') or {}).get('sede_owner') or '').strip()
        if i % 1000 == 0:
            print('   %d/%d' % (i + len(lote), len(ids)))

    filas = [['id', 'id_sede', 'owner_id', 'owner', 'equipo']]
    for hid, interno in ids:
        oid = owner.get(hid, '')
        eq = EQUIPO_DE.get(oid, '(OTRO EQUIPO)' if oid else '(SIN OWNER)')
        filas.append([hid, interno, oid, NOMBRES.get(oid, oid or ''), eq])

    c = collections.Counter(f[4] for f in filas[1:])
    print()
    print('SEDES POR EQUIPO:')
    for k, v in c.most_common():
        print('   %-18s %5d' % (k, v))
    print()
    print('  dueños distintos: %d' % len(set(f[2] for f in filas[1:] if f[2])))
    sinEq = collections.Counter(f[3] for f in filas[1:] if f[4] == '(OTRO EQUIPO)')
    if sinEq:
        print('  dueños con sedes pero sin equipo en HubSpot:')
        for k, v in sinEq.most_common():
            print('     %-34s %4d sedes' % (k, v))

    json.dump({'SEDE_OWNER': filas},
              io.open('tables_ow.json', 'w', encoding='utf8'), ensure_ascii=False)
    print('escrito tables_ow.json')
