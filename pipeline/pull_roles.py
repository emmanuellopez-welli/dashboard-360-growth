# -*- coding: utf-8 -*-
"""
SEDE_ROLES: quien es el hunter, el farmer y el CS de cada sede.

Reemplaza a SEDE_OWNER. La diferencia importa: sede_owner es UN dueño y habia
que inferirle el equipo desde los equipos de HubSpot. Las propiedades propias
del objeto — hunter, farmer, customer_success — son TRES asignaciones que
conviven: una sede la trae un hunter, la cultiva un farmer y la retiene un CS,
los tres a la vez. Eso es lo que hace que tenga sentido tener tres filtros y
no uno.

Cobertura, que tambien es mejor:
  hunter            3.520 de 3.603   (sede_owner solo 3.273)
  farmer            3.507
  customer_success  2.115

Y aparece gente que sede_owner escondia: Lina Camacho tiene 1.241 sedes como
customer_success y CERO como sede_owner.
"""
import lib, json, io, collections

HS = 'ca_13P0RgH6oZrv'
ROLES = ['hunter', 'farmer', 'customer_success']

NOMBRES = {
    '82855685': 'Fabian Arevalo',
    '83158753': 'Juan Camilo Barrera Paris',
    '83626010': 'Camila Bernal',
    '83703389': 'Edilberto Espitia',
    '83703390': 'Johana Quiroz',
    '83703391': 'Sebastián Andrés Vergara Martínez',
    '83703392': 'Guillermo Lenis',
    '83703393': 'Johanna Vásquez Melo',
    '83703394': 'Hanheyr Alonso Pérez Rojas',
    '83703419': 'Elkin Suarez',
    '83748986': 'John Jairo Hinestroza Sanmiguel',
    '83748987': 'Maria Fernanda Caro',
    '83748988': 'Maryori Palacio Paez',
    '83748989': 'Margarita Rosa Jaramillo',
    '83917910': 'Daniela Gutiérrez Baquero',
    '83917986': 'Paola Carranza',
    '84380856': 'LADY DIANA MORENO DURAN',
    '84380858': 'Giohanna Sanchez Palacios',
    '84380859': 'Viviana Zuluaga',
    '84380860': 'Mariana Botero',
    '84418150': 'Caterine Rios',
    '85650316': 'Catalina Gallego',
    '85893685': 'service welli',
    '88454157': 'Lina Camacho Romero',
    '89418948': 'Gabriela Quitian Rodríguez',
    '94438568': 'Emmanuel Buitrago Montero',
    '77634531': 'Jose Espinosa',
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
    ids = [(str(r[iId]), str(r[iInt] or '').strip())
           for r in S[1:] if str(r[iId] or '').strip()]
    print('sedes en la hoja: %d' % len(ids))

    got = {}
    for i in range(0, len(ids), 100):
        lote = ids[i:i + 100]
        d = proxy('/crm/v3/objects/2-50958246/batch/read', 'POST',
                  {'properties': ROLES, 'inputs': [{'id': x[0]} for x in lote]})
        for res in (d.get('results') or []):
            pr = res.get('properties') or {}
            got[str(res.get('id'))] = [str(pr.get(k) or '').strip() or '0'
                                       for k in ROLES]
        if i % 1000 == 0:
            print('   %d/%d' % (i + len(lote), len(ids)))

    filas = [['id', 'id_sede', 'hunter', 'farmer', 'cs']]
    for hid, interno in ids:
        v = got.get(hid, ['0', '0', '0'])
        filas.append([hid, interno, v[0], v[1], v[2]])

    print()
    for k, nom in enumerate(['HUNTER', 'FARMER', 'CUSTOMER SUCCESS']):
        c = collections.Counter(f[2 + k] for f in filas[1:])
        asignadas = sum(v for i, v in c.items() if i != '0')
        print('%s  (%d sedes asignadas, %d sin asignar)'
              % (nom, asignadas, c.get('0', 0)))
        for oid, v in c.most_common():
            if oid == '0':
                continue
            print('    %5d  %s' % (v, NOMBRES.get(oid, oid)))
        print()

    json.dump({'SEDE_ROLES': filas},
              io.open('tables_rl.json', 'w', encoding='utf8'), ensure_ascii=False)
    print('escrito tables_rl.json')
