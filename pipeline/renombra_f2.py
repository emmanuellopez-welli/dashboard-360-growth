# -*- coding: utf-8 -*-
"""Renombra y reordena los seis mapas de profundizacion.

El orden nuevo cuenta la historia completa: arrancan, arrancan de verdad,
cuanta plata dejan acumulada, cuanta dejan mes a mes, cuantas se enfrian y
cuantas se pierden. Las dos de plata quedan juntas porque son la misma
pregunta con y sin acumular, y las dos de perdida al final."""
import io, re

p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/Code.gs'
s = io.open(p, encoding='utf8').read()

ini = s.index('  f.mapas = [')
fin = s.index('\n  ];\n', ini) + len('\n  ];\n')
bloque = s[ini:fin]

# se parte en los seis objetos por su id
partes = {}
for m in re.finditer(r"    \{ id: '(\w+)', orden: \d+,(.*?)\n(?=    \{ id: |  \];)",
                     bloque, re.S):
    partes[m.group(1)] = m.group(2).rstrip().rstrip(',')
assert len(partes) == 6, 'esperaba 6 mapas, encontre %d: %s' % (len(partes), list(partes))

# id -> (orden nuevo, titulo nuevo)
NUEVO = [
    ('activas',         'Sedes activas'),
    ('exitosas',        'Sedes exitosas'),
    ('desembolsos',     'Desembolsos por sede · acumulado'),
    ('desembolsos_mes', 'Desembolsos por sede · sin acumular'),
    ('inactivas',       'Sedes inactivas'),
    ('muertas',         'Sedes muertas'),
]

out = ['  f.mapas = [']
for i, (idm, titulo) in enumerate(NUEVO):
    cuerpo = partes[idm]
    # el titulo nuevo reemplaza al viejo
    cuerpo = re.sub(r"\n      titulo: '[^']*',", "\n      titulo: '%s'," % titulo,
                    cuerpo, count=1)
    assert titulo in cuerpo, 'no pude poner el titulo de %s' % idm
    out.append("    { id: '%s', orden: %d,%s%s" %
               (idm, i + 1, cuerpo, ',' if i < len(NUEVO) - 1 else ''))
    if i < len(NUEVO) - 1:
        out.append('')
out.append('  ];')
nuevo = '\n'.join(out) + '\n'

io.open(p, 'w', encoding='utf8').write(s[:ini] + nuevo + s[fin:])
print('seis mapas renombrados y reordenados:')
for i, (idm, t) in enumerate(NUEVO):
    print('   %d · %-38s (%s)' % (i + 1, t, idm))
