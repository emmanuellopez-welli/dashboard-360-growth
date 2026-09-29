# -*- coding: utf-8 -*-
"""Recorre el grafo de acciones de cada workflow y saca la cadencia:
   a que dia relativo cae cada impacto, por que canal y con que pieza."""
import json, io, collections

TIPO = {
    '0-1': 'DELAY',
    '0-4': 'EMAIL',
    '0-230189361': 'WHATSAPP',
    '0-5': 'SET_PROP',
    '0-31': 'MARKETABLE',
    '0-43347357': 'SUBSCRIPTION',
    '0-2': 'RAMA',
    '0-3': 'RAMA',
}

D = json.load(io.open('wf_raw.json', encoding='utf8'))


def dias(a):
    f = a.get('fields') or {}
    n = float(f.get('delta') or 0)
    u = str(f.get('time_unit') or 'DAYS').upper()
    if u.startswith('MINUTE'):
        return n / 1440.0
    if u.startswith('HOUR'):
        return n / 24.0
    if u.startswith('WEEK'):
        return n * 7
    if u.startswith('MONTH'):
        return n * 30
    return n


for wid, d in D.items():
    acc = {a['actionId']: a for a in (d.get('actions') or []) if a.get('actionId')}
    print('=' * 78)
    print('%s  %s   activo=%s' % (wid, d.get('name'), d.get('isEnabled')))
    if not acc:
        print('   SIN ACCIONES (workflow vacio)')
        print()
        continue

    # Recorrido lineal desde startActionId siguiendo nextActionId.
    cur = d.get('startActionId')
    t = 0.0
    visto = set()
    paso = 0
    while cur and cur in acc and cur not in visto:
        visto.add(cur)
        a = acc[cur]
        tipo = TIPO.get(str(a.get('actionTypeId')), str(a.get('actionTypeId')))
        f = a.get('fields') or {}
        if tipo == 'DELAY':
            t += dias(a)
            print('        ...espera %s %s  -> dia %g'
                  % (f.get('delta'), f.get('time_unit'), t))
        elif tipo == 'EMAIL':
            paso += 1
            print('   dia %-5g IMPACTO %d · EMAIL       content_id=%s'
                  % (t, paso, f.get('content_id')))
        elif tipo == 'WHATSAPP':
            paso += 1
            print('   dia %-5g IMPACTO %d · WHATSAPP    plantilla=%s'
                  % (t, paso, f.get('rootMicId')))
        elif tipo == 'SET_PROP':
            print('           (marca %s = %s)' % (f.get('property_name'), f.get('value')))
        con = a.get('connection') or {}
        cur = con.get('nextActionId')

    # Acciones que quedaron fuera del recorrido lineal (ramas, listas)
    fuera = [k for k in acc if k not in visto]
    if fuera:
        print('   -- %d acciones fuera de la cadena principal (ramas): %s'
              % (len(fuera), ', '.join(sorted(fuera)[:14])))
        for k in sorted(fuera, key=lambda x: int(x)):
            a = acc[k]
            tipo = TIPO.get(str(a.get('actionTypeId')), str(a.get('actionTypeId')))
            f = a.get('fields') or {}
            det = ''
            if tipo == 'EMAIL':
                det = 'content_id=%s' % f.get('content_id')
            elif tipo == 'WHATSAPP':
                det = 'plantilla=%s' % f.get('rootMicId')
            elif tipo == 'DELAY':
                det = '%s %s' % (f.get('delta'), f.get('time_unit'))
            elif tipo == 'SET_PROP':
                det = '%s = %s' % (f.get('property_name'), f.get('value'))
            print('      accion %-4s %-13s %s' % (k, tipo, det))
    print()
