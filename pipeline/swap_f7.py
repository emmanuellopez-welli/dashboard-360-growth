# -*- coding: utf-8 -*-
import io
p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/scripts.html'
L = io.open(p, encoding='utf8').read().split('\n')
nuevo = io.open('f7_v2.js', encoding='utf8').read().rstrip('\n').split('\n')

ini = next(i for i, l in enumerate(L) if l.startswith('/* Impactos encendidos'))
fi = None
for i in range(ini, len(L)):
    if L[i].startswith('function chSerieImpactos'):
        fi = next(j for j in range(i + 1, len(L)) if L[j] == '}')
        break
assert fi
print('motor de grafica: lineas %d-%d -> %d nuevas' % (ini + 1, fi + 1, len(nuevo)))
L = L[:ini] + nuevo + L[fi + 1:]

# el bloque de chips de vistaF7, por numero de linea (localizado con awk)
a = next(i for i, l in enumerate(L) if l.strip() == 'var imp = f.impactos || [];')
b = next(i for i in range(a, len(L)) if L[i].strip() == "chips += '</div>';")
c = next(i for i in range(b, len(L)) if L[i].strip() == '}')
print('chips: lineas %d-%d' % (a + 1, c + 1))
rep = [
    "  var imp = f.impactos || [];",
    "  // El id permite repintar solo los chips al apagar un impacto, sin",
    "  // rehacer la vista entera, que hacia saltar la pagina al inicio.",
    "  var chips = imp.length",
    "    ? '<div class=\"imp-chips\" id=\"f7Chips\">' + chipsImpactos(f) + '</div>' : '';",
]
L = L[:a] + rep + L[c + 1:]
io.open(p, 'w', encoding='utf8').write('\n'.join(L))
print('listo')
