# -*- coding: utf-8 -*-
"""Paso 1: enumera TODOS los threads de conversations y se queda con los del
canal WhatsApp (1007). Guarda ids + associatedContactId + fechas para cruzar
despues con Long Tail. Con timeout y reintento -- un solo request colgado
tumbaba el pull entero sin avisar."""
import requests, json, io, sys, time

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
TOKEN = __import__('lib').KEYS['HUBSPOT_PRIVATE_TOKEN']  # sacado del .env (antes estaba hardcodeado)
H = {'Authorization': 'Bearer ' + TOKEN}

def get(url, intentos=3):
    for i in range(intentos):
        try:
            r = requests.get(url, headers=H, timeout=20)
            if r.status_code == 200:
                return r.json()
            print('  status', r.status_code, r.text[:200])
        except requests.exceptions.RequestException as e:
            print('  timeout/err intento %d: %s' % (i + 1, str(e)[:150]))
        time.sleep(2)
    return None

todos = []
after = None
paginas = 0
t0 = time.time()
while True:
    url = 'https://api.hubapi.com/conversations/v3/conversations/threads?limit=100'
    if after:
        url += '&after=' + after
    d = get(url)
    if d is None:
        print('ABORTADO en pagina', paginas + 1)
        break
    todos.extend(d.get('results') or [])
    paginas += 1
    if paginas % 5 == 0:
        print('  %d paginas, %d threads, %.0fs' % (paginas, len(todos), time.time() - t0))
        sys.stdout.flush()
    after = ((d.get('paging') or {}).get('next') or {}).get('after')
    if not after:
        break

print('TOTAL threads:', len(todos), 'en %d paginas, %.0fs' % (paginas, time.time() - t0))
wa = [t for t in todos if t.get('originalChannelId') == '1007']
print('threads de WhatsApp:', len(wa))

json.dump(todos, io.open('lt_wa_threads_all.json', 'w', encoding='utf8'), ensure_ascii=False)
print('escrito lt_wa_threads_all.json')
