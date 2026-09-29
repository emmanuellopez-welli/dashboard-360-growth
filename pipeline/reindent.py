# -*- coding: utf-8 -*-
import io
p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/Code.gs'
L = io.open(p, encoding='utf8').read().split('\n')
i = next(k for k, l in enumerate(L) if l.startswith('function armarF7_'))
f = next(k for k in range(i + 1, len(L)) if L[k] == '}')
print('armarF7_: lineas %d-%d' % (i + 1, f + 1))
# re-indenta el cuerpo: quedo en columna 0 al sacarla de dentro de armarF2_
cuerpo = [('  ' + l if l.strip() else l) for l in L[i + 1:f]]
L = L[:i + 1] + cuerpo + L[f:]
io.open(p, 'w', encoding='utf8').write('\n'.join(L))
print('cuerpo re-indentado')
