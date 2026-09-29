# -*- coding: utf-8 -*-
"""Repara sheet_data.json truncado a mitad de una escritura (kill -9 de un
proceso de sube_generico.py, 24-sep-2026). El archivo es un dict plano
{ "HOJA": [[fila], [fila], ...], ... } -- se escanea byte a byte llevando
la profundidad de brackets (respetando strings/escapes) y se recuerda el
ULTIMO punto donde la profundidad vuelve a 1 justo despues de cerrar un
array de una hoja completa (o sea, un "HOJA": [...] completo). Se corta ahi
y se cierra el objeto con '}'. Todo lo que hay ANTES de ese punto queda
intacto -- la hoja que se estaba escribiendo cuando se mato el proceso se
pierde de este archivo pero se re-sube por separado con las tablas ya
pulled en disco."""
import json, io

RUTA = 'sheet_data.json'
with io.open(RUTA, 'r', encoding='utf-8') as f:
    s = f.read()

print('tamano original:', len(s), 'caracteres')

depth = 0
in_str = False
esc = False
last_safe = None
i = 0
n = len(s)
# el primer caracter no-espacio debe ser '{'
while i < n and s[i] in ' \t\r\n':
    i += 1
assert s[i] == '{', 'no empieza con {'
depth = 1
i += 1
start_top = i

while i < n:
    c = s[i]
    if in_str:
        if esc:
            esc = False
        elif c == '\\':
            esc = True
        elif c == '"':
            in_str = False
        i += 1
        continue
    if c == '"':
        in_str = True
        i += 1
        continue
    if c in '{[':
        depth += 1
        i += 1
        continue
    if c in '}]':
        depth -= 1
        i += 1
        if depth == 1:
            # se acaba de cerrar el VALOR de una hoja completa (su array).
            # marca este punto como seguro (justo despues de la ] de esa hoja).
            last_safe = i
        continue
    i += 1

print('depth final:', depth, '(si no es 1 o 0, el archivo esta mal desde antes)')
print('ultimo punto seguro:', last_safe)

if last_safe is None:
    raise RuntimeError('no se encontro ningun punto seguro -- no se puede reparar asi')

reparado = s[:last_safe] + '}'

# validar
d = json.loads(reparado)
print('reparado OK -- hojas recuperadas:', len(d))
print('hojas:', sorted(d.keys()))

with io.open(RUTA, 'w', encoding='utf-8') as f:
    f.write(reparado)
print('escrito', RUTA)
