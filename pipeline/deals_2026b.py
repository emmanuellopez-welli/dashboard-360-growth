# -*- coding: utf-8 -*-
import io
p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/Code.gs'
L = io.open(p, encoding='utf8').read().split('\n')

i = next(k for k, l in enumerate(L) if l.strip() == "var dcO = leerHoja_('DEALS_ORIGEN');")
L[i:i] = ["  // Desde 2026 igual que profundizacion: las cosechas de 2025 son de un",
          "  // pipeline que ya no existe y ensucian la comparacion entre meses.",
          "  var COSECHA_PISO_DEALS = '2026-01';"]
# la linea del regex, dentro del forEach de dcO (la que sigue a 'var cos = ')
j = next(k for k in range(i, len(L)) if l_ok(L, k)) if False else None
for k in range(i, len(L)):
    if L[k].strip() == "var cos = String(r.cosecha || '').substring(0, 7);":
        assert '/^\d{4}-\d{2}$/.test(cos)' in L[k + 1], L[k + 1]
        L[k + 1] = L[k + 1].replace('.test(cos)) return;',
                                    '.test(cos) || cos < COSECHA_PISO_DEALS) return;')
        print('filtro puesto en la linea', k + 2)
        break
s = '\n'.join(L)
a = "    excluidos: 'Duplicado/Existente · No pasó SARLAFT · Medicina Alternativa',"
b = ("    excluidos: 'Duplicado/Existente · No pasó SARLAFT · Medicina Alternativa · ' +\n"
     "      'Le faltan Documentos · Pruebas',")
assert a in s
io.open(p, 'w', encoding='utf8').write(s.replace(a, b, 1))
print('cinco exclusiones en el subtitulo')
