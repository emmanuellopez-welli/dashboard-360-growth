# -*- coding: utf-8 -*-
import io
p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/scripts.html'
s = io.open(p, encoding='utf8').read()
old = """          { t: 'Plata de la cosecha', k: 'plata', f: 'cop' },
          { t: 'Originación/$', k: 'multiplo', f: 'txt' }"""
new = """          { t: '1er mes', k: 'plataM0', f: 'cop' },
          { t: 'Hasta hoy', k: 'plata', f: 'cop' },
          { t: 'Originación/$', k: 'multiplo', f: 'txt' }"""
assert old in s
s = s.replace(old, new, 1)
old2 = """      panel('Del gasto a la plata, mes a mes',
        'cada mes con su propio gasto y su propia cosecha de social media',"""
new2 = """      panel('Del gasto a la plata, mes a mes',
        'cada mes con su propio gasto y su propia cosecha · "1er mes" es lo que ' +
        'puso la cosecha en su mes de entrada, que es la única columna comparable ' +
        'entre meses; "hasta hoy" es todo lo que ha puesto desde entonces',"""
assert old2 in s
s = s.replace(old2, new2, 1)
io.open(p, 'w', encoding='utf8').write(s)
print('tabla con las dos lecturas')
