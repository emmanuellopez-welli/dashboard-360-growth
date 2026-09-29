# -*- coding: utf-8 -*-
"""Compara la version PUBLICADA contra la que voy a publicar, por inventario
   y no por diff crudo: las tablas de datos cambian de fecha en cada build y
   un diff literal seria todo ruido. Lo que importa es que no desaparezca
   ninguna funcion, ningun selector y ningun titulo de panel."""
import io, re, collections

VIVA = ('C:/Users/millo/.claude/projects/'
        'c--Users-millo-OneDrive-Escritorio-Dashboard-360-mkt/'
        '95b6c25f-0cdd-4334-b125-2f02670a509c/tool-results/'
        'artifact-c22415d2-1788792964-40db.html')
MIA = 'artifact_tablero.html'

def leer(p):
    return io.open(p, encoding='utf8', errors='replace').read()

v, m = leer(VIVA), leer(MIA)

def inv(s):
    return {
        'funciones': set(re.findall(r'\bfunction\s+([A-Za-z_$][\w$]*)', s)),
        'selectores': set(re.findall(r'^\.([a-zA-Z][\w-]*)', s, re.M)),
        # los titulos de panel son el contenido visible del tablero
        'paneles': set(re.findall(r"panel(?:Graf|Gran)?\(\s*'([^']{6,70})'", s)),
        'secciones': set(re.findall(r'<h2 class="sec">([^<\']{4,70})', s)),
        'tablas': set(re.findall(r"leerHoja_\('([A-Z_0-9]+)'\)", s)),
        'vistas': set(re.findall(r"VISTAS_VALIDAS = \[([^\]]*)\]", s)),
    }

iv, im = inv(v), inv(m)
for k in ['funciones', 'selectores', 'paneles', 'secciones', 'tablas', 'vistas']:
    solo_viva = sorted(iv[k] - im[k])
    solo_mia = sorted(im[k] - iv[k])
    print('\n=== %s · viva %d · mia %d' % (k.upper(), len(iv[k]), len(im[k])))
    if solo_viva:
        print('  SOLO EN LA VIVA (se perderia):')
        for x in solo_viva:
            print('     - %s' % x)
    else:
        print('  nada exclusivo de la viva')
    if solo_mia:
        print('  nuevo en la mia (%d):' % len(solo_mia))
        for x in solo_mia[:40]:
            print('     + %s' % x)
